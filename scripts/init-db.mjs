import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL first");
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });
await sql.unsafe(`
CREATE TABLE IF NOT EXISTS queue (
  id BIGSERIAL PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  merchant_name TEXT, final_grade TEXT NOT NULL, quality_score INTEGER NOT NULL,
  contact_url TEXT NOT NULL, homepage_url TEXT, contact_page_title TEXT, page_language TEXT,
  form_id TEXT, form_provider TEXT, form_purpose TEXT, form_action TEXT, form_http_method TEXT,
  page_captcha_type TEXT NOT NULL DEFAULT '', form_captcha_type TEXT,
  form_requires_javascript TEXT, honeypot_present TEXT, consent_required TEXT,
  field_count INTEGER, required_field_count INTEGER, submit_button_text TEXT,
  selection_reason TEXT, quality_warnings TEXT, semantic_types_json TEXT, fields_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending', reviewer_note TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ, submitted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS queue_status_id ON queue(status,id);
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY, queue_id BIGINT NOT NULL REFERENCES queue(id),
  event_type TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL
);
`);
console.log("Database schema ready.");
await sql.end();

