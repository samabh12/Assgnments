import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { logout } from "./actions";

export const metadata: Metadata = {
  title: "SameScope",
  description: "Describe a home repair to Claude. Local contractors quote on the same scope. Compare like for like and hire.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <div className="nav-inner">
            <Link href="/" className="brand">
              <span className="brand-mark">S</span> SameScope
            </Link>
            {user && (
              <div className="nav-links">
                {user.role === "homeowner" ? <Link href="/jobs">My jobs</Link> : <Link href="/leads">Jobs near me</Link>}
                <Link href="/connect">Connect Claude</Link>
              </div>
            )}
            <div className="nav-right">
              {user ? (
                <>
                  <span>
                    {user.business_name ?? user.name}
                    {user.role === "contractor" && ` · ${user.credits} credits`}
                  </span>
                  <form action={logout}>
                    <button className="btn btn-sm">Log out</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn btn-sm">Log in</Link>
                  <Link href="/signup" className="btn btn-sm btn-primary">Sign up</Link>
                </>
              )}
            </div>
          </div>
        </nav>
        {children}
        <footer className="foot">SameScope · Claude writes the scope, local contractors quote on it. No AI runs inside this app.</footer>
      </body>
    </html>
  );
}
