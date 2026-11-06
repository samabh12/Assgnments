import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { appUrl } from "@/lib/data";
import { CREDIT_PRICE_INR } from "@/lib/constants";
import { inr } from "@/lib/format";
import { CopyField } from "@/components/CopyField";
import { buyCredits, rotateToken } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ConnectPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await currentUser();
  const sp = await searchParams;
  const url = user ? `${appUrl()}/mcp/${user.mcp_token}` : null;
  const isPro = user?.role === "contractor";

  return (
    <main className="container stack" style={{ maxWidth: 820 }}>
      {sp.welcome && <div className="alert alert-ok">Account created. Connect Claude below to get started.</div>}
      {sp.rotated && <div className="alert alert-ok">New link created. The old link no longer works: update it in Claude.</div>}
      {sp.credits && <div className="alert alert-ok">10 credits added (demo mode, no payment taken).</div>}

      <div>
        <h1>Connect SameScope to Claude</h1>
        <p className="muted">
          SameScope has no AI inside. Your own Claude does the thinking: it reads your photos and writes the scope
          {isPro ? " or drafts your quote" : ""}. SameScope saves it, sends it to the right people and keeps it live.
        </p>
      </div>

      <div className="card">
        <h2>1. Copy your personal link</h2>
        {url ? (
          <>
            <CopyField value={url} />
            <p className="small muted" style={{ marginTop: 8 }}>
              This link is tied to your {isPro ? "contractor" : "homeowner"} account. Keep it private.{" "}
            </p>
            <form action={rotateToken}><button className="btn btn-sm">Create a new link</button></form>
          </>
        ) : (
          <p><Link href="/login">Log in</Link> to see your personal link. Test logins are on the login page.</p>
        )}
      </div>

      <div className="card">
        <h2>2. Add it to Claude</h2>
        <ol>
          <li>Open <a href="https://claude.ai/customize/connectors" target="_blank" rel="noreferrer">claude.ai → Customize → Connectors</a>.</li>
          <li>Click <b>Add custom connector</b>. Name it <b>SameScope</b> and paste your link as the URL. Leave sign-in settings as they are.</li>
          <li>Click <b>Add</b>. In a new chat, open the <b>+</b> menu → <b>Connectors</b> and make sure SameScope is on.</li>
        </ol>
        <p className="small muted">Works on every Claude plan. The free plan allows one custom connector. Team and Enterprise owners add it under Organization settings → Connectors.</p>
      </div>

      <div className="card">
        <h2>3. Try it</h2>
        {isPro ? (
          <div className="stack">
            <div className="prompt">Show me open jobs on SameScope.</div>
            <div className="prompt">Quote on the bathroom leak job: my rate for waterproofing is ₹90 per sq ft, tiling ₹180 per sq ft, pipe repair ₹2,000. 5 days, 12 month warranty.</div>
          </div>
        ) : (
          <div className="stack">
            <div className="prompt">My bathroom wall is leaking into the bedroom. Here are 3 photos. Write a scope of work and post it on SameScope. I&apos;m in HSR Layout, Bengaluru, budget around ₹40,000.</div>
            <div className="prompt">Compare the quotes on my leak job and tell me who to hire.</div>
          </div>
        )}
      </div>

      {isPro && user && (
        <div className="card">
          <h2>Quote credits</h2>
          <p>You have <b>{user.credits}</b> credits. Sending a new quote uses 1 credit ({inr(CREDIT_PRICE_INR)}). Revising a quote is free.</p>
          <form action={buyCredits}><button className="btn">Add 10 credits ({inr(CREDIT_PRICE_INR * 10)}, demo: no payment)</button></form>
        </div>
      )}
    </main>
  );
}
