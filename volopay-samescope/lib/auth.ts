import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";

const COOKIE = "ss_session";

function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  // Fallback so a fresh deploy works with only DATABASE_URL set: derive a key from the (secret) connection string.
  if (process.env.DATABASE_URL) return crypto.createHash("sha256").update("samescope-session:" + process.env.DATABASE_URL).digest("hex");
  return "dev-only-secret";
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

export type User = {
  id: number;
  email: string;
  name: string;
  role: "homeowner" | "contractor";
  phone: string | null;
  city: string;
  business_name: string | null;
  trades: string[];
  credits: number;
  jobs_completed: number;
  rating: string | null;
  mcp_token: string;
};

export async function createSession(userId: number) {
  const value = `${userId}.${Date.now()}`;
  const jar = await cookies();
  jar.set(COOKIE, `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const value = `${parts[0]}.${parts[1]}`;
  const expected = sign(value);
  if (expected.length !== parts[2].length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))) {
    return null;
  }
  const [user] = await sql<User[]>`select * from users where id = ${Number(parts[0])}`;
  return user ?? null;
}

export async function requireUser(role?: User["role"]) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (role && user.role !== role) redirect(user.role === "homeowner" ? "/jobs" : "/leads");
  return user;
}

export function newToken(prefix: string) {
  return `${prefix}-${crypto.randomBytes(16).toString("hex")}`;
}

export async function userByToken(token: string) {
  const [user] = await sql<User[]>`select * from users where mcp_token = ${token}`;
  return user ?? null;
}
