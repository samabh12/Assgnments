import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { UserError, getLead } from "@/lib/data";
import { categoryLabel, urgencyLabel } from "@/lib/constants";
import { inr } from "@/lib/format";
import { QuoteForm } from "@/components/QuoteForm";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("contractor");
  const { id } = await params;
  let lead;
  try {
    lead = await getLead(user, Number(id));
  } catch (e) {
    if (e instanceof UserError) notFound();
    throw e;
  }
  const { job, items, mine, myPrices, owner, quotes, photos } = lead;
  const won = mine?.status === "accepted";
  return (
    <main className="container stack">
      <div>
        <Link href="/leads" className="small">← Jobs near me</Link>
        <div className="row between" style={{ marginTop: 6 }}>
          <h1 style={{ margin: 0 }}>{job.title}</h1>
          <StatusBadge status={job.status} />
        </div>
        <div className="kv" style={{ marginTop: 6 }}>
          <span>{categoryLabel(job.category)}</span>
          <span>{job.locality}, {job.city}</span>
          <span>{urgencyLabel(job.urgency)}</span>
          {(job.budget_min || job.budget_max) && <span>Budget {inr(job.budget_min)} – {inr(job.budget_max)}</span>}
          <span>{quotes} quote{quotes === 1 ? "" : "s"} so far</span>
        </div>
      </div>

      {won && owner && <div className="alert alert-ok">You got this job. Call {owner.name} on {owner.phone ?? "the number in your messages"} to fix a start date.</div>}
      {mine && mine.status === "declined" && <div className="alert">The homeowner hired someone else for this job.</div>}

      <div className="card">
        <h2>What&apos;s wrong</h2>
        <p>{job.summary || "No description."}</p>
        {job.site_visit_questions.length > 0 && (
          <>
            <h3>Questions to answer or check on the site visit</h3>
            <ul>{job.site_visit_questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
          </>
        )}
        {photos.length > 0 && (
          <div className="photos">
            {photos.map((pid) => (
              <a key={pid} href={`/photos/${pid}`} target="_blank" className="photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/photos/${pid}`} alt="Job photo" />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>{mine ? "Your quote" : "Price this scope"}</h2>
        <p className="small muted">Price every line, labour and material included. The homeowner compares all quotes line by line. Your phone number is shared only if you&apos;re hired.</p>
        <QuoteForm
          jobId={job.id}
          items={items.map((it) => ({ id: it.id, description: it.description, quantity: Number(it.quantity), unit: it.unit, notes: it.notes }))}
          initial={mine ? { prices: myPrices, days_to_complete: mine.days_to_complete, warranty_months: mine.warranty_months, visit_fee: mine.visit_fee, note: mine.note } : null}
          disabled={job.status !== "open"}
        />
      </div>
    </main>
  );
}
