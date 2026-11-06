"use client";

import { useActionState, useState } from "react";
import { saveJob } from "@/app/actions";
import { CATEGORIES, CITIES, UNITS, URGENCY } from "@/lib/constants";

export type EditableJob = {
  id?: number;
  title: string;
  category: string;
  city: string;
  locality: string;
  summary: string;
  urgency: string;
  budget_min: number | null;
  budget_max: number | null;
  site_visit_questions: string[];
  items: { description: string; quantity: number; unit: string; notes: string }[];
};

export function JobEditor({ job, locked, lockedLines }: { job: EditableJob; locked?: boolean; lockedLines?: boolean }) {
  const [state, action, pending] = useActionState(saveJob, undefined);
  const [j, setJ] = useState(job);
  const set = <K extends keyof EditableJob>(k: K, v: EditableJob[K]) => setJ((p) => ({ ...p, [k]: v }));
  const setItem = (i: number, k: string, v: string | number) =>
    setJ((p) => ({ ...p, items: p.items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)) }));

  const payload = JSON.stringify({
    ...j,
    budget_min: j.budget_min ?? undefined,
    budget_max: j.budget_max ?? undefined,
    site_visit_questions: j.site_visit_questions.map((q) => q.trim()).filter(Boolean),
  });

  return (
    <form action={action} className="stack">
      <input type="hidden" name="job_id" value={job.id ?? ""} />
      <input type="hidden" name="payload" value={payload} />
      <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
        <div>
          <label htmlFor="title">Title</label>
          <input id="title" value={j.title} onChange={(e) => set("title", e.target.value)} required />
        </div>
        <div className="grid-2">
          <div>
            <label htmlFor="category">Trade</label>
            <select id="category" value={j.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="urgency">When</label>
            <select id="urgency" value={j.urgency} onChange={(e) => set("urgency", e.target.value)}>
              {URGENCY.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="city">City</label>
            <select id="city" value={j.city} onChange={(e) => set("city", e.target.value)}>
              {(CITIES.includes(j.city) ? CITIES : [j.city, ...CITIES]).map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="locality">Area (no full address)</label>
            <input id="locality" value={j.locality} onChange={(e) => set("locality", e.target.value)} />
          </div>
          <div>
            <label htmlFor="bmin">Budget from (₹)</label>
            <input id="bmin" type="number" min={0} value={j.budget_min ?? ""} onChange={(e) => set("budget_min", e.target.value === "" ? null : Number(e.target.value))} />
          </div>
          <div>
            <label htmlFor="bmax">Budget up to (₹)</label>
            <input id="bmax" type="number" min={0} value={j.budget_max ?? ""} onChange={(e) => set("budget_max", e.target.value === "" ? null : Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label htmlFor="summary">What&apos;s wrong</label>
          <textarea id="summary" rows={3} value={j.summary} onChange={(e) => set("summary", e.target.value)} />
        </div>

        <div>
          <div className="row between">
            <label style={{ margin: 0 }}>Scope of work: every contractor prices each line</label>
            {!lockedLines && (
              <button type="button" className="btn btn-sm" onClick={() => set("items", [...j.items, { description: "", quantity: 1, unit: "job", notes: "" }])}>
                + Add line
              </button>
            )}
          </div>
          {lockedLines && <p className="small muted">Quotes have arrived, so lines can&apos;t be added, removed or re-measured. You can still fix wording.</p>}
          <div className="table-wrap">
            <table className="items-editor">
              <thead>
                <tr><th style={{ width: 28 }}>#</th><th>Work</th><th style={{ width: 90 }}>Qty</th><th style={{ width: 110 }}>Unit</th><th>Notes</th><th style={{ width: 40 }}></th></tr>
              </thead>
              <tbody>
                {j.items.map((it, i) => (
                  <tr key={i}>
                    <td className="muted">{i + 1}</td>
                    <td><textarea rows={1} value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} required /></td>
                    <td><input type="number" min={0} step="any" value={it.quantity} disabled={lockedLines} onChange={(e) => setItem(i, "quantity", Number(e.target.value))} /></td>
                    <td>
                      <select value={it.unit} disabled={lockedLines} onChange={(e) => setItem(i, "unit", e.target.value)}>
                        {(UNITS.includes(it.unit) ? UNITS : [it.unit, ...UNITS]).map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </td>
                    <td><textarea rows={1} value={it.notes} onChange={(e) => setItem(i, "notes", e.target.value)} /></td>
                    <td>
                      {!lockedLines && j.items.length > 1 && (
                        <button type="button" className="btn btn-sm btn-danger" aria-label="Remove line" onClick={() => set("items", j.items.filter((_, idx) => idx !== i))}>×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <label htmlFor="questions">Questions for the site visit (one per line)</label>
          <textarea
            id="questions"
            rows={3}
            value={j.site_visit_questions.join("\n")}
            onChange={(e) => set("site_visit_questions", e.target.value.split("\n"))}
          />
        </div>
      </fieldset>
      {!locked && (
        <div className="row">
          <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : job.id ? "Save changes" : "Create draft"}</button>
          {state?.ok && <span className="alert alert-ok">{state.ok}</span>}
          {state?.error && <span className="alert alert-err">{state.error}</span>}
        </div>
      )}
    </form>
  );
}
