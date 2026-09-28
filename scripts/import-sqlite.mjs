import { DatabaseSync } from "node:sqlite";
import postgres from "postgres";

const path = process.argv[2];
if (!path) throw new Error("Usage: npm run db:import -- /absolute/path/to/queue.sqlite");
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL first");
const source = new DatabaseSync(path, { readOnly: true });
const target = postgres(process.env.DATABASE_URL, { ssl: "require", max: 2 });
const columns = ["id","domain","merchant_name","final_grade","quality_score","contact_url","homepage_url","contact_page_title","page_language","form_id","form_provider","form_purpose","form_action","form_http_method","page_captcha_type","form_captcha_type","form_requires_javascript","honeypot_present","consent_required","field_count","required_field_count","submit_button_text","selection_reason","quality_warnings","semantic_types_json","fields_json","status","reviewer_note","reviewed_at","submitted_at"];
const rows = source.prepare(`SELECT ${columns.join(",")} FROM queue ORDER BY id`).all();
for (let index = 0; index < rows.length; index += 100) {
  const batch = rows.slice(index, index + 100);
  await target`INSERT INTO queue ${target(batch, ...columns)} ON CONFLICT (domain) DO UPDATE SET status=EXCLUDED.status,reviewer_note=EXCLUDED.reviewer_note,reviewed_at=EXCLUDED.reviewed_at,submitted_at=EXCLUDED.submitted_at`;
  console.log(`Imported ${Math.min(index + 100, rows.length)}/${rows.length}`);
}
await target`SELECT setval(pg_get_serial_sequence('queue','id'), COALESCE((SELECT max(id) FROM queue),1))`;
source.close(); await target.end();
console.log("Queue import complete.");

