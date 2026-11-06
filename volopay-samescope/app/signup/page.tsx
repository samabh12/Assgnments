import Link from "next/link";
import { SignupForm } from "@/components/SignupForm";

export default function SignupPage() {
  return (
    <main className="container narrow">
      <div className="card">
        <h1>Create an account</h1>
        <SignupForm />
        <p className="small muted" style={{ marginTop: 12 }}>Already have one? <Link href="/login">Log in</Link></p>
      </div>
    </main>
  );
}
