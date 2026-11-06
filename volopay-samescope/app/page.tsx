import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { DemoLogins } from "@/components/DemoLogins";

export default async function Home() {
  const user = await currentUser();
  return (
    <main className="container">
      <section className="hero">
        <span className="badge badge-open">Home repairs · Bengaluru</span>
        <h1 style={{ marginTop: 12 }}>Every contractor quotes the same job. You compare like for like.</h1>
        <p className="lead">
          Show your leaking wall to Claude. Claude writes a clear scope of work and sends it here. Local contractors price
          every line of that same scope, and you pick the best one. No spam calls, and no five quotes for five different jobs.
        </p>
        <div className="row" style={{ marginTop: 16 }}>
          {user ? (
            <Link className="btn btn-primary" href={user.role === "homeowner" ? "/jobs" : "/leads"}>Go to my dashboard</Link>
          ) : (
            <>
              <Link className="btn btn-primary" href="/signup">Get started</Link>
              <Link className="btn" href="/login">Log in</Link>
            </>
          )}
          <Link className="btn" href="/connect">Connect Claude</Link>
        </div>
      </section>

      <section className="grid-3">
        <div className="card">
          <div className="step-num">1</div>
          <h3>Tell Claude the problem</h3>
          <p className="muted">&ldquo;My bathroom wall leaks into the bedroom, here are 4 photos.&rdquo; Claude works out the likely cause and writes the scope as line items.</p>
        </div>
        <div className="card">
          <div className="step-num">2</div>
          <h3>Check it and publish</h3>
          <p className="muted">The scope lands here as a draft. Edit any line, add photos, then publish it to verified contractors in your area and trade.</p>
        </div>
        <div className="card">
          <div className="step-num">3</div>
          <h3>Compare and hire</h3>
          <p className="muted">Contractors price each line. You see them side by side with the cheapest line highlighted, then hire one. Phone numbers are shared only then.</p>
        </div>
      </section>

      <section className="grid-2" style={{ marginTop: 24 }}>
        <div className="card">
          <h2>Why not just ask Claude?</h2>
          <p className="muted">
            Claude can describe the job, but it doesn&apos;t know any plumbers in HSR Layout. SameScope is the network: it
            keeps your job live for days, sends it to the right contractors, collects their quotes on the same lines,
            and records who you hired.
          </p>
          <h2 style={{ marginTop: 16 }}>For contractors</h2>
          <p className="muted">
            Every lead comes with a written scope, photos and a budget, so you know the job before you travel. You pay
            per quote you send, not for leads that are sold to ten others. Your own Claude can read the scope and draft
            the quote for you.
          </p>
        </div>
        <DemoLogins />
      </section>
    </main>
  );
}
