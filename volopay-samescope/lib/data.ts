import "server-only";
import { z } from "zod";
import { sql } from "./db";
import type { User } from "./auth";
import { CATEGORY_IDS, URGENCY_IDS, categoryLabel } from "./constants";

export function appUrl() {
  const fromEnv = process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);
  return (fromEnv ?? "http://localhost:3000").replace(/\/$/, "");
}

export class UserError extends Error {}

// ---------- Input shapes (shared by the app forms and the MCP actions) ----------

export const jobItemInput = z.object({
  description: z.string().trim().min(3).max(300).describe("One piece of work, written so any contractor prices the same thing"),
  quantity: z.coerce.number().positive().max(100000).default(1).describe("How much of it, e.g. 40"),
  unit: z.string().trim().min(1).max(20).default("job").describe("Unit for the quantity: job, sq ft, running ft, point, piece, litre or day"),
  notes: z.string().trim().max(300).default("").describe("Optional detail: material grade, brand preference, constraints"),
});

export const jobFieldsInput = {
  title: z.string().trim().min(5).max(120).describe("Short title, e.g. 'Fix leak behind master bathroom wall'"),
  category: z.enum(CATEGORY_IDS).describe("Trade category used to match contractors"),
  city: z.string().trim().min(2).max(60).default("Bengaluru").describe("City of the property"),
  locality: z.string().trim().max(120).default("").describe("Area or neighbourhood, e.g. 'HSR Layout, Sector 2'. No full street address."),
  summary: z.string().trim().max(2000).default("").describe("Plain description of the problem and likely cause, as seen in the photos"),
  urgency: z.enum(URGENCY_IDS).default("this_month"),
  budget_min: z.coerce.number().int().nonnegative().optional().describe("Optional budget range in INR"),
  budget_max: z.coerce.number().int().nonnegative().optional(),
  site_visit_questions: z.array(z.string().trim().min(3).max(300)).max(8).default([]).describe("Questions contractors must answer or check on the site visit"),
};

export const jobInput = z.object({
  ...jobFieldsInput,
  items: z.array(jobItemInput).min(1).max(25).describe("Line items of the scope of work. Every contractor prices each line, so quotes can be compared."),
});
export type JobInput = z.infer<typeof jobInput>;

export const quoteInput = z.object({
  job_id: z.coerce.number().int(),
  items: z
    .array(z.object({ item_id: z.coerce.number().int(), price: z.coerce.number().int().nonnegative().max(10_000_000) }))
    .min(1)
    .describe("Price in INR for each line item of the job (labour + material for that line)"),
  days_to_complete: z.coerce.number().int().min(1).max(365),
  warranty_months: z.coerce.number().int().min(0).max(120).default(0),
  visit_fee: z.coerce.number().int().min(0).max(100000).default(0).describe("Site visit fee in INR, 0 if free"),
  note: z.string().trim().max(1000).default("").describe("Message to the homeowner: approach, materials, assumptions"),
});
export type QuoteInput = z.infer<typeof quoteInput>;

// ---------- Types ----------

export type Job = {
  id: number;
  owner_id: number;
  title: string;
  category: string;
  city: string;
  locality: string;
  summary: string;
  urgency: string;
  budget_min: number | null;
  budget_max: number | null;
  site_visit_questions: string[];
  status: "draft" | "open" | "hired" | "closed";
  created_via: "claude" | "app";
  hired_quote_id: number | null;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
};

export type JobItem = { id: number; job_id: number; position: number; description: string; quantity: string; unit: string; notes: string };

// ---------- Homeowner side ----------

async function insertItems(tx: typeof sql, jobId: number, items: JobInput["items"]) {
  for (const [i, it] of items.entries()) {
    await tx`insert into job_items (job_id, position, description, quantity, unit, notes)
             values (${jobId}, ${i}, ${it.description}, ${it.quantity}, ${it.unit}, ${it.notes})`;
  }
}

function checkBudget(min?: number, max?: number) {
  if (min != null && max != null && min > max) throw new UserError("Budget minimum is higher than the maximum.");
}

export async function createJob(owner: User, input: JobInput, via: "claude" | "app") {
  if (owner.role !== "homeowner") throw new UserError("Only homeowner accounts can post jobs.");
  checkBudget(input.budget_min, input.budget_max);
  return sql.begin(async (tx) => {
    const [job] = await tx<{ id: number }[]>`
      insert into jobs (owner_id, title, category, city, locality, summary, urgency, budget_min, budget_max, site_visit_questions, created_via)
      values (${owner.id}, ${input.title}, ${input.category}, ${input.city}, ${input.locality}, ${input.summary}, ${input.urgency},
              ${input.budget_min ?? null}, ${input.budget_max ?? null}, ${input.site_visit_questions}, ${via})
      returning id`;
    await insertItems(tx as unknown as typeof sql, job.id, input.items);
    await tx`insert into events (job_id, message) values (${job.id}, ${via === "claude" ? "Scope written in Claude and saved as a draft" : "Draft created in the app"})`;
    return job.id;
  });
}

export async function getOwnedJob(owner: User, jobId: number) {
  const [job] = await sql<Job[]>`select * from jobs where id = ${jobId} and owner_id = ${owner.id}`;
  if (!job) throw new UserError("Job not found.");
  return job;
}

export async function getItems(jobId: number) {
  return sql<JobItem[]>`select * from job_items where job_id = ${jobId} order by position, id`;
}

export async function getPhotoIds(jobId: number) {
  const rows = await sql<{ id: number }[]>`select id from photos where job_id = ${jobId} order by id`;
  return rows.map((r) => r.id);
}

export async function getEvents(jobId: number) {
  return sql<{ message: string; created_at: Date }[]>`select message, created_at from events where job_id = ${jobId} order by created_at desc, id desc limit 20`;
}

export async function quoteCount(jobId: number) {
  const [r] = await sql<{ n: number }[]>`select count(*)::int as n from quotes where job_id = ${jobId}`;
  return r.n;
}

export async function updateJob(owner: User, jobId: number, input: JobInput) {
  const job = await getOwnedJob(owner, jobId);
  if (job.status === "hired" || job.status === "closed") throw new UserError("This job is finished and can no longer be edited.");
  checkBudget(input.budget_min, input.budget_max);
  const quotes = await quoteCount(jobId);
  await sql.begin(async (tx) => {
    await tx`update jobs set title = ${input.title}, category = ${input.category}, city = ${input.city}, locality = ${input.locality},
                summary = ${input.summary}, urgency = ${input.urgency}, budget_min = ${input.budget_min ?? null},
                budget_max = ${input.budget_max ?? null}, site_visit_questions = ${input.site_visit_questions}, updated_at = now()
             where id = ${jobId}`;
    if (quotes === 0) {
      await tx`delete from job_items where job_id = ${jobId}`;
      await insertItems(tx as unknown as typeof sql, jobId, input.items);
    } else {
      // Quotes are priced against these lines, so only wording can change, not the set of lines.
      const existing = await tx<JobItem[]>`select * from job_items where job_id = ${jobId} order by position, id`;
      if (existing.length !== input.items.length) throw new UserError("Contractors have already quoted on this scope, so lines can't be added or removed. You can still fix wording.");
      for (const [i, it] of input.items.entries()) {
        await tx`update job_items set description = ${it.description}, notes = ${it.notes} where id = ${existing[i].id}`;
      }
    }
    await tx`insert into events (job_id, message) values (${jobId}, 'Scope edited')`;
  });
}

export async function setJobStatus(owner: User, jobId: number, status: "open" | "draft" | "closed") {
  const job = await getOwnedJob(owner, jobId);
  if (job.status === "hired") throw new UserError("A contractor is already hired for this job.");
  if (status === "draft" && (await quoteCount(jobId)) > 0) throw new UserError("Quotes have arrived, so the job can't go back to draft. You can close it instead.");
  await sql`update jobs set status = ${status}, updated_at = now(),
              published_at = ${status === "open" ? sql`coalesce(published_at, now())` : sql`published_at`}
            where id = ${jobId}`;
  const msg = status === "open" ? "Published to local contractors" : status === "draft" ? "Moved back to draft" : "Closed by homeowner";
  await sql`insert into events (job_id, message) values (${jobId}, ${msg})`;
}

export async function listOwnerJobs(owner: User) {
  return sql<(Job & { quotes: number; lowest_total: number | null })[]>`
    select j.*,
      (select count(*)::int from quotes q where q.job_id = j.id) as quotes,
      (select min(t.total)::int from (select sum(qi.price) as total from quotes q join quote_items qi on qi.quote_id = q.id where q.job_id = j.id group by q.id) t) as lowest_total
    from jobs j where j.owner_id = ${owner.id} order by j.created_at desc`;
}

export type ComparedQuote = {
  id: number;
  status: string;
  contractor: { id: number; name: string; business: string; rating: string | null; jobs_completed: number; phone: string | null };
  prices: Record<number, number>;
  total: number;
  days_to_complete: number;
  warranty_months: number;
  visit_fee: number;
  note: string;
  updated_at: Date;
};

export async function compareQuotes(owner: User, jobId: number) {
  const job = await getOwnedJob(owner, jobId);
  const items = await getItems(jobId);
  const rows = await sql<
    { id: number; status: string; contractor_id: number; name: string; business_name: string | null; rating: string | null; jobs_completed: number; phone: string | null; days_to_complete: number; warranty_months: number; visit_fee: number; note: string; updated_at: Date }[]
  >`select q.*, u.name, u.business_name, u.rating, u.jobs_completed, u.phone
    from quotes q join users u on u.id = q.contractor_id where q.job_id = ${jobId} order by q.created_at`;
  const priceRows = await sql<{ quote_id: number; job_item_id: number; price: number }[]>`
    select qi.* from quote_items qi join quotes q on q.id = qi.quote_id where q.job_id = ${jobId}`;

  const quotes: ComparedQuote[] = rows.map((r) => {
    const prices: Record<number, number> = {};
    for (const p of priceRows) if (p.quote_id === r.id) prices[p.job_item_id] = p.price;
    const total = items.reduce((s, it) => s + (prices[it.id] ?? 0), 0);
    return {
      id: r.id,
      status: r.status,
      contractor: {
        id: r.contractor_id,
        name: r.name,
        business: r.business_name ?? r.name,
        rating: r.rating,
        jobs_completed: r.jobs_completed,
        // Contact details are shared only after hiring.
        phone: job.hired_quote_id === r.id ? r.phone : null,
      },
      prices,
      total,
      days_to_complete: r.days_to_complete,
      warranty_months: r.warranty_months,
      visit_fee: r.visit_fee,
      note: r.note,
      updated_at: r.updated_at,
    };
  });

  const lowestPerItem: Record<number, number> = {};
  for (const it of items) {
    const vals = quotes.map((q) => q.prices[it.id]).filter((v): v is number => v != null);
    if (vals.length) lowestPerItem[it.id] = Math.min(...vals);
  }
  const lowestTotal = quotes.length ? Math.min(...quotes.map((q) => q.total)) : null;
  return { job, items, quotes, lowestPerItem, lowestTotal };
}

export async function hireQuote(owner: User, jobId: number, quoteId: number) {
  const job = await getOwnedJob(owner, jobId);
  if (job.status !== "open") throw new UserError("You can only hire on an open job.");
  const [q] = await sql<{ id: number; contractor_id: number; label: string }[]>`
    select q.id, q.contractor_id, coalesce(u.business_name, u.name) as label from quotes q join users u on u.id = q.contractor_id
    where q.id = ${quoteId} and q.job_id = ${jobId}`;
  if (!q) throw new UserError("Quote not found.");
  await sql.begin(async (tx) => {
    await tx`update quotes set status = case when id = ${quoteId} then 'accepted' else 'declined' end where job_id = ${jobId}`;
    await tx`update jobs set status = 'hired', hired_quote_id = ${quoteId}, updated_at = now() where id = ${jobId}`;
    await tx`insert into events (job_id, message) values (${jobId}, ${"Hired " + q.label + ". Contact details shared with both sides."})`;
  });
}

export async function addPhoto(owner: User, jobId: number, mime: string, data: Buffer) {
  await getOwnedJob(owner, jobId);
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from photos where job_id = ${jobId}`;
  if (n >= 8) throw new UserError("A job can have at most 8 photos.");
  await sql`insert into photos (job_id, mime, data) values (${jobId}, ${mime}, ${data})`;
}

export async function deletePhoto(owner: User, jobId: number, photoId: number) {
  await getOwnedJob(owner, jobId);
  await sql`delete from photos where id = ${photoId} and job_id = ${jobId}`;
}

// ---------- Contractor side ----------

export type Lead = Job & { quotes: number; my_quote_id: number | null; my_total: number | null; items: JobItem[] };

export async function listLeads(pro: User): Promise<Lead[]> {
  if (pro.role !== "contractor") throw new UserError("Only contractor accounts can see leads.");
  const jobs = await sql<(Job & { quotes: number; my_quote_id: number | null; my_total: number | null })[]>`
    select j.*,
      (select count(*)::int from quotes q where q.job_id = j.id) as quotes,
      (select q.id from quotes q where q.job_id = j.id and q.contractor_id = ${pro.id}) as my_quote_id,
      (select sum(qi.price)::int from quotes q join quote_items qi on qi.quote_id = q.id where q.job_id = j.id and q.contractor_id = ${pro.id}) as my_total
    from jobs j
    where (j.status = 'open' and lower(j.city) = lower(${pro.city}) and j.category = any(${pro.trades}))
       or exists (select 1 from quotes q where q.job_id = j.id and q.contractor_id = ${pro.id})
    order by (j.status = 'open') desc, j.published_at desc nulls last`;
  const ids = jobs.map((j) => j.id);
  const items = ids.length ? await sql<JobItem[]>`select * from job_items where job_id = any(${ids}) order by position, id` : [];
  return jobs.map((j) => ({ ...j, items: items.filter((i) => i.job_id === j.id) }));
}

export async function getLead(pro: User, jobId: number) {
  const [job] = await sql<Job[]>`select * from jobs where id = ${jobId}`;
  const [mine] = await sql<{ id: number; status: string; days_to_complete: number; warranty_months: number; visit_fee: number; note: string }[]>`
    select * from quotes where job_id = ${jobId} and contractor_id = ${pro.id}`;
  const visible = job && (mine || (job.status === "open" && job.city.toLowerCase() === pro.city.toLowerCase() && pro.trades.includes(job.category)));
  if (!visible) throw new UserError("This job isn't available to you.");
  const items = await getItems(jobId);
  const myPrices: Record<number, number> = {};
  if (mine) {
    const rows = await sql<{ job_item_id: number; price: number }[]>`select job_item_id, price from quote_items where quote_id = ${mine.id}`;
    for (const r of rows) myPrices[r.job_item_id] = r.price;
  }
  let owner: { name: string; phone: string | null } | null = null;
  if (mine && job.hired_quote_id === mine.id) {
    const [o] = await sql<{ name: string; phone: string | null }[]>`select name, phone from users where id = ${job.owner_id}`;
    owner = o;
  }
  return { job, items, mine: mine ?? null, myPrices, owner, quotes: await quoteCount(jobId), photos: await getPhotoIds(jobId) };
}

export async function sendQuote(pro: User, input: QuoteInput, via: "claude" | "app") {
  if (pro.role !== "contractor") throw new UserError("Only contractor accounts can send quotes.");
  const { job, items, mine } = await getLead(pro, input.job_id);
  if (job.status !== "open") throw new UserError("This job is no longer taking quotes.");
  const priceById = new Map(input.items.map((i) => [i.item_id, i.price]));
  const missing = items.filter((it) => !priceById.has(it.id));
  if (missing.length) {
    throw new UserError(`Price every line of the scope. Missing: ${missing.map((m) => `#${m.id} ${m.description}`).join("; ")}`);
  }
  const unknown = input.items.filter((i) => !items.some((it) => it.id === i.item_id));
  if (unknown.length) throw new UserError(`These item ids are not part of job ${job.id}: ${unknown.map((u) => u.item_id).join(", ")}`);

  return sql.begin(async (tx) => {
    let quoteId: number;
    if (mine) {
      quoteId = mine.id;
      await tx`update quotes set days_to_complete = ${input.days_to_complete}, warranty_months = ${input.warranty_months},
                 visit_fee = ${input.visit_fee}, note = ${input.note}, updated_at = now() where id = ${quoteId}`;
      await tx`delete from quote_items where quote_id = ${quoteId}`;
    } else {
      const [u] = await tx<{ credits: number }[]>`update users set credits = credits - 1 where id = ${pro.id} and credits > 0 returning credits`;
      if (!u) throw new UserError("You're out of quote credits. Buy more on the Account page.");
      const [q] = await tx<{ id: number }[]>`
        insert into quotes (job_id, contractor_id, days_to_complete, warranty_months, visit_fee, note, created_via)
        values (${job.id}, ${pro.id}, ${input.days_to_complete}, ${input.warranty_months}, ${input.visit_fee}, ${input.note}, ${via})
        returning id`;
      quoteId = q.id;
    }
    for (const it of items) {
      await tx`insert into quote_items (quote_id, job_item_id, price) values (${quoteId}, ${it.id}, ${priceById.get(it.id)!})`;
    }
    const label = pro.business_name ?? pro.name;
    await tx`insert into events (job_id, message) values (${job.id}, ${(mine ? "Quote revised by " : "Quote received from ") + label})`;
    return { quoteId, revised: Boolean(mine) };
  });
}

export function describeJob(job: Job) {
  return `${job.title} (${categoryLabel(job.category)}, ${job.locality ? job.locality + ", " : ""}${job.city})`;
}

export { inr } from "./format";
