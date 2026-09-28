import { db } from "../../../lib/db";

export async function POST(request) {
  const { url = "" } = await request.json();
  let hostname = "";
  try { hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch {}
  const current = await db()`SELECT id FROM queue WHERE lower(domain) = ${hostname} ORDER BY id LIMIT 1`;
  const after = current[0]?.id || 0;
  const sql = db();
  let rows = await sql`
    SELECT id,contact_url FROM queue
    WHERE status='pending' AND form_captcha_type='none' AND lower(page_language) LIKE 'en%'
      AND (lower(domain) LIKE '%.com' OR lower(domain) LIKE '%.us') AND id > ${after}
    ORDER BY id LIMIT 1`;
  if (!rows[0]) rows = await sql`
    SELECT id,contact_url FROM queue
    WHERE status='pending' AND form_captcha_type='none' AND lower(page_language) LIKE 'en%'
      AND (lower(domain) LIKE '%.com' OR lower(domain) LIKE '%.us')
    ORDER BY id LIMIT 1`;
  return Response.json({ ok: Boolean(rows[0]), next_id: rows[0]?.id || null, next_url: rows[0]?.contact_url || null });
}

