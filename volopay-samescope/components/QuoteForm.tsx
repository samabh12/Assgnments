"use client";

import { useActionState, useState } from "react";
import { submitQuote } from "@/app/actions";
import { inr } from "@/lib/format";

type Item = { id: number; description: string; quantity: number; unit: string; notes: string };

export function QuoteForm({
  jobId,
  items,
  initial,
  disabled,
}: {
  jobId: number;
  items: Item[];
  initial: { prices: Record<number, number>; days_to_complete: number; warranty_months: number; visit_fee: number; note: string } | null;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState(submitQuote, undefined);
  const [prices, setPrices] = useState<Record<number, string>>(
    Object.fromEntries(items.map((it) => [it.id, initial?.prices[it.id] != null ? String(initial.prices[it.id]) : ""]))
  );
  const [days, setDays] = useState(String(initial?.days_to_complete ?? 2));
  const [warranty, setWarranty] = useState(String(initial?.warranty_months ?? 6));
  const [visit, setVisit] = useState(String(initial?.visit_fee ?? 0));
  const [note, setNote] = useState(initial?.note ?? "");
  const total = items.reduce((s, it) => s + (Number(prices[it.id]) || 0), 0);

  const payload = JSON.stringify({
    job_id: jobId,
    items: items.map((it) => ({ item_id: it.id, price: prices[it.id] === "" ? -1 : Number(prices[it.id]) })),
    days_to_complete: Number(days),
    warranty_months: Number(warranty),
    visit_fee: Number(visit),
    note,
  });

  return (
    <form action={action} className="stack">
      <input type="hidden" name="payload" value={payload} />
      <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Work</th><th className="num">Qty</th><th className="num" style={{ width: 150 }}>Your price (₹)</th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id}>
                  <td>
                    <b>{i + 1}.</b> {it.description}
                    {it.notes && <div className="small muted">{it.notes}</div>}
                  </td>
                  <td className="num">{it.quantity} {it.unit}</td>
                  <td>
                    <input type="number" min={0} required value={prices[it.id]} onChange={(e) => setPrices({ ...prices, [it.id]: e.target.value })} aria-label={`Price for line ${i + 1}`} style={{ textAlign: "right" }} />
                  </td>
                </tr>
              ))}
              <tr className="total"><td colSpan={2}>Total</td><td className="num">{inr(total)}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="grid-2">
          <div><label>Days to finish</label><input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} /></div>
          <div><label>Warranty (months)</label><input type="number" min={0} value={warranty} onChange={(e) => setWarranty(e.target.value)} /></div>
          <div><label>Site visit fee (₹, 0 if free)</label><input type="number" min={0} value={visit} onChange={(e) => setVisit(e.target.value)} /></div>
        </div>
        <div><label>Note to homeowner</label><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Materials, approach, answers to the site visit questions" /></div>
      </fieldset>
      {!disabled && (
        <div className="row">
          <button className="btn btn-primary" disabled={pending}>{pending ? "Sending…" : initial ? "Update quote" : "Send quote (1 credit)"}</button>
          {state?.ok && <span className="alert alert-ok">{state.ok}</span>}
          {state?.error && <span className="alert alert-err">{state.error}</span>}
        </div>
      )}
    </form>
  );
}
