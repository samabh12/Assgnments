// Remote MCP endpoint. Each user has a personal URL: /mcp/<their token>.
// The token decides who is calling and which actions they get.
// There is no AI here: these actions only save and read data. The thinking happens in the user's own Claude.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { userByToken, type User } from "@/lib/auth";
import {
  UserError,
  appUrl,
  compareQuotes,
  createJob,
  getLead,
  jobFieldsInput,
  jobItemInput,
  jobInput,
  listLeads,
  listOwnerJobs,
  quoteInput,
  sendQuote,
  getItems,
} from "@/lib/data";
import { CATEGORIES, categoryLabel, urgencyLabel } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function ok(data: unknown, lead?: string): ToolResult {
  const text = (lead ? lead + "\n\n" : "") + JSON.stringify(data, null, 2);
  return { content: [{ type: "text", text }] };
}

async function guard(fn: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof UserError) return { content: [{ type: "text", text: e.message }], isError: true };
    if (e instanceof z.ZodError) return { content: [{ type: "text", text: "Invalid input: " + e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }], isError: true };
    console.error(e);
    return { content: [{ type: "text", text: "Something went wrong on the SameScope server. Please try again." }], isError: true };
  }
}

const HOMEOWNER_GUIDE = `SameScope turns a home repair problem into one clear scope of work that local contractors all quote on, so the homeowner can compare like for like.
How to help the homeowner:
1. Look at their photos and description. Work out the likely cause.
2. Write a scope as line items with quantity and unit (e.g. "Apply waterproofing coat on floor", 60, "sq ft"). Each line must be something a contractor can price on its own.
3. Add site visit questions for things you can't confirm from photos.
4. Call create_job. It saves a DRAFT. Give the user the review link: they check it, add photos and publish it from the app.
5. Later, call get_quotes to compare the quotes that came in and explain the trade-offs.
Never include a full street address or phone number in the job.`;

const CONTRACTOR_GUIDE = `SameScope sends you home repair jobs near you, each with a fixed scope of work written as line items.
Call list_open_jobs to see them. To quote, price EVERY line item (labour + material for that line) and call send_quote with the item ids.
Sending a new quote uses 1 credit. Revising your own quote is free.`;

function buildServer(user: User) {
  const server = new McpServer(
    { name: "samescope", version: "1.0.0" },
    { instructions: user.role === "homeowner" ? HOMEOWNER_GUIDE : CONTRACTOR_GUIDE }
  );
  const base = appUrl();

  if (user.role === "homeowner") {
    server.registerTool(
      "create_job",
      {
        title: "Create a repair job (draft)",
        description:
          "Save a home repair job with a structured scope of work as a DRAFT in SameScope. The homeowner reviews and edits it in the app, adds photos, then publishes it to local contractors who quote on every line item. Categories: " +
          CATEGORIES.map((c) => `${c.id} (${c.label})`).join(", "),
        inputSchema: { ...jobFieldsInput, items: z.array(jobItemInput).min(1).max(25).describe("Line items of the scope of work. Every contractor prices each line, so quotes can be compared.") },
      },
      async (args) =>
        guard(async () => {
          const id = await createJob(user, jobInput.parse({ ...args, city: args.city || user.city }), "claude");
          return ok(
            { job_id: id, status: "draft", review_link: `${base}/jobs/${id}` },
            `Draft job #${id} saved. Ask the homeowner to open ${base}/jobs/${id} to review the scope, add photos, and press Publish so local contractors can quote.`
          );
        })
    );

    server.registerTool(
      "list_my_jobs",
      {
        title: "List my jobs",
        description: "List the homeowner's repair jobs with status (draft, open, hired, closed), number of quotes and the lowest total quoted.",
        inputSchema: {},
        annotations: { readOnlyHint: true },
      },
      async () =>
        guard(async () => {
          const jobs = await listOwnerJobs(user);
          return ok(
            jobs.map((j) => ({
              job_id: j.id,
              title: j.title,
              category: categoryLabel(j.category),
              locality: j.locality,
              status: j.status,
              quotes: j.quotes,
              lowest_total_inr: j.lowest_total,
              link: `${base}/jobs/${j.id}`,
            }))
          );
        })
    );

    server.registerTool(
      "get_quotes",
      {
        title: "Compare quotes for a job",
        description:
          "Get every quote for one job, priced line by line against the same scope, with totals, days to complete, warranty, visit fee, contractor rating and notes. Use it to explain the trade-offs to the homeowner. Hiring is done by the homeowner in the app.",
        inputSchema: { job_id: z.coerce.number().int().describe("The job id from create_job or list_my_jobs") },
        annotations: { readOnlyHint: true },
      },
      async ({ job_id }) =>
        guard(async () => {
          const { job, items, quotes, lowestTotal } = await compareQuotes(user, job_id);
          return ok({
            job_id: job.id,
            title: job.title,
            status: job.status,
            compare_link: `${base}/jobs/${job.id}#quotes`,
            lowest_total_inr: lowestTotal,
            line_items: items.map((it) => ({ item_id: it.id, description: it.description, quantity: Number(it.quantity), unit: it.unit })),
            quotes: quotes.map((q) => ({
              quote_id: q.id,
              contractor: q.contractor.business,
              rating: q.contractor.rating ? Number(q.contractor.rating) : null,
              jobs_completed: q.contractor.jobs_completed,
              total_inr: q.total,
              line_prices_inr: Object.fromEntries(items.map((it) => [it.description, q.prices[it.id] ?? null])),
              days_to_complete: q.days_to_complete,
              warranty_months: q.warranty_months,
              visit_fee_inr: q.visit_fee,
              note: q.note,
              status: q.status,
            })),
          });
        })
    );
  } else {
    server.registerTool(
      "list_open_jobs",
      {
        title: "List open jobs near me",
        description:
          "List open home repair jobs in the contractor's city and trades, each with its full scope (line items with item_id, quantity, unit), site visit questions, budget and how many quotes are already in. Also lists jobs this contractor has already quoted on.",
        inputSchema: {},
        annotations: { readOnlyHint: true },
      },
      async () =>
        guard(async () => {
          const leads = await listLeads(user);
          return ok(
            {
              credits_left: user.credits,
              jobs: leads.map((j) => ({
                job_id: j.id,
                title: j.title,
                category: categoryLabel(j.category),
                locality: `${j.locality}, ${j.city}`,
                urgency: urgencyLabel(j.urgency),
                budget_inr: j.budget_min || j.budget_max ? `${j.budget_min ?? "?"}–${j.budget_max ?? "?"}` : "not given",
                summary: j.summary,
                site_visit_questions: j.site_visit_questions,
                status: j.status,
                quotes_so_far: j.quotes,
                my_quote_total_inr: j.my_total,
                items: j.items.map((it) => ({ item_id: it.id, description: it.description, quantity: Number(it.quantity), unit: it.unit, notes: it.notes })),
                link: `${base}/leads/${j.id}`,
              })),
            },
            leads.length ? undefined : "No open jobs match your city and trades right now."
          );
        })
    );

    server.registerTool(
      "send_quote",
      {
        title: "Send or revise a quote",
        description:
          "Send a quote for an open job. Price every line item by its item_id (INR, labour + material for that line). A new quote uses 1 credit; sending again revises your existing quote for free.",
        inputSchema: quoteInput.shape,
      },
      async (args) =>
        guard(async () => {
          const input = quoteInput.parse(args);
          const { quoteId, revised } = await sendQuote(user, input, "claude");
          const { job } = await getLead(user, input.job_id);
          const items = await getItems(job.id);
          const total = input.items.reduce((s, i) => s + i.price, 0);
          return ok(
            { quote_id: quoteId, job_id: job.id, total_inr: total, lines: items.length, link: `${base}/leads/${job.id}` },
            `${revised ? "Quote revised" : "Quote sent"} for "${job.title}". The homeowner now sees it next to the other quotes. You can edit it at ${base}/leads/${job.id}.`
          );
        })
    );
  }
  return server;
}

async function handle(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const user = await userByToken(token);
  if (!user) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Unknown SameScope MCP link. Copy your personal link from the Connect page in the app." }, id: null },
      { status: 404 }
    );
  }
  const server = buildServer(user);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
