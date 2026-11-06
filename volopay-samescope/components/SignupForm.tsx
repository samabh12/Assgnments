"use client";

import { useActionState, useState } from "react";
import { signup } from "@/app/actions";
import { CATEGORIES, CITIES } from "@/lib/constants";

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);
  const [role, setRole] = useState<"homeowner" | "contractor">("homeowner");
  return (
    <form action={action} className="stack">
      {state?.error && <div className="alert alert-err">{state.error}</div>}
      <div className="row">
        <label className="check"><input type="radio" name="role" value="homeowner" checked={role === "homeowner"} onChange={() => setRole("homeowner")} /> I need work done</label>
        <label className="check"><input type="radio" name="role" value="contractor" checked={role === "contractor"} onChange={() => setRole("contractor")} /> I&apos;m a contractor</label>
      </div>
      <div className="grid-2">
        <div><label htmlFor="name">Your name</label><input id="name" name="name" required /></div>
        <div><label htmlFor="phone">Phone</label><input id="phone" name="phone" placeholder="Shared only after hiring" /></div>
      </div>
      {role === "contractor" && (
        <div><label htmlFor="business_name">Business name</label><input id="business_name" name="business_name" /></div>
      )}
      <div><label htmlFor="email">Email</label><input id="email" name="email" type="email" required /></div>
      <div><label htmlFor="password">Password</label><input id="password" name="password" type="password" minLength={8} required /></div>
      <div>
        <label htmlFor="city">City</label>
        <select id="city" name="city" defaultValue="Bengaluru">{CITIES.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      {role === "contractor" && (
        <div>
          <label>Trades you work in</label>
          <div className="checks">
            {CATEGORIES.map((c) => (
              <label key={c.id} className="check"><input type="checkbox" name="trades" value={c.id} /> {c.label}</label>
            ))}
          </div>
        </div>
      )}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
    </form>
  );
}
