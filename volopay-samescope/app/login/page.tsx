import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { DemoLogins } from "@/components/DemoLogins";

export default function LoginPage() {
  return (
    <main className="container narrow stack">
      <div className="card">
        <h1>Log in</h1>
        <LoginForm />
        <p className="small muted" style={{ marginTop: 12 }}>New here? <Link href="/signup">Create an account</Link></p>
      </div>
      <DemoLogins />
    </main>
  );
}
