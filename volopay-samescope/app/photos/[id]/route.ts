import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getLead } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Not found", { status: 404 });
  const { id } = await ctx.params;
  const [photo] = await sql<{ job_id: number; owner_id: number; mime: string; data: Buffer }[]>`
    select p.job_id, j.owner_id, p.mime, p.data from photos p join jobs j on j.id = p.job_id where p.id = ${Number(id)}`;
  if (!photo) return new Response("Not found", { status: 404 });
  if (photo.owner_id !== user.id) {
    // Contractors may see photos of jobs that are visible to them.
    try {
      if (user.role !== "contractor") throw new Error();
      await getLead(user, photo.job_id);
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }
  return new Response(new Uint8Array(photo.data), { headers: { "Content-Type": photo.mime, "Cache-Control": "private, max-age=3600" } });
}
