import { conditions, db } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const offset = Math.max(0, Number(params.get("offset") || 0));
  const limit = Math.min(100, Math.max(1, Number(params.get("limit") || 100)));
  const where = conditions(params);
  const rows = await db().unsafe(
    `SELECT id,domain,merchant_name,final_grade,quality_score,status FROM queue WHERE ${where.text} ORDER BY id LIMIT $2 OFFSET $3`,
    [...where.values, limit, offset]
  );
  return Response.json(rows);
}

