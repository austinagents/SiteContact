import { db } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db()`SELECT status, count(*)::int AS count FROM queue GROUP BY status`;
  return Response.json(Object.fromEntries(rows.map(row => [row.status, row.count])));
}

