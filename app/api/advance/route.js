import { db } from "../../../lib/db";

export async function POST(request) {
  const { url = "" } = await request.json();
  let hostname = "";
  try { hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch {}
  const sql = db();
  const current = await sql`SELECT id FROM queue WHERE lower(domain) = ${hostname} ORDER BY id LIMIT 1`;
  if (!current[0]) return Response.json({ error: "current domain not found" }, { status: 404 });
  const now = new Date();
  await sql`UPDATE queue SET status='submitted',reviewed_at=${now},submitted_at=${now} WHERE id=${current[0].id}`;
  await sql`INSERT INTO events(queue_id,event_type,note,created_at) VALUES(${current[0].id},'submitted','Chrome helper submit event',${now})`;
  let rows = await sql`
    SELECT id,contact_url FROM queue WHERE status='pending' AND form_captcha_type='none'
      AND lower(page_language) LIKE 'en%' AND (lower(domain) LIKE '%.com' OR lower(domain) LIKE '%.us')
      AND id > ${current[0].id} ORDER BY id LIMIT 1`;
  if (!rows[0]) rows = await sql`
    SELECT id,contact_url FROM queue WHERE status='pending' AND form_captcha_type='none'
      AND lower(page_language) LIKE 'en%' AND (lower(domain) LIKE '%.com' OR lower(domain) LIKE '%.us')
      ORDER BY id LIMIT 1`;
  return Response.json({ ok: true, next_id: rows[0]?.id || null, next_url: rows[0]?.contact_url || null });
}
