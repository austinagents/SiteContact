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

## Hosting status

This commit preserves the working local source safely. It is not yet production-ready for Vercel: Vercel functions do not provide durable SQLite application storage. The hosted version should use a managed database, server-side authentication, and environment variables before importing any private queue data.

Never commit CSV exports, SQLite databases, credentials, or `.env` files.

