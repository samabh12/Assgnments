// Creates the tables and loads demo data.
// Usage: DATABASE_URL=... node scripts/setup.mjs [--reset]
// --reset drops all tables first (wipes everything).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import bcrypt from "bcryptjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL;
if (!url) {
  console.warn("DATABASE_URL is not set, skipping database setup");
  process.exit(0);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
const reset = process.argv.includes("--reset");

if (reset) {
  await sql.unsafe(
    "drop table if exists events, quote_items, quotes, photos, job_items, jobs, users cascade"
  );
  console.log("Dropped tables");
}
await sql.unsafe(fs.readFileSync(path.join(here, "..", "lib", "schema.sql"), "utf8"));
console.log("Schema ready");

const [{ count }] = await sql`select count(*)::int as count from users`;
if (count > 0) {
  console.log("Users already exist, skipping demo data (use --reset to start fresh)");
  await sql.end();
  process.exit(0);
}

const hash = await bcrypt.hash("Demo@1234", 10);

// Fixed demo tokens so the MCP links in the README stay stable.
const users = [
  { key: "home", email: "homeowner@samescope.demo", name: "Priya Sharma", role: "homeowner", phone: "+91 98450 11223", token: "demo-home-7f3a9c2e51b84d06", trades: [] },
  { key: "home2", email: "arjun@samescope.demo", name: "Arjun Mehta", role: "homeowner", phone: "+91 99000 44556", token: "demo-home2-1c8e4f7a20d93b65", trades: [] },
  { key: "home3", email: "lakshmi@samescope.demo", name: "Lakshmi Rao", role: "homeowner", phone: "+91 97411 78901", token: "demo-home3-5d2b8a1e7c6f4093", trades: [] },
  { key: "ravi", email: "ravi@samescope.demo", name: "Ravi Kumar", business: "Ravi Waterproofing Works", role: "contractor", phone: "+91 98861 22334", token: "demo-pro-ravi-a41f6d93e2c75b08", trades: ["waterproofing", "leaks_plumbing", "bathroom_tiling"], jobs: 112, rating: 4.6, credits: 14 },
  { key: "anita", email: "anita@samescope.demo", name: "Anita Joseph", business: "Anita Home Services", role: "contractor", phone: "+91 90080 55667", token: "demo-pro-anita-6b2e9f14c8d37a50", trades: ["leaks_plumbing", "waterproofing", "painting", "carpentry"], jobs: 64, rating: 4.8, credits: 10 },
  { key: "suresh", email: "suresh@samescope.demo", name: "Suresh Gowda", business: "Suresh & Sons Builders", role: "contractor", phone: "+91 96320 88990", token: "demo-pro-suresh-3e7c1a95f60b2d84", trades: ["waterproofing", "bathroom_tiling", "renovation", "leaks_plumbing"], jobs: 238, rating: 4.4, credits: 22 },
];

const ids = {};
for (const u of users) {
  const [row] = await sql`
    insert into users (email, name, password_hash, role, phone, city, business_name, trades, credits, jobs_completed, rating, mcp_token)
    values (${u.email}, ${u.name}, ${hash}, ${u.role}, ${u.phone}, 'Bengaluru', ${u.business ?? null},
            ${u.trades}, ${u.credits ?? 10}, ${u.jobs ?? 0}, ${u.rating ?? null}, ${u.token})
    returning id`;
  ids[u.key] = row.id;
}

async function job(owner, j, items, status = "open") {
  const [row] = await sql`
    insert into jobs (owner_id, title, category, city, locality, summary, urgency, budget_min, budget_max,
                      site_visit_questions, status, created_via, published_at, created_at, updated_at)
    values (${owner}, ${j.title}, ${j.category}, 'Bengaluru', ${j.locality}, ${j.summary}, ${j.urgency},
            ${j.budget_min ?? null}, ${j.budget_max ?? null}, ${j.questions ?? []}, ${status}, 'claude',
            ${status === "draft" ? null : sql`now() - ${j.age ?? "1 day"}::interval`},
            now() - ${j.age ?? "1 day"}::interval, now() - ${j.age ?? "1 day"}::interval)
    returning id`;
  const itemIds = [];
  for (const [i, it] of items.entries()) {
    const [r] = await sql`
      insert into job_items (job_id, position, description, quantity, unit, notes)
      values (${row.id}, ${i}, ${it[0]}, ${it[1]}, ${it[2]}, ${it[3] ?? ""}) returning id`;
    itemIds.push(r.id);
  }
  await sql`insert into events (job_id, message, created_at) values (${row.id}, 'Scope written in Claude and saved as a draft', now() - ${j.age ?? "1 day"}::interval)`;
  if (status !== "draft") {
    await sql`insert into events (job_id, message, created_at) values (${row.id}, 'Published to local contractors', now() - ${j.age ?? "1 day"}::interval)`;
  }
  return { id: row.id, itemIds };
}

async function quote(jobRef, contractor, prices, extra) {
  const [q] = await sql`
    insert into quotes (job_id, contractor_id, days_to_complete, warranty_months, visit_fee, note, created_via, status)
    values (${jobRef.id}, ${contractor}, ${extra.days}, ${extra.warranty}, ${extra.visit ?? 0}, ${extra.note ?? ""},
            ${extra.via ?? "app"}, ${extra.status ?? "submitted"})
    returning id`;
  for (const [i, p] of prices.entries()) {
    await sql`insert into quote_items (quote_id, job_item_id, price) values (${q.id}, ${jobRef.itemIds[i]}, ${p})`;
  }
  const [c] = await sql`select coalesce(business_name, name) as n from users where id = ${contractor}`;
  await sql`insert into events (job_id, message) values (${jobRef.id}, ${"Quote received from " + c.n})`;
  return q.id;
}

// Priya's job: the one used in the demo. Two quotes already in, Anita can quote live.
const priya = await job(ids.home, {
  title: "Fix leak behind master bathroom wall",
  category: "waterproofing",
  locality: "HSR Layout, Sector 2",
  summary:
    "Damp patch and peeling paint on the bedroom wall that backs onto the master bathroom. Likely cause is failed waterproofing or a cracked concealed pipe behind the shower area. Building is about 12 years old.",
  urgency: "this_week",
  budget_min: 25000,
  budget_max: 45000,
  questions: [
    "Is the leak from the concealed pipe or from failed floor waterproofing? Please confirm with a pressure test.",
    "Will you need to break wall tiles in the shower area, and can you match the existing tiles?",
    "Does your price include repainting the bedroom wall after it dries?",
  ],
  age: "20 hours",
}, [
  ["Pressure test concealed pipes and locate the leak", 1, "job", "Thermal or moisture meter preferred"],
  ["Remove and replace damaged wall and floor tiles in shower area", 40, "sq ft", "Homeowner has 6 spare tiles"],
  ["Apply waterproofing coat on floor and 3 ft of wall", 60, "sq ft", "Two coats, with 48h ponding test"],
  ["Replace cracked concealed pipe section if found", 1, "job", "CPVC"],
  ["Scrape, treat and repaint damp bedroom wall", 110, "sq ft", "Anti-damp primer + matching emulsion"],
]);
await quote(priya, ids.ravi, [800, 7200, 5400, 2500, 3300], { days: 4, warranty: 12, visit: 0, note: "Includes 48h ponding test. Tiles matched from local stock where possible.", via: "claude" });
await quote(priya, ids.suresh, [1500, 6000, 7800, 1800, 2900], { days: 6, warranty: 24, visit: 300, note: "Using Dr. Fixit-grade membrane, 2 year written warranty. Visit fee adjusted in final bill." });

// Other homeowners' jobs, so contractors see a live feed.
const kitchen = await job(ids.home2, {
  title: "Kitchen sink keeps backing up",
  category: "leaks_plumbing",
  locality: "Indiranagar 2nd Stage",
  summary: "Kitchen sink drains very slowly and water backs up into the dishwasher outlet. Started 2 weeks ago, worse in the evenings.",
  urgency: "urgent",
  budget_min: 1500,
  budget_max: 5000,
  questions: ["Is the block in the trap or further down the main line?"],
  age: "3 hours",
}, [
  ["Clear blockage in sink trap and drain line", 1, "job", ""],
  ["Replace corroded sink trap and waste pipe", 1, "piece", "If needed"],
  ["Check dishwasher outlet connection", 1, "job", ""],
]);
await quote(kitchen, ids.anita, [900, 1400, 300], { days: 1, warranty: 3, note: "Can come tomorrow morning." });

await job(ids.home3, {
  title: "Terrace seepage into top-floor ceiling",
  category: "waterproofing",
  locality: "Jayanagar 4th Block",
  summary: "Brown patches on the top-floor ceiling after every rain. Terrace has old brick-bat coba, some cracks visible.",
  urgency: "this_month",
  budget_min: 60000,
  budget_max: 120000,
  questions: ["Do you recommend a full membrane or crack filling plus coating?", "How long must the terrace stay unused?"],
  age: "2 days",
}, [
  ["Clean terrace and fill cracks", 900, "sq ft", ""],
  ["Apply waterproof membrane with fibre mesh", 900, "sq ft", ""],
  ["Treat and repaint affected ceiling", 220, "sq ft", ""],
]);

await job(ids.home2, {
  title: "Re-tile guest bathroom floor",
  category: "bathroom_tiling",
  locality: "Indiranagar 2nd Stage",
  summary: "Old floor tiles are loose and two are cracked. Want anti-skid tiles, same layout.",
  urgency: "flexible",
  budget_min: 18000,
  budget_max: 30000,
  age: "5 hours",
}, [
  ["Remove existing floor tiles", 45, "sq ft", ""],
  ["Lay new anti-skid tiles (tiles supplied by homeowner)", 45, "sq ft", ""],
  ["Grouting and cleanup", 1, "job", ""],
]);

// A finished job, to show the hire step.
const done = await job(ids.home3, {
  title: "Repaint living room and fix wall cracks",
  category: "painting",
  locality: "Jayanagar 4th Block",
  summary: "Hairline cracks on two walls, repaint whole living room in light grey.",
  urgency: "flexible",
  age: "9 days",
}, [
  ["Fill and sand hairline cracks", 2, "job", ""],
  ["Two coats of emulsion, walls", 650, "sq ft", ""],
], "hired");
const won = await quote(done, ids.anita, [1200, 11050], { days: 3, warranty: 6, status: "accepted" });
await sql`update jobs set hired_quote_id = ${won} where id = ${done.id}`;
await sql`insert into events (job_id, message) values (${done.id}, 'Hired Anita Home Services')`;

console.log("Demo data loaded. Login password for all demo users: Demo@1234");
await sql.end();
