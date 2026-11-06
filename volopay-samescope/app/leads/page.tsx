import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listLeads } from "@/lib/data";
import { categoryLabel, urgencyLabel } from "@/lib/constants";
import { inr, timeAgo } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const user = await requireUser("contractor");
  const leads = await listLeads(user);
  const open = leads.filter((l) => l.status === "open" && !l.my_quote_id);
  const mine = leads.filter((l) => l.my_quote_id);
  return (
    <main className="container stack">
      <div className="row between">
        <div>
          <h1>Jobs near me</h1>
          <p className="muted" style={{ margin: 0 }}>
            Open jobs in {user.city} for {user.trades.map(categoryLabel).join(", ").toLowerCase() || "your trades"}. You have <b>{user.credits}</b> quote credits.
          </p>
        </div>
        <Link className="btn" href="/connect">Quote from Claude</Link>
      </div>

      <h2>New jobs ({open.length})</h2>
      {open.length === 0 && <div className="card muted">No new jobs right now. You&apos;ll see them here as soon as homeowners publish.</div>}
      <div className="job-list">
        {open.map((j) => (
          <Link key={j.id} href={`/leads/${j.id}`} className="card job-row">
            <div className="row between">
              <h2 style={{ margin: 0 }}>{j.title}</h2>
              <span className="badge badge-open">{urgencyLabel(j.urgency)}</span>
            </div>
            <p className="muted small" style={{ margin: "6px 0" }}>{j.summary}</p>
            <div className="kv">
              <span>{categoryLabel(j.category)}</span>
              <span>{j.locality}</span>
              <span><b>{j.items.length}</b> lines to price</span>
              {(j.budget_min || j.budget_max) && <span>Budget {inr(j.budget_min)} – {inr(j.budget_max)}</span>}
              <span>{j.quotes} quote{j.quotes === 1 ? "" : "s"} so far</span>
              {j.published_at && <span>Posted {timeAgo(j.published_at)}</span>}
            </div>
          </Link>
        ))}
      </div>

      <h2 style={{ marginTop: 24 }}>My quotes ({mine.length})</h2>
      <div className="job-list">
        {mine.map((j) => (
          <Link key={j.id} href={`/leads/${j.id}`} className="card job-row">
            <div className="row between">
              <h3 style={{ margin: 0 }}>{j.title}</h3>
              <div className="row">
                <span className="small">My total <b>{inr(j.my_total)}</b></span>
                <StatusBadge status={j.status} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
