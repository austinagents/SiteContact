# SiteContact

Private operator tooling for reviewing merchant contact forms one record at a time.

## Included

- `app/outreach_review_queue.py` — current local Python operator UI and API.
- `extension/contact-form-helper/` — unpacked Chrome helper for filling fields and advancing through an individually reviewed queue.

The helper does not click a merchant's submit button or solve CAPTCHAs.

## Local use

The Python app expects a private CSV and creates a private SQLite queue. Those files are intentionally excluded from Git.

```bash
python3 app/outreach_review_queue.py --help
```

Load the Chrome helper from `chrome://extensions` using **Load unpacked**, then select `extension/contact-form-helper`.

## Vercel deployment

The root project is a Vercel-compatible Next.js operator backed by Postgres. Configure this Vercel environment variable before deploying:

- `DATABASE_URL`

The operator has no login screen. Treat its Vercel URL as private because anyone with the URL can access the queue.

Create the schema and import the existing private queue from your computer:

```bash
cp .env.example .env.local
# Export DATABASE_URL in your terminal, then:
npm run db:init
npm run db:import -- /absolute/path/to/outreach_review_queue.sqlite
```

`app/outreach_review_queue.py` remains as the legacy local-only implementation. The hosted interface uses the Next.js files at the repository root.

Never commit CSV exports, SQLite databases, credentials, or `.env` files.
