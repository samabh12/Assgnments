# SameScope

**Describe a home repair to Claude. Local contractors quote on the same scope. Compare like for like and hire.**

Built for the Volopay Product & Tech assignment: a business that runs on Claude through MCP, with no AI inside the app.

## The problem

When a wall leaks, a homeowner calls three contractors and gets three quotes for three different jobs. One includes
tiles, one doesn't, one is a lump sum. There is no way to compare them, so people pick on gut feel and often overpay.
Contractors, on the other side, travel to sites for jobs they can't price, and buy leads that are sold to ten others.

## How it works

| Step | Who | What happens |
|------|-----|--------------|
| 1 | Homeowner, in Claude | "My bathroom wall leaks into the bedroom, here are 4 photos." |
| 2 | **Claude** (the homeowner's own plan) | Works out the likely cause and writes a scope of work as line items, with site visit questions. Calls `create_job`. |
| 3 | **SameScope** | Saves it as a draft. The homeowner opens the link, edits any line, adds photos and publishes. |
| 4 | **SameScope** | Shows the job to contractors in that city and trade. Each one prices **every line** of the same scope (in the app, or through their own Claude with `send_quote`). |
| 5 | Homeowner | Sees the quotes side by side, cheapest line highlighted, and hires one. Phone numbers are shared only then. |

Claude does the reading and writing. SameScope does what Claude can't: it holds the contractor network, keeps the
job live for days while quotes arrive, lines quotes up on the same scope, and records who was hired.

## Try it

**Live app:** `<APP_URL>` (filled in after deploy)

Test logins, password for all: `Demo@1234`

| Role | Email |
|------|-------|
| Homeowner | `homeowner@samescope.demo` |
| Contractor | `anita@samescope.demo` |
| Contractor | `ravi@samescope.demo` |
| Contractor | `suresh@samescope.demo` |

## Connect it to Claude (3 steps)

1. Open [claude.ai → Customize → Connectors](https://claude.ai/customize/connectors) and click **Add custom connector**.
2. Name it **SameScope**. Paste the MCP link below as the URL and click **Add**.
3. In a new chat, open **+ → Connectors**, make sure SameScope is on, and try a prompt below.

| MCP link | Acts as |
|----------|---------|
| `<APP_URL>/mcp/demo-home-7f3a9c2e51b84d06` | Priya, homeowner |
| `<APP_URL>/mcp/demo-pro-anita-6b2e9f14c8d37a50` | Anita Home Services, contractor |

Each account has its own link on the **Connect Claude** page after logging in. Works on all Claude plans (the free
plan allows one custom connector).

**Try as homeowner:**
> My bathroom wall is leaking into the bedroom. Here are 3 photos. Write a scope of work and post it on SameScope. I'm in HSR Layout, Bengaluru, budget around ₹40,000.

> Compare the quotes on my leak job and tell me who to hire.

**Try as contractor:**
> Show me open jobs on SameScope.

> Quote on the bathroom leak job: waterproofing ₹90 per sq ft, tiling ₹180 per sq ft, pipe repair ₹2,000. 5 days, 12 month warranty.

### MCP actions

| Action | Who | What it does |
|--------|-----|--------------|
| `create_job` | Homeowner | Saves a job with its scope (line items, quantities, units, site visit questions) as a draft and returns the review link. |
| `list_my_jobs` | Homeowner | Lists jobs with status, number of quotes and lowest total. |
| `get_quotes` | Homeowner | Returns every quote priced line by line, with days, warranty, visit fee, rating and notes, so Claude can explain the trade-offs. |
| `list_open_jobs` | Contractor | Lists open jobs in the contractor's city and trades, with every line item and its id. |
| `send_quote` | Contractor | Sends or revises a quote. Every line must be priced. A new quote uses 1 credit. |

Publishing and hiring are done by a person in the app on purpose: Claude drafts, people decide.

## No AI inside

- No AI SDKs in `package.json` or `package-lock.json` (no OpenAI, Anthropic, Gemini, LangChain, etc.).
- No AI API keys. The only environment variables are `DATABASE_URL`, `SESSION_SECRET` and `APP_URL` (see `.env.example`).
- The server never calls a model. MCP actions only validate input and read or write Postgres
  ([`app/mcp/[token]/route.ts`](app/mcp/%5Btoken%5D/route.ts), [`lib/data.ts`](lib/data.ts)).
- Matching is a filter on city and trade. "Cheapest line" is `Math.min`. All thinking happens in the user's own Claude.

Check it yourself:

```bash
grep -riE "openai|anthropic|langchain|genai|ai-sdk" package.json package-lock.json app lib scripts
```

## Business model

- **Homeowners:** free.
- **Contractors:** pay per quote sent (₹79 a credit, packs of 10). Revising a quote is free. Paying to quote, not
  per hire, means there is nothing to gain by taking the deal off the platform.
- **Running cost:** hosting, Postgres and photo storage. There is no AI cost, because each user's Claude plan pays for
  the thinking.

## Tech

- Next.js (App Router) and TypeScript, server actions for the app
- Postgres (Neon, Supabase or any Postgres)
- MCP over Streamable HTTP, built with the official `@modelcontextprotocol/sdk`, stateless, one endpoint per user token
- Hosted on Vercel

```
app/
  mcp/[token]/route.ts   MCP endpoint (5 actions)
  jobs/                  homeowner: list, edit scope, photos, compare quotes, hire
  leads/                 contractor: open jobs near me, quote form
  connect/               personal MCP link, connect steps, credits
lib/
  data.ts                all reads and writes, shared by the app and MCP
  schema.sql             tables
scripts/setup.mjs        creates tables and loads demo data
```

## Run locally

```bash
npm install
cp .env.example .env.local      # set DATABASE_URL
npm run db:setup                # tables + demo data (npm run db:reset to start fresh)
npm run dev
```

MCP endpoint locally: `http://localhost:3000/mcp/demo-home-7f3a9c2e51b84d06`. Claude needs an HTTPS URL, so test
connectors against the deployed app.

## Deploy (Vercel + Neon)

1. Import this repo in Vercel.
2. In the project, open **Storage → Create → Neon (Postgres)** and connect it. This sets `DATABASE_URL`.
3. Optional: add `SESSION_SECRET` (any long random string) and `APP_URL`. Without them the app derives the secret from
   the database URL and uses Vercel's production domain.
4. Deploy. The build creates the tables and loads the demo data on first run.
