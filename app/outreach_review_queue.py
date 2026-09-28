#!/usr/bin/env python3
"""Local, one-at-a-time outreach review queue. This app never submits forms."""

import argparse
import csv
import html
import json
import re
import sqlite3
import subprocess
import sys
import urllib.parse
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


HERE = Path(__file__).resolve().parent
DEFAULT_CSV = HERE / "contact_forms_high_confidence.csv"
DEFAULT_DB = HERE / "outreach_review_queue.sqlite"

CONTACT_EMAIL = "joinugcnetwork@gmail.com"
MESSAGE = """Hi,

I'm building a marketplace for TikTok Shop Affiliates, where products are tiered by creators last 30-day sales.

We currently manage over 40 Shops on TikTok, with thousands of creator deals landed monthly. My teams background is largely Meta as well so we cover most social platforms.

If you want to check it out and see if it's something you'd be interested in, I'd love to show you around.

Join here: https://discord.gg/Q7nn5UpHux"""


SCHEMA = """
CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE,
    merchant_name TEXT,
    final_grade TEXT NOT NULL,
    quality_score INTEGER NOT NULL,
    contact_url TEXT NOT NULL,
    homepage_url TEXT,
    contact_page_title TEXT,
    page_language TEXT,
    form_id TEXT,
    form_provider TEXT,
    form_purpose TEXT,
    form_action TEXT,
    form_http_method TEXT,
    page_captcha_type TEXT NOT NULL DEFAULT '',
    form_captcha_type TEXT,
    form_requires_javascript TEXT,
    honeypot_present TEXT,
    consent_required TEXT,
    field_count INTEGER,
    required_field_count INTEGER,
    submit_button_text TEXT,
    selection_reason TEXT,
    quality_warnings TEXT,
    semantic_types_json TEXT,
    fields_json TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','approved','rejected','needs_review','submitted','failed')),
    reviewer_note TEXT NOT NULL DEFAULT '',
    reviewed_at TEXT,
    submitted_at TEXT
);
CREATE INDEX IF NOT EXISTS queue_status_id ON queue(status, id);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    queue_id INTEGER NOT NULL REFERENCES queue(id),
    event_type TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);
"""


def connect(db_path):
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    return connection


def initialize(csv_path, db_path, limit, offset):
    if not csv_path.exists():
        raise SystemExit(f"Missing source CSV: {csv_path}")
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = connect(db_path)
    connection.executescript(SCHEMA)
    existing = connection.execute("SELECT COUNT(*) FROM queue").fetchone()[0]
    if existing:
        print(f"Queue already contains {existing:,} records; no import performed.")
        return

    columns = [
        "domain", "merchant_name", "final_grade", "quality_score", "contact_url",
        "homepage_url", "contact_page_title", "page_language", "form_id",
        "form_provider", "form_purpose", "form_action", "form_http_method", "page_captcha_type",
        "form_captcha_type", "form_requires_javascript", "honeypot_present",
        "consent_required", "field_count", "required_field_count", "submit_button_text",
        "selection_reason", "quality_warnings", "semantic_types_json", "fields_json",
    ]
    placeholders = ",".join("?" for _ in columns)
    sql = f"INSERT INTO queue ({','.join(columns)}) VALUES ({placeholders})"
    imported = 0
    csv.field_size_limit(sys.maxsize)
    with csv_path.open(encoding="utf-8", newline="") as source:
        for index, row in enumerate(csv.DictReader(source)):
            if index < offset:
                continue
            connection.execute(sql, [row.get(column, "") for column in columns])
            imported += 1
            if imported >= limit:
                break
    connection.commit()
    connection.close()
    print(f"Imported {imported:,} records into {db_path}")


PAGE = r"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Outreach Operator</title>
<style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;--bg:#080b10;--panel:#10151d;--panel2:#151b24;--line:#242d3a;--text:#eef2f7;--muted:#8f9bac;--green:#49d39a;--blue:#6ca6ff;--amber:#efb852;--red:#ef6b6b}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);height:100vh;overflow:hidden}button,input,select{font:inherit;min-width:0}button{cursor:pointer}.app{display:grid;grid-template-rows:64px 1fr;height:100vh}.topbar{display:flex;align-items:center;gap:22px;padding:0 22px;border-bottom:1px solid var(--line);background:#0d1118}.brand{font-weight:750;letter-spacing:-.02em}.brand small{display:block;color:var(--muted);font-weight:500;font-size:11px;letter-spacing:.08em;text-transform:uppercase}.counts{display:flex;gap:6px;margin-left:auto}.count{background:var(--panel2);border:1px solid var(--line);border-radius:7px;padding:6px 9px;font-size:12px;color:var(--muted)}.workspace{display:grid;grid-template-columns:360px minmax(0,1fr);min-height:0}.sidebar{border-right:1px solid var(--line);background:#0c1016;display:grid;grid-template-rows:auto auto 1fr auto;min-height:0;overflow:hidden}.filters{padding:14px;border-bottom:1px solid var(--line);display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}.filters>*{width:100%;max-width:100%}.filters input,.filters select,.operator input,.note{background:#0a0e14;color:var(--text);border:1px solid var(--line);border-radius:8px;padding:9px 10px;outline:none}.filters #market,.filters #captcha,.filters input{grid-column:1/-1}.batch-title{padding:11px 14px;color:var(--muted);font-size:12px;display:flex;justify-content:space-between}.list{overflow:auto;padding:0 8px 10px}.item{width:100%;text-align:left;border:1px solid transparent;background:transparent;color:var(--text);border-radius:9px;padding:10px;margin-bottom:3px;display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:9px;align-items:center}.item:hover{background:var(--panel2)}.item.active{background:#172131;border-color:#30435d}.num{font-variant-numeric:tabular-nums;color:#627086;font-size:11px}.item-name{font-size:13px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.item-domain{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.grade{font-size:11px;font-weight:800;color:#08100d;background:var(--green);border-radius:5px;padding:3px 6px}.grade.B{background:var(--blue)}.pager{padding:12px;border-top:1px solid var(--line);display:flex;gap:8px}.pager button,.btn{border:1px solid var(--line);background:var(--panel2);color:var(--text);border-radius:8px;padding:9px 12px;font-weight:650}.pager button{flex:1}.main{overflow:auto;padding:22px 26px 100px}.empty{display:grid;place-items:center;height:70vh;color:var(--muted)}.hero{display:flex;align-items:flex-start;gap:16px;padding-bottom:18px;border-bottom:1px solid var(--line)}h1{font-size:25px;margin:0 0 5px;letter-spacing:-.025em}.domain{color:var(--muted);font-size:13px}.hero .badges{margin-left:auto;text-align:right}.pill{display:inline-block;border:1px solid var(--line);background:var(--panel2);color:#b8c2cf;border-radius:999px;padding:5px 9px;margin:0 0 5px 5px;font-size:11px}.warn{color:#ffd382;border-color:#5b4822;background:#211b10}.grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(350px,.92fr);gap:18px;margin-top:18px}.panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:17px}.panel h2{font-size:11px;color:#7e8a9c;text-transform:uppercase;letter-spacing:.1em;margin:0 0 11px}.section{margin-top:17px}.value{font-size:13px;line-height:1.55;overflow-wrap:anywhere}.muted{color:var(--muted)}a{color:#86b7ff;text-decoration:none}pre{white-space:pre-wrap;margin:0;background:#0a0e14;border:1px solid var(--line);border-radius:8px;padding:12px;font:12px/1.5 ui-monospace,SFMono-Regular,monospace;color:#cbd4df}.copyrow{display:flex;justify-content:flex-end;margin-top:8px}.operator{position:fixed;bottom:0;left:360px;right:0;background:#0d1118eF;backdrop-filter:blur(16px);border-top:1px solid var(--line);padding:12px 26px;display:flex;gap:9px;align-items:center}.operator .note{flex:1}.btn.primary{background:var(--green);color:#07120e;border-color:transparent}.btn.review{color:#ffd27d}.btn.reject{color:#ff9191}@media(max-width:900px){.workspace{grid-template-columns:290px 1fr}.operator{left:290px}.grid{grid-template-columns:1fr}}
</style></head><body><div class="app"><header class="topbar"><div class="brand">Outreach Operator<small>Individual review workspace</small></div><div class="counts" id="counts"></div></header><div class="workspace"><aside class="sidebar"><div class="filters"><select id="status"><option>pending</option><option>needs_review</option><option>approved</option><option>rejected</option><option>submitted</option><option>failed</option></select><select id="grade"><option value="">All grades</option><option>A</option><option>B</option></select><select id="market"><option value="us_english">English · .com/.us</option><option value="english">All English pages</option><option value="">All languages/markets</option></select><select id="captcha"><option value="form_none">No form CAPTCHA</option><option value="strict_none">Strict: no page/form CAPTCHA</option><option value="">All CAPTCHA states</option></select><input id="search" placeholder="Search this batch"></div><div class="batch-title"><span id="batchLabel">100 records</span><span id="visibleCount"></span></div><div class="list" id="list"></div><div class="pager"><button onclick="pageBatch(-1)">← Previous 100</button><button onclick="pageBatch(1)">Next 100 →</button></div></aside><main class="main" id="detail"><div class="empty">Select a record from the batch</div></main></div></div><div class="operator"><input class="note" id="note" placeholder="Review note"><button class="btn primary" onclick="openRegularBrowser()">Open in regular browser</button><button class="btn" onclick="decide('approved')">Approve</button><button class="btn review" onclick="decide('needs_review')">Review</button><button class="btn reject" onclick="decide('rejected')">Reject</button><button class="btn" onclick="decide('submitted')">Submitted</button></div>
<script>
let current=null,batch=[],offset=0;const MESSAGE=__MESSAGE__,CONTACT=__CONTACT__,$=id=>document.getElementById(id),statusEl=$('status'),gradeEl=$('grade'),marketEl=$('market'),captchaEl=$('captcha'),searchEl=$('search'),listEl=$('list'),detailEl=$('detail'),noteEl=$('note'),batchLabelEl=$('batchLabel'),visibleCountEl=$('visibleCount');const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));async function api(u,o){const r=await fetch(u,o);if(!r.ok)throw new Error(await r.text());return r.json()}
async function counts(){const x=await api('/api/counts');document.getElementById('counts').innerHTML=Object.entries(x).map(([k,v])=>`<span class="count">${esc(k)} <b>${v}</b></span>`).join('')}
async function loadBatch(){const s=statusEl.value,c=captchaEl.value,m=marketEl.value;batch=await api(`/api/batch?status=${encodeURIComponent(s)}&captcha=${encodeURIComponent(c)}&market=${encodeURIComponent(m)}&offset=${offset}&limit=100`);batchLabelEl.textContent=batch.length?`${offset+1}–${offset+batch.length}`:'0 records';filterList();if(batch.length&&!current)selectItem(batch[0].id)}
function filterList(){const q=searchEl.value.toLowerCase(),g=gradeEl.value;const rows=batch.filter(x=>(!g||x.final_grade===g)&&(!q||(x.domain+' '+x.merchant_name).toLowerCase().includes(q)));visibleCountEl.textContent=`${rows.length} visible`;listEl.innerHTML=rows.map((x,i)=>`<button class="item ${current?.id===x.id?'active':''}" onclick="selectItem(${x.id})"><span class="num">${String(offset+i+1).padStart(3,'0')}</span><span><div class="item-name">${esc(x.merchant_name||x.domain)}</div><div class="item-domain">${esc(x.domain)}</div></span><span class="grade ${esc(x.final_grade)}">${esc(x.final_grade)}</span></button>`).join('')||'<div class="empty">No matches</div>'}
async function selectItem(id){current=await api(`/api/item/${id}`);noteEl.value=current.reviewer_note||'';render();filterList()}
function render(){const x=current;if(!x)return;let fields=[];try{fields=JSON.parse(x.fields_json||'[]').filter(f=>String(f.visible)==='1'&&String(f.disabled)!=='1')}catch(e){}const fieldText=fields.map(f=>`${f.semantic_type}${String(f.required)==='1'?' *':''} — ${f.label||f.placeholder||f.raw_name||f.tag_name}`).join('\n');const warnings=(x.quality_warnings||'').split('; ').filter(Boolean).map(v=>`<span class="pill warn">${esc(v)}</span>`).join('');detailEl.innerHTML=`<div class="hero"><div><h1>${esc(x.merchant_name||x.domain)}</h1><div class="domain">${esc(x.domain)}</div></div><div class="badges"><span class="grade ${esc(x.final_grade)}">${esc(x.final_grade)} · ${esc(x.quality_score)}</span><span class="pill">${esc(x.form_provider)}</span><span class="pill">${esc(x.form_purpose)}</span></div></div><div class="grid"><div><section class="panel"><h2>Live page</h2><div class="value"><a target="_blank" rel="noopener" href="${esc(x.contact_url)}">${esc(x.contact_url)}</a></div><div class="value muted">${esc(x.contact_page_title)}</div><div class="section"><h2>Form endpoint</h2><div class="value">${esc(x.form_http_method).toUpperCase()} → ${esc(x.form_action)}</div><div class="value muted">CAPTCHA ${esc(x.form_captcha_type)} · ${esc(x.field_count)} fields · ${esc(x.required_field_count)} required</div></div><div class="section">${warnings}</div><div class="section"><h2>Visible fields</h2><pre>${esc(fieldText)}</pre></div></section><section class="panel section"><h2>Selection evidence</h2><div class="value muted">${esc(x.selection_reason)}</div></section></div><div><section class="panel"><h2>Contact</h2><pre>${esc(CONTACT)}</pre><div class="copyrow"><button class="btn" onclick="copyText(CONTACT)">Copy</button></div></section><section class="panel section"><h2>Message</h2><pre>${esc(MESSAGE)}</pre><div class="copyrow"><button class="btn" onclick="copyText(MESSAGE)">Copy</button></div></section></div></div>`}
async function decide(s){if(!current)return;await api(`/api/item/${current.id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:s,note:noteEl.value})});current=null;await counts();await loadBatch()}
async function openRegularBrowser(){if(!current)return;try{await api(`/api/open/${current.id}`,{method:'POST'});}catch(e){alert(`Could not open browser: ${e.message}`)}}
function pageBatch(d){offset=Math.max(0,offset+d*100);current=null;loadBatch()}async function copyText(v){await navigator.clipboard.writeText(v)}statusEl.onchange=captchaEl.onchange=marketEl.onchange=()=>{offset=0;current=null;loadBatch()};gradeEl.onchange=filterList;searchEl.oninput=filterList;counts();loadBatch();
</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    db_path = DEFAULT_DB

    def log_message(self, fmt, *args):
        return

    def json_response(self, payload, status=200):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path == "/":
            page = PAGE.replace("__MESSAGE__", json.dumps(MESSAGE)).replace("__CONTACT__", json.dumps(CONTACT_EMAIL))
            data = page.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store, max-age=0")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        connection = connect(self.db_path)
        if parsed.path == "/api/counts":
            counts = {row["status"]: row["n"] for row in connection.execute("SELECT status, COUNT(*) n FROM queue GROUP BY status")}
            connection.close()
            self.json_response(counts)
            return
        if parsed.path == "/api/batch":
            query = urllib.parse.parse_qs(parsed.query)
            status = query.get("status", ["pending"])[0]
            captcha = query.get("captcha", [""])[0]
            market = query.get("market", [""])[0]
            offset = max(0, int(query.get("offset", [0])[0]))
            limit = min(100, max(1, int(query.get("limit", [100])[0])))
            captcha_clause = ""
            if captcha == "strict_none":
                captcha_clause = " AND page_captcha_type='none' AND form_captcha_type='none'"
            elif captcha == "form_none":
                captcha_clause = " AND form_captcha_type='none'"
            market_clause = ""
            if market == "us_english":
                market_clause = (
                    " AND lower(page_language) LIKE 'en%'"
                    " AND (lower(domain) LIKE '%.com' OR lower(domain) LIKE '%.us')"
                )
            elif market == "english":
                market_clause = " AND lower(page_language) LIKE 'en%'"
            rows = connection.execute(
                "SELECT id,domain,merchant_name,final_grade,quality_score,status "
                f"FROM queue WHERE status=?{captcha_clause}{market_clause} ORDER BY id LIMIT ? OFFSET ?",
                (status, limit, offset),
            ).fetchall()
            connection.close()
            self.json_response([dict(row) for row in rows])
            return
        if parsed.path == "/api/item":
            query = urllib.parse.parse_qs(parsed.query)
            status = query.get("status", ["pending"])[0]
            if "before" in query:
                row = connection.execute("SELECT * FROM queue WHERE status=? AND id<? ORDER BY id DESC LIMIT 1", (status, int(query["before"][0]))).fetchone()
            else:
                row = connection.execute("SELECT * FROM queue WHERE status=? AND id>? ORDER BY id LIMIT 1", (status, int(query.get("after", [0])[0]))).fetchone()
                if row is None and int(query.get("after", [0])[0]) > 0:
                    row = connection.execute("SELECT * FROM queue WHERE status=? ORDER BY id LIMIT 1", (status,)).fetchone()
            connection.close()
            self.json_response(dict(row) if row else None)
            return
        item_match = re.fullmatch(r"/api/item/(\d+)", parsed.path)
        if item_match:
            row = connection.execute("SELECT * FROM queue WHERE id=?", (int(item_match.group(1)),)).fetchone()
            connection.close()
            if not row:
                self.json_response({"error": "not found"}, 404)
                return
            payload = dict(row)
            payload["operator_contact"] = CONTACT_EMAIL
            payload["operator_message"] = MESSAGE
            self.json_response(payload)
            return
        connection.close()
        self.json_response({"error": "not found"}, 404)

    def do_POST(self):
        request_path = urllib.parse.urlsplit(self.path).path
        if request_path == "/api/next":
            size = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(size) or b"{}")
            current_url = str(payload.get("url", ""))
            hostname = (urllib.parse.urlsplit(current_url).hostname or "").lower()
            if hostname.startswith("www."):
                hostname = hostname[4:]
            connection = connect(self.db_path)
            current_row = connection.execute(
                "SELECT id FROM queue WHERE lower(domain)=? ORDER BY id LIMIT 1",
                (hostname,),
            ).fetchone()
            current_id = current_row["id"] if current_row else 0
            eligibility = (
                "status='pending' AND form_captcha_type='none' "
                "AND lower(page_language) LIKE 'en%' "
                "AND (lower(domain) LIKE '%.com' OR lower(domain) LIKE '%.us')"
            )
            next_row = connection.execute(
                f"SELECT id,contact_url FROM queue WHERE {eligibility} AND id>? ORDER BY id LIMIT 1",
                (current_id,),
            ).fetchone()
            if not next_row:
                next_row = connection.execute(
                    f"SELECT id,contact_url FROM queue WHERE {eligibility} ORDER BY id LIMIT 1"
                ).fetchone()
            connection.close()
            self.json_response({
                "ok": bool(next_row),
                "next_id": next_row["id"] if next_row else None,
                "next_url": next_row["contact_url"] if next_row else None,
            })
            return
        if request_path == "/api/advance":
            size = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(size) or b"{}")
            submitted_url = str(payload.get("url", ""))
            hostname = (urllib.parse.urlsplit(submitted_url).hostname or "").lower()
            if hostname.startswith("www."):
                hostname = hostname[4:]
            connection = connect(self.db_path)
            row = connection.execute(
                "SELECT id,domain FROM queue WHERE lower(domain)=? ORDER BY id LIMIT 1",
                (hostname,),
            ).fetchone()
            if not row:
                connection.close()
                self.json_response({"error": "current domain not found in queue"}, 404)
                return
            now = datetime.now(timezone.utc).isoformat()
            connection.execute(
                "UPDATE queue SET status='submitted', reviewed_at=?, submitted_at=? WHERE id=?",
                (now, now, row["id"]),
            )
            connection.execute(
                "INSERT INTO events(queue_id,event_type,note,created_at) VALUES(?,?,?,?)",
                (row["id"], "submitted", "Marked by Chrome helper after manual form submit", now),
            )
            eligibility = (
                "status='pending' AND form_captcha_type='none' "
                "AND lower(page_language) LIKE 'en%' "
                "AND (lower(domain) LIKE '%.com' OR lower(domain) LIKE '%.us')"
            )
            next_row = connection.execute(
                f"SELECT id,contact_url FROM queue WHERE {eligibility} AND id>? ORDER BY id LIMIT 1",
                (row["id"],),
            ).fetchone()
            if not next_row:
                next_row = connection.execute(
                    f"SELECT id,contact_url FROM queue WHERE {eligibility} ORDER BY id LIMIT 1"
                ).fetchone()
            connection.commit()
            connection.close()
            self.json_response({
                "ok": True,
                "submitted_id": row["id"],
                "next_id": next_row["id"] if next_row else None,
                "next_url": next_row["contact_url"] if next_row else None,
            })
            return
        open_match = re.fullmatch(r"/api/open/(\d+)", request_path)
        if open_match:
            connection = connect(self.db_path)
            row = connection.execute("SELECT contact_url FROM queue WHERE id=?", (int(open_match.group(1)),)).fetchone()
            connection.close()
            if not row:
                self.json_response({"error": "not found"}, 404)
                return
            try:
                subprocess.Popen(
                    ["open", "-a", "Google Chrome", row["contact_url"]],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                opened = True
            except OSError:
                opened = False
            self.json_response({"ok": opened, "url": row["contact_url"]})
            return
        match = re.fullmatch(r"/api/item/(\d+)", request_path)
        if not match:
            self.json_response({"error": "not found"}, 404)
            return
        size = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(size) or b"{}")
        status = payload.get("status")
        allowed = {"approved", "rejected", "needs_review", "submitted", "failed", "pending"}
        if status not in allowed:
            self.json_response({"error": "invalid status"}, 400)
            return
        now = datetime.now(timezone.utc).isoformat()
        queue_id = int(match.group(1))
        note = str(payload.get("note", ""))[:2000]
        connection = connect(self.db_path)
        connection.execute(
            "UPDATE queue SET status=?, reviewer_note=?, reviewed_at=?, submitted_at=CASE WHEN ?='submitted' THEN ? ELSE submitted_at END WHERE id=?",
            (status, note, now, status, now, queue_id),
        )
        connection.execute("INSERT INTO events(queue_id,event_type,note,created_at) VALUES(?,?,?,?)", (queue_id, status, note, now))
        connection.commit()
        connection.close()
        self.json_response({"ok": True})


def serve(db_path, host, port, open_browser):
    Handler.db_path = db_path
    server = ThreadingHTTPServer((host, port), Handler)
    url = f"http://{host}:{port}/"
    print(f"Review queue: {url}")
    print("This application does not submit forms.")
    if open_browser:
        subprocess.Popen(["open", "-a", "Google Chrome", url])
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--limit", type=int, default=1000)
    parser.add_argument("--offset", type=int, default=0, help="Zero-based number of CSV data rows to skip")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-open", action="store_true")
    parser.add_argument("--init-only", action="store_true")
    args = parser.parse_args()
    initialize(args.csv, args.db, args.limit, args.offset)
    if not args.init_only:
        serve(args.db, args.host, args.port, not args.no_open)


if __name__ == "__main__":
    main()
