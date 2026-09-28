"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const CONTACT = "joinugcnetwork@gmail.com";
const MESSAGE = `Hi,

I'm building a marketplace for TikTok Shop Affiliates, where products are tiered by creators last 30-day sales.

We currently manage over 40 Shops on TikTok, with thousands of creator deals landed monthly. My teams background is largely Meta as well so we cover most social platforms.

If you want to check it out and see if it's something you'd be interested in, I'd love to show you around.

Join here: https://discord.gg/Q7nn5UpHux`;

async function api(path, options) {
  const response = await fetch(path, { cache: "no-store", ...options });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export default function Operator() {
  const [status, setStatus] = useState("pending");
  const [grade, setGrade] = useState("");
  const [market, setMarket] = useState("us_english");
  const [captcha, setCaptcha] = useState("form_none");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [batch, setBatch] = useState([]);
  const [current, setCurrent] = useState(null);
  const [counts, setCounts] = useState({});
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const query = `status=${status}&market=${market}&captcha=${captcha}&offset=${offset}&limit=100`;
  const refresh = useCallback(async () => {
    try {
      const [rows, totals] = await Promise.all([api(`/api/batch?${query}`), api("/api/counts")]);
      setBatch(rows); setCounts(totals); setError("");
      if (!current && rows[0]) select(rows[0].id);
    } catch (e) { setError(e.message); }
  }, [query, current]);

  useEffect(() => { refresh(); }, [status, market, captcha, offset]);
  async function select(id) { const row = await api(`/api/item/${id}`); setCurrent(row); setNote(row.reviewer_note || ""); }
  async function decide(nextStatus) {
    if (!current) return;
    await api(`/api/item/${current.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: nextStatus, note }) });
    setCurrent(null); await refresh();
  }
  const visible = useMemo(() => batch.filter(row => (!grade || row.final_grade === grade) && (`${row.domain} ${row.merchant_name || ""}`).toLowerCase().includes(search.toLowerCase())), [batch, grade, search]);
  let fields = [];
  try { fields = JSON.parse(current?.fields_json || "[]").filter(field => String(field.visible) === "1" && String(field.disabled) !== "1"); } catch {}

  return <div className="app">
    <header><div><strong>SiteContact</strong><small>Individual review workspace</small></div><div className="counts">{Object.entries(counts).map(([key, value]) => <span key={key}>{key} <b>{value}</b></span>)}</div></header>
    <aside>
      <div className="filters">
        <select value={status} onChange={e => { setStatus(e.target.value); setOffset(0); setCurrent(null); }}>{["pending","needs_review","approved","rejected","submitted","failed"].map(x => <option key={x}>{x}</option>)}</select>
        <select value={grade} onChange={e => setGrade(e.target.value)}><option value="">All grades</option><option>A</option><option>B</option></select>
        <select value={market} onChange={e => { setMarket(e.target.value); setOffset(0); }}><option value="us_english">English · .com/.us</option><option value="english">All English</option><option value="">All markets</option></select>
        <select value={captcha} onChange={e => { setCaptcha(e.target.value); setOffset(0); }}><option value="form_none">No form CAPTCHA</option><option value="strict_none">No page/form CAPTCHA</option><option value="">All CAPTCHA states</option></select>
        <input placeholder="Search this batch" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="batchTitle"><span>{batch.length ? `${offset + 1}–${offset + batch.length}` : "0 records"}</span><span>{visible.length} visible</span></div>
      <div className="list">{visible.map((row, index) => <button key={row.id} className={`item ${current?.id === row.id ? "active" : ""}`} onClick={() => select(row.id)}><i>{String(offset + index + 1).padStart(3,"0")}</i><span><b>{row.merchant_name || row.domain}</b><small>{row.domain}</small></span><em className={row.final_grade}>{row.final_grade}</em></button>)}</div>
      <div className="pager"><button onClick={() => setOffset(Math.max(0, offset - 100))}>← Previous 100</button><button onClick={() => setOffset(offset + 100)}>Next 100 →</button></div>
    </aside>
    <main>{error ? <div className="empty error">{error}</div> : !current ? <div className="empty">Select a record</div> : <>
      <div className="hero"><div><h1>{current.merchant_name || current.domain}</h1><p>{current.domain}</p></div><div><em className={current.final_grade}>{current.final_grade} · {current.quality_score}</em><span className="pill">{current.form_provider}</span><span className="pill">{current.form_purpose}</span></div></div>
      <div className="grid"><div><section><h2>Live page</h2><a href={current.contact_url} target="_blank" rel="noreferrer">{current.contact_url}</a><p>{current.contact_page_title}</p><h2>Form endpoint</h2><div>{String(current.form_http_method || "").toUpperCase()} → {current.form_action}</div><p>CAPTCHA {current.form_captcha_type} · {current.field_count} fields · {current.required_field_count} required</p><h2>Visible fields</h2><pre>{fields.map(f => `${f.semantic_type}${String(f.required)==="1" ? " *" : ""} — ${f.label || f.placeholder || f.raw_name || f.tag_name}`).join("\n")}</pre></section><section><h2>Selection evidence</h2><p>{current.selection_reason}</p></section></div>
      <div><CopyPanel title="Contact" value={CONTACT}/><CopyPanel title="Message" value={MESSAGE}/></div></div>
    </>}</main>
    <footer><input placeholder="Review note" value={note} onChange={e => setNote(e.target.value)} /><button className="primary" onClick={() => current && window.open(current.contact_url, "_blank", "noopener")}>Open form</button><button onClick={() => decide("approved")}>Approve</button><button className="review" onClick={() => decide("needs_review")}>Review</button><button className="reject" onClick={() => decide("rejected")}>Reject</button><button onClick={() => decide("submitted")}>Submitted</button></footer>
  </div>;
}

function CopyPanel({ title, value }) { return <section><h2>{title}</h2><pre>{value}</pre><div className="copy"><button onClick={() => navigator.clipboard.writeText(value)}>Copy</button></div></section>; }

