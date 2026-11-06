"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { createSession, destroySession, newToken, requireUser } from "@/lib/auth";
import {
  UserError,
  addPhoto,
  createJob,
  deletePhoto,
  hireQuote,
  jobInput,
  quoteInput,
  sendQuote,
  setJobStatus,
  updateJob,
} from "@/lib/data";
import { CATEGORY_IDS } from "@/lib/constants";

export type FormState = { error?: string; ok?: string } | undefined;

function message(e: unknown) {
  if (e instanceof UserError) return e.message;
  if (e instanceof z.ZodError) return e.issues.map((i) => `${i.path.join(" ") || "Form"}: ${i.message}`).join(". ");
  console.error(e);
  return "Something went wrong. Please try again.";
}

// ---------- Auth ----------

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const [user] = await sql<{ id: number; password_hash: string; role: string }[]>`select id, password_hash, role from users where email = ${email}`;
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return { error: "Wrong email or password." };
  await createSession(user.id);
  redirect(user.role === "homeowner" ? "/jobs" : "/leads");
}

const signupInput = z.object({
  role: z.enum(["homeowner", "contractor"]),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().trim().max(30).optional(),
  city: z.string().trim().min(2).max(60),
  business_name: z.string().trim().max(100).optional(),
  trades: z.array(z.enum(CATEGORY_IDS)).default([]),
});

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  try {
    const input = signupInput.parse({
      role: form.get("role"),
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      phone: form.get("phone") || undefined,
      city: form.get("city"),
      business_name: form.get("business_name") || undefined,
      trades: form.getAll("trades"),
    });
    if (input.role === "contractor" && input.trades.length === 0) return { error: "Pick at least one trade you work in." };
    const [exists] = await sql`select 1 from users where email = ${input.email}`;
    if (exists) return { error: "An account with this email already exists. Log in instead." };
    const hash = await bcrypt.hash(input.password, 10);
    const [user] = await sql<{ id: number }[]>`
      insert into users (email, name, password_hash, role, phone, city, business_name, trades, mcp_token)
      values (${input.email}, ${input.name}, ${hash}, ${input.role}, ${input.phone ?? null}, ${input.city},
              ${input.role === "contractor" ? input.business_name ?? null : null}, ${input.role === "contractor" ? input.trades : []},
              ${newToken(input.role === "homeowner" ? "home" : "pro")})
      returning id`;
    await createSession(user.id);
  } catch (e) {
    return { error: message(e) };
  }
  redirect("/connect?welcome=1");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

// ---------- Homeowner ----------

export async function saveJob(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("homeowner");
  const jobId = Number(form.get("job_id") || 0);
  let id = jobId;
  try {
    const input = jobInput.parse(JSON.parse(String(form.get("payload"))));
    if (jobId) await updateJob(user, jobId, input);
    else id = await createJob(user, input, "app");
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath(`/jobs/${id}`);
  if (!jobId) redirect(`/jobs/${id}`);
  return { ok: "Saved." };
}

export async function changeStatus(form: FormData) {
  const user = await requireUser("homeowner");
  const jobId = Number(form.get("job_id"));
  const status = String(form.get("status")) as "open" | "draft" | "closed";
  let err = "";
  try {
    await setJobStatus(user, jobId, status);
  } catch (e) {
    err = message(e);
  }
  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}${err ? `?error=${encodeURIComponent(err)}` : status === "open" ? "?published=1" : ""}`);
}

export async function hire(form: FormData) {
  const user = await requireUser("homeowner");
  const jobId = Number(form.get("job_id"));
  let err = "";
  try {
    await hireQuote(user, jobId, Number(form.get("quote_id")));
  } catch (e) {
    err = message(e);
  }
  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}${err ? `?error=${encodeURIComponent(err)}` : "?hired=1"}#quotes`);
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function uploadPhotos(form: FormData) {
  const user = await requireUser("homeowner");
  const jobId = Number(form.get("job_id"));
  let err = "";
  try {
    const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) throw new UserError("Choose at least one photo.");
    for (const f of files) {
      if (!IMAGE_TYPES.includes(f.type)) throw new UserError(`${f.name} is not a JPG, PNG, WebP or GIF image.`);
      if (f.size > 3 * 1024 * 1024) throw new UserError(`${f.name} is larger than 3 MB.`);
      await addPhoto(user, jobId, f.type, Buffer.from(await f.arrayBuffer()));
    }
  } catch (e) {
    err = message(e);
  }
  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}${err ? `?error=${encodeURIComponent(err)}` : ""}#photos`);
}

export async function removePhoto(form: FormData) {
  const user = await requireUser("homeowner");
  const jobId = Number(form.get("job_id"));
  await deletePhoto(user, jobId, Number(form.get("photo_id")));
  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}#photos`);
}

// ---------- Contractor ----------

export async function submitQuote(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("contractor");
  let jobId = 0;
  try {
    const input = quoteInput.parse(JSON.parse(String(form.get("payload"))));
    jobId = input.job_id;
    const { revised } = await sendQuote(user, input, "app");
    revalidatePath(`/leads/${jobId}`);
    revalidatePath("/leads");
    return { ok: revised ? "Quote updated. The homeowner sees the new prices." : "Quote sent. The homeowner can now compare it with the others." };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function buyCredits() {
  const user = await requireUser("contractor");
  // Demo only: no payment is taken. In production this goes through a payment gateway.
  await sql`update users set credits = credits + 10 where id = ${user.id}`;
  revalidatePath("/connect");
  redirect("/connect?credits=1");
}

export async function rotateToken() {
  const user = await requireUser();
  await sql`update users set mcp_token = ${newToken(user.role === "homeowner" ? "home" : "pro")} where id = ${user.id}`;
  revalidatePath("/connect");
  redirect("/connect?rotated=1");
}
