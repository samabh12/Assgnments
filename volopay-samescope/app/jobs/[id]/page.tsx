import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { UserError, compareQuotes, getEvents, getPhotoIds } from "@/lib/data";
import { categoryLabel, urgencyLabel } from "@/lib/constants";
import { inr, timeAgo } from "@/lib/format";
import { JobEditor } from "@/components/JobEditor";
import { ClaudeBadge, StatusBadge } from "@/components/StatusBadge";
import { changeStatus, hire, removePhoto, uploadPhotos } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("homeowner");
  const { id } = await params;
  const sp = await searchParams;
  let data;
  try {
    data = await compareQuotes(user, Number(id));
  } catch (e) {
    if (e instanceof UserError) notFound();
    throw e;
  }
  const { job, items, quotes, lowestPerItem, lowestTotal } = data;
  const [photos, events] = await Promise.all([getPhotoIds(job.id), getEvents(job.id)]);
  const editable = job.status === "draft" || job.status === "open";
  const hired = quotes.find((q) => q.id === job.hired_quote_id);

  return (
    <main className="container stack">
      <div>
        <Link href="/jobs" className="small">← My jobs</Link>
        <div className="row between" style={{ marginTop: 6 }}>
          <h1 style={{ margin: 0 }}>{job.title}</h1>
          <div className="row"><StatusBadge status={job.status} />{job.created_via === "claude" && <ClaudeBadge />}</div>
        </div>
        <div className="kv" style={{ marginTop: 6 }}>
          <span>{categoryLabel(job.category)}</span>
          <span>{job.locality ? `${job.locality}, ` : ""}{job.city}</span>
          <span>{urgencyLabel(job.urgency)}</span>
          {(job.budget_min || job.budget_max) && <span>Budget {inr(job.budget_min)} – {inr(job.budget_max)}</span>}
        </div>
      </div>

      {sp.error && <div className="alert alert-err">{sp.error}</div>}
      {sp.published && <div className="alert alert-ok">Published. Contractors in {job.city} who do {categoryLabel(job.category).toLowerCase()} can now see it and send quotes.</div>}
      {sp.hired && hired && <div className="alert alert-ok">You hired {hired.contractor.business}. Their phone number is below, and they can now see yours.</div>}

      {job.status === "draft" && (
        <div className="card row between" style={{ background: "var(--warn-soft)" }}>
          <div>
            <h3 style={{ margin: 0 }}>This is a draft. Contractors can&apos;t see it yet.</h3>
            <p className="small muted" style={{ margin: 0 }}>Check the scope, fix anything that&apos;s wrong, add photos, then publish.</p>
          </div>
          <form action={changeStatus}>
            <input type="hidden" name="job_id" value={job.id} />
            <input type="hidden" name="status" value="open" />
            <button className="btn btn-primary">Publish to contractors</button>
          </form>
        </div>
      )}

      {/* Quotes */}
      {job.status !== "draft" && (
        <div className="card" id="quotes">
          <div className="row between">
            <h2 style={{ margin: 0 }}>Quotes ({quotes.length})</h2>
            {job.status === "open" && (
              <form action={changeStatus}>
                <input type="hidden" name="job_id" value={job.id} />
                <input type="hidden" name="status" value="closed" />
                <button className="btn btn-sm">Close job</button>
              </form>
            )}
          </div>
          {quotes.length === 0 ? (
            <p className="muted" style={{ marginTop: 10 }}>Waiting for quotes. Contractors usually reply within a few hours.</p>
          ) : (
            <>
              <p className="small muted" style={{ marginTop: 6 }}>Every contractor priced the same lines. The lowest price on each line is highlighted in green.</p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Work</th>
                      {quotes.map((q) => (
                        <th key={q.id} className="num" style={{ textTransform: "none", letterSpacing: 0, color: "var(--text)" }}>
                          {q.contractor.business}
                          <div className="small muted" style={{ fontWeight: 500 }}>
                            {q.contractor.rating ? `★ ${q.contractor.rating}` : "New"} · {q.contractor.jobs_completed} jobs
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td>{it.description}<div className="small muted">{Number(it.quantity)} {it.unit}</div></td>
                        {quotes.map((q) => (
                          <td key={q.id} className={`num ${quotes.length > 1 && q.prices[it.id] === lowestPerItem[it.id] ? "cell-best" : ""}`}>{inr(q.prices[it.id])}</td>
                        ))}
                      </tr>
                    ))}
                    <tr className="total">
                      <td>Total</td>
                      {quotes.map((q) => (
                        <td key={q.id} className={`num ${quotes.length > 1 && q.total === lowestTotal ? "cell-best" : ""}`}>{inr(q.total)}</td>
                      ))}
                    </tr>
                    <tr><td className="muted">Days to finish</td>{quotes.map((q) => <td key={q.id} className="num">{q.days_to_complete}</td>)}</tr>
                    <tr><td className="muted">Warranty</td>{quotes.map((q) => <td key={q.id} className="num">{q.warranty_months ? `${q.warranty_months} months` : "None"}</td>)}</tr>
                    <tr><td className="muted">Site visit fee</td>{quotes.map((q) => <td key={q.id} className="num">{q.visit_fee ? inr(q.visit_fee) : "Free"}</td>)}</tr>
                    <tr>
                      <td className="muted">Note</td>
                      {quotes.map((q) => <td key={q.id} className="small" style={{ minWidth: 180 }}>{q.note || "–"}</td>)}
                    </tr>
                    <tr>
                      <td></td>
                      {quotes.map((q) => (
                        <td key={q.id} className="num">
                          {job.status === "open" ? (
                            <form action={hire}>
                              <input type="hidden" name="job_id" value={job.id} />
                              <input type="hidden" name="quote_id" value={q.id} />
                              <button className="btn btn-primary btn-sm">Hire</button>
                            </form>
                          ) : q.status === "accepted" ? (
                            <div><span className="badge badge-hired">Hired</span>{q.contractor.phone && <div className="small" style={{ marginTop: 4 }}>{q.contractor.phone}</div>}</div>
                          ) : (
                            <span className="small muted">Not chosen</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <h2>Scope of work</h2>
          <JobEditor
            locked={!editable}
            lockedLines={quotes.length > 0}
            job={{
              id: job.id,
              title: job.title,
              category: job.category,
              city: job.city,
              locality: job.locality,
              summary: job.summary,
              urgency: job.urgency,
              budget_min: job.budget_min,
              budget_max: job.budget_max,
              site_visit_questions: job.site_visit_questions,
              items: items.map((it) => ({ description: it.description, quantity: Number(it.quantity), unit: it.unit, notes: it.notes })),
            }}
          />
        </div>

        <div className="card" id="photos">
          <h2>Photos</h2>
          {photos.length === 0 && <p className="small muted">No photos yet. Contractors quote more accurately with 2 to 4 clear photos.</p>}
          <div className="photos">
            {photos.map((pid) => (
              <div key={pid} className="photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/photos/${pid}`} alt="Job photo" />
                {editable && (
                  <form action={removePhoto}>
                    <input type="hidden" name="job_id" value={job.id} />
                    <input type="hidden" name="photo_id" value={pid} />
                    <button className="btn btn-sm" aria-label="Remove photo">×</button>
                  </form>
                )}
              </div>
            ))}
          </div>
          {editable && (
            <form action={uploadPhotos} className="row" style={{ marginTop: 12 }}>
              <input type="hidden" name="job_id" value={job.id} />
              <input type="file" name="photos" accept="image/*" multiple style={{ flex: 1, minWidth: 200 }} />
              <button className="btn">Upload</button>
            </form>
          )}
        </div>

        <div className="card">
          <h2>Activity</h2>
          <ul className="timeline">
            {events.map((e, i) => (
              <li key={i}><span>{e.message}</span><span className="muted small" style={{ whiteSpace: "nowrap" }}>{timeAgo(e.created_at)}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
