import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listOwnerJobs } from "@/lib/data";
import { categoryLabel } from "@/lib/constants";
import { inr, timeAgo } from "@/lib/format";
import { ClaudeBadge, StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const user = await requireUser("homeowner");
  const jobs = await listOwnerJobs(user);
  return (
    <main className="container stack">
      <div className="row between">
        <div>
          <h1>My jobs</h1>
          <p className="muted" style={{ margin: 0 }}>Ask Claude to write a scope and it shows up here, or start one by hand.</p>
        </div>
        <div className="row">
          <Link className="btn" href="/connect">Connect Claude</Link>
          <Link className="btn btn-primary" href="/jobs/new">New job</Link>
        </div>
      </div>
      {jobs.length === 0 ? (
        <div className="card">
          <h2>No jobs yet</h2>
          <p className="muted">Connect SameScope to Claude, then try: &ldquo;My bathroom wall is leaking into the bedroom. Write a scope of work and post it on SameScope.&rdquo;</p>
        </div>
      ) : (
        <div className="job-list">
          {jobs.map((j) => (
            <Link key={j.id} href={`/jobs/${j.id}`} className="card job-row">
              <div className="row between">
                <h2 style={{ margin: 0 }}>{j.title}</h2>
                <div className="row"><StatusBadge status={j.status} />{j.created_via === "claude" && <ClaudeBadge />}</div>
              </div>
              <div className="kv" style={{ marginTop: 8 }}>
                <span>{categoryLabel(j.category)}</span>
                <span>{j.locality || j.city}</span>
                <span><b>{j.quotes}</b> quote{j.quotes === 1 ? "" : "s"}</span>
                {j.lowest_total != null && <span>Lowest <b>{inr(j.lowest_total)}</b></span>}
                <span>Updated {timeAgo(j.updated_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
