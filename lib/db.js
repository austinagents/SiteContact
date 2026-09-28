import postgres from "postgres";

let client;

export function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  if (!client) client = postgres(process.env.DATABASE_URL, { ssl: "require", max: 4 });
  return client;
}

export const CONTACT_EMAIL = "joinugcnetwork@gmail.com";
export const MESSAGE = `Hi,

I'm building a marketplace for TikTok Shop Affiliates, where products are tiered by creators last 30-day sales.

We currently manage over 40 Shops on TikTok, with thousands of creator deals landed monthly. My teams background is largely Meta as well so we cover most social platforms.

If you want to check it out and see if it's something you'd be interested in, I'd love to show you around.

Join here: https://discord.gg/Q7nn5UpHux`;

export function conditions(searchParams) {
  const clauses = ["status = $1"];
  const values = [searchParams.get("status") || "pending"];
  const captcha = searchParams.get("captcha") || "form_none";
  const market = searchParams.get("market") || "us_english";
  if (captcha === "strict_none") clauses.push("page_captcha_type = 'none'", "form_captcha_type = 'none'");
  if (captcha === "form_none") clauses.push("form_captcha_type = 'none'");
  if (market === "us_english") clauses.push("lower(page_language) LIKE 'en%'", "(lower(domain) LIKE '%.com' OR lower(domain) LIKE '%.us')");
  if (market === "english") clauses.push("lower(page_language) LIKE 'en%'");
  return { text: clauses.join(" AND "), values };
}

