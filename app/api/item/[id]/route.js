import { db } from "../../../../lib/db";

export const dynamic = "force-dynamic";
const allowed = new Set(["pending", "approved", "rejected", "needs_review", "submitted", "failed"]);

export async function GET(_request, context) {
  const { id } = await context.params;
  const rows = await db()`SELECT * FROM queue WHERE id = ${Number(id)} LIMIT 1`;
  if (!rows[0]) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(rows[0]);
}

export async function POST(request, context) {
  const { id } = await context.params;
  const payload = await request.json();
  if (!allowed.has(payload.status)) return Response.json({ error: "invalid status" }, { status: 400 });
  const now = new Date();
  const submittedAt = payload.status === "submitted" ? now : null;
  const rows = await db()`
    UPDATE queue SET
      status = ${payload.status},
      reviewer_note = ${String(payload.note || "")},
      reviewed_at = ${now},
      submitted_at = COALESCE(${submittedAt}, submitted_at)
    WHERE id = ${Number(id)} RETURNING id, status
  `;
  if (!rows[0]) return Response.json({ error: "not found" }, { status: 404 });
  await db()`INSERT INTO events (queue_id,event_type,note,created_at) VALUES (${Number(id)},${payload.status},${String(payload.note || "")},${now})`;
  return Response.json({ ok: true, ...rows[0] });
}

