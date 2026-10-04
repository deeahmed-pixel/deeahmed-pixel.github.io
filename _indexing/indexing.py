#!/usr/bin/env python3
"""Indexing tracker for leadsupcallcenter.com, leadsupdata.com, weshastones.com and weshamarble.com.

Google's "Request indexing" button (URL Inspection) has no public API and a
small daily quota per property, so this tool does the bookkeeping around it:
it collects every page from each site's sitemaps, ranks them, deals them out
into daily batches that fit the quota, and tracks each URL until Google
reports it indexed.

  python3 _indexing/indexing.py sync               # pull sitemaps, add new URLs
  python3 _indexing/indexing.py import D FILE      # add URLs from a sitemap/txt/csv export
  python3 _indexing/indexing.py plan               # (re)deal unrequested URLs into daily batches
  python3 _indexing/indexing.py check              # fetch pages; set aside 404s, redirects, noindex, foreign canonicals
  python3 _indexing/indexing.py today              # today's batch, with URL Inspection links
  python3 _indexing/indexing.py mark requested --date 2026-10-05
  python3 _indexing/indexing.py inspect            # GSC URL Inspection API (needs credentials)
  python3 _indexing/indexing.py submit-sitemaps    # GSC Sitemaps API (needs credentials)
  python3 _indexing/indexing.py indexnow           # Bing/Yandex/Seznam/Naver via IndexNow
  python3 _indexing/indexing.py page               # build timetable.html (the published timetable page)
  python3 _indexing/indexing.py apply-ticks F.json # apply ticks read from the page's `ticks` collection
  python3 _indexing/indexing.py status

Standard library only. Search Console calls take an OAuth access token in
GSC_ACCESS_TOKEN, or a service-account key (file path or the JSON itself) in
GSC_SERVICE_ACCOUNT_JSON (that path needs `pip install google-auth requests`).
"""

import argparse
import csv
import datetime as dt
import gzip
import json
import re
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(HERE, "config.json")
STATE_PATH = os.path.join(HERE, "state.json")
SCHEDULE_MD = os.path.join(HERE, "schedule.md")
SCHEDULE_CSV = os.path.join(HERE, "schedule.csv")
TODAY_MD = os.path.join(HERE, "today.md")

UA = "Mozilla/5.0 (compatible; IndexingTracker/1.0)"
SM_NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
GSC_SCOPE = "https://www.googleapis.com/auth/webmasters"

# Statuses a URL moves through. "requested" means the Request Indexing button
# was pressed; "indexed" comes from the URL Inspection API or a manual mark.
# "fix" means the page can't be indexed as it stands (error, redirect, noindex,
# canonical elsewhere); `check` sets it and clears it once the page is fixed.
OPEN = ("pending", "scheduled")
DONE = ("indexed", "excluded", "dropped")


# ---------------------------------------------------------------- storage

def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, sort_keys=True)
        f.write("\n")
    os.replace(tmp, path)


def load():
    config = load_json(CONFIG_PATH, None)
    if config is None:
        sys.exit(f"missing {CONFIG_PATH}")
    state = load_json(STATE_PATH, {"domains": {}})
    for name in config["domains"]:
        state["domains"].setdefault(name, {"urls": {}, "last_sync": None, "sync_note": ""})
    return config, state


def tz(config):
    return ZoneInfo(config.get("timezone", "UTC"))


def today(config):
    return dt.datetime.now(tz(config)).date()


def now_iso(config):
    return dt.datetime.now(tz(config)).isoformat(timespec="seconds")


def pick_domains(config, only):
    names = list(config["domains"])
    if only:
        unknown = [d for d in only if d not in names]
        if unknown:
            sys.exit(f"unknown domain(s): {', '.join(unknown)}; known: {', '.join(names)}")
        names = [d for d in names if d in only]
    return names


# ---------------------------------------------------------------- fetching

def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read()
        if resp.headers.get("Content-Encoding") == "gzip" or url.endswith(".gz"):
            body = gzip.decompress(body)
        return resp.geturl(), body


def host_of(url):
    host = urllib.parse.urlsplit(url).hostname or ""
    return host[4:] if host.startswith("www.") else host


def parse_sitemap(body):
    """Return (child_sitemaps, [(url, priority)]) from a sitemap or sitemap index."""
    root = ET.fromstring(body)
    tag = root.tag.replace(SM_NS, "")
    if tag == "sitemapindex":
        return [(e.findtext(f"{SM_NS}loc") or "").strip() for e in root.findall(f"{SM_NS}sitemap")], []
    urls = []
    for e in root.findall(f"{SM_NS}url"):
        loc = (e.findtext(f"{SM_NS}loc") or "").strip()
        if not loc:
            continue
        try:
            prio = float(e.findtext(f"{SM_NS}priority") or 0.5)
        except ValueError:
            prio = 0.5
        urls.append((loc, prio))
    return [], urls


def discover_sitemaps(domain, cfg):
    """Sitemaps from config, plus any Sitemap: lines in robots.txt."""
    found = list(cfg.get("sitemaps", []))
    notes = []
    try:
        final, body = fetch(f"https://{domain}/robots.txt")
        if host_of(final) != domain:
            notes.append(f"robots.txt redirects to {final}")
        for line in body.decode("utf-8", "replace").splitlines():
            if line.lower().startswith("sitemap:"):
                sm = line.split(":", 1)[1].strip()
                if sm and sm not in found:
                    found.append(sm)
    except Exception as e:  # noqa: BLE001 - report and keep going with configured sitemaps
        notes.append(f"robots.txt: {e}")
    return found, notes


def crawl_sitemaps(domain, cfg):
    queue, notes = discover_sitemaps(domain, cfg)
    seen, urls = set(), {}
    while queue:
        sm = queue.pop(0)
        if sm in seen or len(seen) > 500:
            continue
        seen.add(sm)
        try:
            final, body = fetch(sm)
            children, entries = parse_sitemap(body)
        except Exception as e:  # noqa: BLE001
            notes.append(f"{sm}: {e}")
            continue
        if host_of(final) != domain:
            notes.append(f"{sm} redirects off-domain to {final}")
        queue.extend(c for c in children if c)
        for loc, prio in entries:
            if host_of(loc) == domain:
                urls[loc] = max(prio, urls.get(loc, 0))
            else:
                notes.append(f"skipped off-domain URL in {sm}: {loc}")
    return urls, notes


# ---------------------------------------------------------------- ranking & planning

LOW_VALUE = re.compile(r"privacy|terms|cookie|thank-you|legal|disclaimer|acceptable-use|refund|dmca", re.I)


def rank_key(url, info, cfg):
    """Homepage, then language order (config `lang_order`, "" = the root
    language), then sitemap priority, then pages more of the site links to
    (counted by `check`), then shallow before deep. Legal pages go last."""
    path = urllib.parse.urlsplit(url).path or "/"
    parts = [p for p in path.split("/") if p]
    order = cfg.get("lang_order", [""])
    lang = parts[0] if parts and parts[0] in order else ""
    lang_rank = order.index(lang) if lang in order else len(order)
    depth = len(parts) - (1 if lang else 0)
    low = 1 if LOW_VALUE.search(path) else 0
    return (0 if path == "/" else 1, low, lang_rank, -info.get("priority", 0.5), -info.get("inlinks", 0), depth, url)


def add_urls(state_dom, urls, config, source):
    added = 0
    stamp = now_iso(config)
    for url, prio in urls.items():
        rec = state_dom["urls"].get(url)
        if rec is None:
            state_dom["urls"][url] = {
                "status": "pending", "priority": prio, "first_seen": stamp, "source": source,
                "scheduled": None, "requested": [], "last_inspected": None, "coverage": None,
            }
            added += 1
        else:
            rec["priority"] = prio
            if rec["status"] == "dropped":
                rec["status"] = "pending"
    return added


def plan(config, state, start=None, domains=None):
    """Deal every open URL into daily batches of `daily_quota`, starting at `start`.

    Batches already in the past keep their dates only if they were requested;
    anything left unrequested is re-dealt from `start`, so a missed day simply
    slides the rest of the timetable forward.
    """
    start = start or today(config)
    for name in pick_domains(config, domains):
        cfg = config["domains"][name]
        quota = int(cfg.get("daily_quota", config.get("daily_quota", 10)))
        first_day = max(start, dt.date.fromisoformat(cfg["start"])) if cfg.get("start") else start
        urls = state["domains"][name]["urls"]
        open_urls = sorted(
            (u for u, r in urls.items() if r["status"] in OPEN),
            key=lambda u: rank_key(u, urls[u], cfg),
        )
        for i, url in enumerate(open_urls):
            urls[url]["status"] = "scheduled"
            urls[url]["scheduled"] = (first_day + dt.timedelta(days=i // quota)).isoformat()
    write_schedule(config, state)


def inspect_link(cfg, url):
    params = {"resource_id": cfg["property"], "id": url}
    # Picks the right Google account when several are signed in to one Chrome
    # profile. Across separate Chrome profiles the link still has to be opened
    # in the profile that owns the property.
    if cfg.get("gsc_account"):
        params["authuser"] = cfg["gsc_account"]
    return f"https://search.google.com/search-console/inspect?{urllib.parse.urlencode(params)}"


def account_note(cfg):
    return f"open in the Chrome profile for **{cfg['gsc_account']}**" if cfg.get("gsc_account") else ""


def write_schedule(config, state):
    rows = []
    for name, cfg in config["domains"].items():
        for url, r in state["domains"][name]["urls"].items():
            rows.append((r.get("scheduled") or "", name, r["status"], url, r.get("coverage") or ""))
    rows.sort(key=lambda x: (x[0] or "9999", x[1], x[3]))
    with open(SCHEDULE_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["day", "domain", "status", "url", "coverage"])
        w.writerows(rows)

    lines = ["# Request-indexing timetable", "",
             f"_Generated {now_iso(config)} by `indexing.py plan`. "
             "Each row is one property's batch for that day; press **Request indexing** on each URL._", ""]
    lines += status_lines(config, state)
    by_day = {}
    for day, name, status, url, _ in rows:
        if day and status in ("scheduled", "requested"):
            by_day.setdefault(day, {}).setdefault(name, []).append((status, url))
    for day in sorted(by_day):
        lines += ["", f"## {day}"]
        for name in config["domains"]:
            batch = by_day[day].get(name)
            if not batch:
                continue
            note = account_note(config["domains"][name])
            lines.append(f"\n**{name}** ({len(batch)}){' · ' + note if note else ''}\n")
            for status, url in batch:
                box = "x" if status == "requested" else " "
                lines.append(f"- [{box}] [{url}]({inspect_link(config['domains'][name], url)})")
    fixes = [(name, url, r.get("issue", "")) for name in config["domains"]
             for url, r in sorted(state["domains"][name]["urls"].items()) if r["status"] == "fix"]
    if fixes:
        lines += ["", "## Needs fixing before it can be requested", "",
                  "Found by `check`. These stay out of the batches until the page is fixed "
                  "(or removed from the sitemap) and `check` passes.", "",
                  "| Domain | URL | Problem |", "|---|---|---|"]
        lines += [f"| {n} | {u} | {i} |" for n, u, i in fixes]
    with open(SCHEDULE_MD, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def status_lines(config, state, domains=None):
    out = ["| Domain | Pages | Indexed | Requested | Waiting | Needs fix | Last batch day | Sync |",
           "|---|---|---|---|---|---|---|---|"]
    for name in pick_domains(config, domains):
        dom = state["domains"][name]
        urls = dom["urls"]
        counts = {}
        for r in urls.values():
            counts[r["status"]] = counts.get(r["status"], 0) + 1
        days = [r["scheduled"] for r in urls.values() if r["status"] in ("scheduled",) and r.get("scheduled")]
        live = len(urls) - counts.get("dropped", 0)
        sync = dom.get("last_sync") or "never"
        if dom.get("sync_note"):
            sync += f" ({dom['sync_note']})"
        out.append(f"| {name} | {live} | {counts.get('indexed', 0)} | {counts.get('requested', 0)} | "
                   f"{counts.get('scheduled', 0) + counts.get('pending', 0)} | {counts.get('fix', 0)} | "
                   f"{max(days) if days else '-'} | {sync} |")
    return out


# ---------------------------------------------------------------- page checks

class PageParser(HTMLParser):
    """Collects <meta name=robots|googlebot>, <link rel=canonical> and <a href> links."""

    def __init__(self):
        super().__init__()
        self.robots, self.canonical, self.links = [], None, set()

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "meta" and a.get("name", "").lower() in ("robots", "googlebot"):
            self.robots.append(a.get("content", "").lower())
        elif tag == "link" and "canonical" in a.get("rel", "").lower().split() and self.canonical is None:
            self.canonical = a.get("href", "").strip()
        elif tag == "a" and a.get("href"):
            self.links.add(a["href"].strip())


def norm(url):
    s = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((s.scheme.lower(), s.netloc.lower(), s.path or "/", s.query, ""))


def check_url(url):
    """Return (problem or None, set of absolute links on the page)."""
    issue, final, links = _check(url)
    return issue, {norm(urllib.parse.urljoin(final, h)) for h in links if not h.startswith(("#", "mailto:", "tel:"))}


def _check(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            final, code = resp.geturl(), resp.status
            xrobots = (resp.headers.get("X-Robots-Tag") or "").lower()
            ctype = resp.headers.get("Content-Type") or ""
            body = resp.read(1_000_000)
    except urllib.error.HTTPError as e:
        return f"HTTP {e.code}", url, set()
    except Exception as e:  # noqa: BLE001
        return f"unreachable: {e}", url, set()
    if norm(final) != norm(url):
        return f"redirects to {final}", final, set()
    if code != 200:
        return f"HTTP {code}", final, set()
    if "noindex" in xrobots:
        return "noindex (X-Robots-Tag header)", final, set()
    if "html" not in ctype:
        return None, final, set()
    parser = PageParser()
    charset = re.search(r"charset=([\w-]+)", ctype)
    try:
        parser.feed(body.decode(charset.group(1) if charset else "utf-8", "replace"))
    except Exception:  # noqa: BLE001 - malformed HTML; judge on what was parsed
        pass
    if any("noindex" in r for r in parser.robots):
        return "noindex (meta robots)", final, parser.links
    if parser.canonical:
        canon = urllib.parse.urljoin(final, parser.canonical)
        if norm(canon) != norm(url):
            return f"canonical points to {canon}", final, parser.links
    return None, final, parser.links


def cmd_check(args, config, state):
    for name in pick_domains(config, args.domain):
        urls = state["domains"][name]["urls"]
        todo = [u for u, r in urls.items() if r["status"] in OPEN + ("fix",) or args.all and r["status"] != "dropped"]
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            checked = dict(zip(todo, pool.map(check_url, todo)))
        results = {u: issue for u, (issue, _) in checked.items()}
        # Inlinks: how many distinct checked pages link to each sitemap URL.
        inlinks = {norm(u): 0 for u in urls}
        for src, (_, links) in checked.items():
            for dst in links - {norm(src)}:
                if dst in inlinks:
                    inlinks[dst] += 1
        # A partial check only sees some of the linking pages, so it can raise a
        # count but never lower it.
        full = len(checked) >= sum(1 for r in urls.values() if r["status"] != "dropped")
        for u, rec in urls.items():
            n = inlinks[norm(u)]
            rec["inlinks"] = n if full else max(rec.get("inlinks", 0), n)
        bad = 0
        for url, issue in results.items():
            rec = urls[url]
            rec["checked"] = now_iso(config)
            rec["issue"] = issue
            if issue:
                bad += 1
                if rec["status"] in OPEN + ("fix",):
                    rec["status"] = "fix"
            elif rec["status"] == "fix":
                rec["status"] = "pending"
        print(f"{name}: checked {len(todo)}, {bad} can't be indexed as they stand")
        kinds = {}
        for issue in results.values():
            if issue:
                k = issue.split(" to ")[0].split(":")[0]
                kinds[k] = kinds.get(k, 0) + 1
        for k, v in sorted(kinds.items(), key=lambda x: -x[1]):
            print(f"  - {v} × {k}")
    plan(config, state, domains=args.domain)


# ---------------------------------------------------------------- timetable page

PAGE_TEMPLATE = os.path.join(HERE, "timetable_template.html")
PAGE_OUT = os.path.join(HERE, "timetable.html")
PAGE_STATUS = {"scheduled": "s", "pending": "s", "requested": "r", "indexed": "i"}


def tick_id(url):
    """Document id for a URL in the page's `ticks` collection (path-safe)."""
    import hashlib
    return "u" + hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]


def cmd_page(args, config, state):
    sites, rows = [], []
    for si, (name, cfg) in enumerate(config["domains"].items()):
        sites.append({"name": name, "property": cfg["property"], "account": cfg.get("gsc_account", "")})
        urls = state["domains"][name]["urls"]
        for url, r in urls.items():
            st = PAGE_STATUS.get(r["status"])
            if st is None or not r.get("scheduled"):
                continue
            path = url.split(name, 1)[1] or "/"
            rows.append((r["scheduled"], si, rank_key(url, r, cfg), [tick_id(url), si, path, r["scheduled"], st]))
    rows.sort(key=lambda x: x[:3])
    data = {"generated": dt.datetime.now(tz(config)).strftime("%-d %b %Y, %H:%M"), "tz": config.get("timezone", "UTC"),
            "quota": int(config.get("daily_quota", 10)), "sites": sites, "urls": [r[3] for r in rows]}
    with open(PAGE_TEMPLATE, encoding="utf-8") as f:
        html = f.read()
    marker = "/*DATA*/null"
    assert html.count(marker) == 1, "template must contain exactly one /*DATA*/null"
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    with open(PAGE_OUT, "w", encoding="utf-8") as f:
        f.write(html.replace(marker, payload))
    print(f"wrote {os.path.relpath(PAGE_OUT)}: {len(rows)} scheduled/requested URLs, {len(set(r[0] for r in rows))} days")


def cmd_apply_ticks(args, config, state):
    """Apply ticks exported from the page's `ticks` collection (a JSON list of
    documents, or an object with a `documents`/`docs` list)."""
    with open(args.file, encoding="utf-8") as f:
        raw = json.load(f)
    docs = raw if isinstance(raw, list) else raw.get("documents") or raw.get("docs") or []
    by_url = {}
    for name in config["domains"]:
        for url, rec in state["domains"][name]["urls"].items():
            by_url[url] = rec
    changed = {"requested": 0, "indexed": 0}
    for d in docs:
        body = d.get("data", d) if isinstance(d, dict) else {}
        rec = by_url.get(body.get("url"))
        if rec is None:
            continue
        if body.get("state") == "on_google" and rec["status"] != "indexed":
            rec["status"] = "indexed"
            changed["indexed"] += 1
        elif body.get("state") == "requested" and rec["status"] in OPEN + ("fix",):
            rec["status"] = "requested"
            rec["requested"].append(body.get("at") or now_iso(config))
            changed["requested"] += 1
    print(f"applied ticks: {changed['requested']} requested, {changed['indexed']} already on Google")
    plan(config, state)


# ---------------------------------------------------------------- Search Console API

def gsc_token():
    token = os.environ.get("GSC_ACCESS_TOKEN")
    if token:
        return token
    key = os.environ.get("GSC_SERVICE_ACCOUNT_JSON")
    if not key:
        return None
    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
    except ImportError:
        sys.exit("GSC_SERVICE_ACCOUNT_JSON is set but google-auth is missing: pip install google-auth requests")
    # The variable holds either the key file's path or the key JSON itself.
    if key.lstrip().startswith("{"):
        creds = service_account.Credentials.from_service_account_info(json.loads(key), scopes=[GSC_SCOPE])
    else:
        creds = service_account.Credentials.from_service_account_file(key, scopes=[GSC_SCOPE])
    creds.refresh(Request())
    return creds.token


def gsc_call(method, url, token, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode("utf-8", "replace")[:500]}


# ---------------------------------------------------------------- commands

def cmd_sync(args, config, state):
    for name in pick_domains(config, args.domain):
        dom = state["domains"][name]
        urls, notes = crawl_sitemaps(name, config["domains"][name])
        if not urls:
            dom["sync_note"] = "no URLs fetched"
            print(f"{name}: no URLs fetched")
            for n in notes:
                print(f"  - {n}")
            continue
        added = add_urls(dom, urls, config, "sitemap")
        dropped = 0
        for url, rec in dom["urls"].items():
            if rec["source"] == "sitemap" and url not in urls and rec["status"] in OPEN + ("fix",):
                rec["status"] = "dropped"
                dropped += 1
        dom["last_sync"] = now_iso(config)
        dom["sync_note"] = ""
        print(f"{name}: {len(urls)} URLs in sitemaps, {added} new, {dropped} dropped")
        for n in notes[:20]:
            print(f"  - {n}")
    plan(config, state, domains=args.domain)


def read_url_file(path):
    """URLs from a sitemap .xml, a .txt (one per line) or a .csv (first http cell per row)."""
    with open(path, "rb") as f:
        raw = f.read()
    if raw.lstrip().startswith(b"<"):
        return [u for u, _ in parse_sitemap(raw)[1]]
    urls = []
    for row in csv.reader(raw.decode("utf-8-sig", "replace").splitlines()):
        for cell in row:
            cell = cell.strip()
            if cell.startswith("http"):
                urls.append(cell)
                break
    return urls


def cmd_import(args, config, state):
    name = args.domain_name
    pick_domains(config, [name])
    with open(args.file, "rb") as f:
        raw = f.read()
    urls = {}
    if raw.lstrip().startswith(b"<"):
        _, entries = parse_sitemap(raw)
        urls = dict(entries)
    else:
        for row in csv.reader(raw.decode("utf-8-sig", "replace").splitlines()):
            for cell in row:
                cell = cell.strip()
                if cell.startswith("http"):
                    urls[cell] = 0.5
                    break
    urls = {u: p for u, p in urls.items() if host_of(u) == name}
    added = add_urls(state["domains"][name], urls, config, "import")
    print(f"{name}: {len(urls)} URLs read from {args.file}, {added} new")
    plan(config, state, domains=[name])


def cmd_plan(args, config, state):
    start = dt.date.fromisoformat(args.start) if args.start else None
    plan(config, state, start=start, domains=args.domain)
    print("\n".join(status_lines(config, state)))
    print(f"\nwrote {os.path.relpath(SCHEDULE_MD)} and {os.path.relpath(SCHEDULE_CSV)}")


def batch_for(config, state, name, day):
    urls = state["domains"][name]["urls"]
    return sorted((u for u, r in urls.items() if r.get("scheduled") == day and r["status"] in ("scheduled", "requested")),
                  key=lambda u: rank_key(u, urls[u], config["domains"][name]))


def cmd_today(args, config, state):
    day = args.date or today(config).isoformat()
    lines = [f"# Request indexing — {day}", ""]
    total = 0
    for name in pick_domains(config, args.domain):
        cfg = config["domains"][name]
        batch = batch_for(config, state, name, day)
        lines.append(f"## {name}  ·  property `{cfg['property']}`")
        if cfg.get("gsc_account"):
            lines.append(f"Open these in the Chrome profile signed in as **{cfg['gsc_account']}**.")
        if not cfg.get("gsc_verified", True):
            lines.append("> Not verified in Search Console yet — verify the property first (see README).")
        if not batch:
            lines.append("_Nothing scheduled for today._\n")
            continue
        total += len(batch)
        for url in batch:
            done = state["domains"][name]["urls"][url]["status"] == "requested"
            lines.append(f"- [{'x' if done else ' '}] [{url}]({inspect_link(cfg, url)})")
        lines.append("")
    lines.append(f"_{total} URLs today. When done: `python3 _indexing/indexing.py mark requested --date {day}`_")
    text = "\n".join(lines) + "\n"
    with open(TODAY_MD, "w", encoding="utf-8") as f:
        f.write(text)
    print(text)


def cmd_mark(args, config, state):
    stamp = now_iso(config)
    changed = 0
    for name in pick_domains(config, args.domain):
        urls = state["domains"][name]["urls"]
        if args.file:
            targets = [u for u in read_url_file(args.file) if host_of(u) == name]
        elif args.urls:
            targets = list(args.urls)
        else:
            targets = batch_for(config, state, name, args.date or today(config).isoformat())
        for url in targets:
            rec = urls.get(url)
            if rec is None or rec["status"] == args.status:
                continue
            rec["status"] = args.status
            if args.status == "requested":
                rec["requested"].append(stamp)
            changed += 1
    write_schedule(config, state)
    print(f"marked {changed} URL(s) {args.status}")


def cmd_inspect(args, config, state):
    token = gsc_token()
    if not token:
        sys.exit("no Search Console credentials: set GSC_ACCESS_TOKEN or GSC_SERVICE_ACCOUNT_JSON (see README)")
    limit = args.limit
    min_age = dt.timedelta(days=args.min_age_days)
    now = dt.datetime.now(tz(config))
    for name in pick_domains(config, args.domain):
        cfg = config["domains"][name]
        urls = state["domains"][name]["urls"]
        todo = []
        for url, r in urls.items():
            if r["status"] in DONE:
                continue
            last = r["requested"][-1] if r["requested"] else None
            if r["status"] == "requested" and last and now - dt.datetime.fromisoformat(last) < min_age:
                continue
            todo.append(url)
        todo.sort(key=lambda u: (urls[u].get("last_inspected") or "", rank_key(u, urls[u], cfg)))
        n_idx = 0
        for url in todo[:limit]:
            code, res = gsc_call("POST", "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", token,
                                 {"inspectionUrl": url, "siteUrl": cfg["property"]})
            if code != 200:
                print(f"{name}: inspect failed {code} for {url}: {res.get('error', '')[:200]}")
                if code in (401, 403, 429):
                    break
                continue
            idx = res.get("inspectionResult", {}).get("indexStatusResult", {})
            rec = urls[url]
            rec["last_inspected"] = now_iso(config)
            rec["coverage"] = idx.get("coverageState")
            if idx.get("verdict") == "PASS":
                rec["status"] = "indexed"
                n_idx += 1
        print(f"{name}: inspected {min(len(todo), limit)}, {n_idx} newly confirmed indexed")
    plan(config, state, domains=args.domain)


def cmd_submit_sitemaps(args, config, state):
    token = gsc_token()
    if not token:
        sys.exit("no Search Console credentials: set GSC_ACCESS_TOKEN or GSC_SERVICE_ACCOUNT_JSON (see README)")
    for name in pick_domains(config, args.domain):
        cfg = config["domains"][name]
        site = urllib.parse.quote(cfg["property"], safe="")
        for sm in cfg.get("sitemaps", []):
            code, res = gsc_call("PUT", f"https://searchconsole.googleapis.com/webmasters/v3/sites/{site}/sitemaps/"
                                        f"{urllib.parse.quote(sm, safe='')}", token)
            print(f"{name}: submit {sm} -> {code} {res.get('error', '')[:200]}")


def cmd_indexnow(args, config, state):
    for name in pick_domains(config, args.domain):
        cfg = config["domains"][name]
        key = cfg.get("indexnow_key")
        if not key:
            print(f"{name}: no indexnow_key in config.json, skipped")
            continue
        urls = [u for u, r in state["domains"][name]["urls"].items() if r["status"] != "dropped"]
        if not args.all:
            urls = [u for u in urls if not state["domains"][name]["urls"][u].get("indexnow")]
        if not urls:
            print(f"{name}: nothing new for IndexNow")
            continue
        body = {"host": name, "key": key, "keyLocation": f"https://{name}/{key}.txt", "urlList": urls[:10000]}
        req = urllib.request.Request("https://api.indexnow.org/indexnow", data=json.dumps(body).encode(),
                                     method="POST", headers={"Content-Type": "application/json; charset=utf-8",
                                                             "User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                code = resp.status
        except urllib.error.HTTPError as e:
            code = e.code
        except Exception as e:  # noqa: BLE001
            print(f"{name}: IndexNow failed: {e}")
            continue
        print(f"{name}: IndexNow {len(body['urlList'])} URLs -> HTTP {code}")
        if code in (200, 202):
            stamp = now_iso(config)
            for u in body["urlList"]:
                state["domains"][name]["urls"][u]["indexnow"] = stamp


def remaining(config, state, name):
    """URLs on `name` that still need something: not yet requested, or
    requested less than 14 days ago and not confirmed indexed. Requested 14+
    days ago and still not indexed counts as finished for the timetable;
    `status` lists those as fix items."""
    cutoff = (dt.datetime.now(tz(config)) - dt.timedelta(days=14)).isoformat()
    left = []
    for url, r in state["domains"][name]["urls"].items():
        if r["status"] in OPEN:
            left.append(url)
        elif r["status"] == "requested" and (not r["requested"] or r["requested"][0] >= cutoff):
            left.append(url)
    return left


def cmd_done(args, config, state):
    all_done = True
    for name in pick_domains(config, args.domain):
        left = remaining(config, state, name)
        waiting = sum(1 for u in left if state["domains"][name]["urls"][u]["status"] in OPEN)
        if left:
            all_done = False
            print(f"{name}: NOT DONE — {waiting} still to request, {len(left) - waiting} requested and awaiting confirmation")
        else:
            print(f"{name}: DONE")
    print("ALL DONE" if all_done else "NOT DONE")


def cmd_status(args, config, state):
    print("\n".join(status_lines(config, state, args.domain)))
    t = today(config).isoformat()
    for name in pick_domains(config, args.domain):
        overdue = [u for u, r in state["domains"][name]["urls"].items()
                   if r["status"] == "scheduled" and r.get("scheduled") and r["scheduled"] < t]
        if overdue:
            print(f"{name}: {len(overdue)} scheduled URL(s) overdue — run `plan` to slide them forward")
        cutoff = (dt.datetime.now(tz(config)) - dt.timedelta(days=14)).isoformat()
        stuck = [u for u, r in state["domains"][name]["urls"].items()
                 if r["status"] == "requested" and r["requested"] and r["requested"][0] < cutoff]
        if stuck:
            print(f"{name}: {len(stuck)} URL(s) requested 14+ days ago and not confirmed indexed — "
                  "check them in Search Console; fix any that aren't indexed instead of re-requesting")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    def with_domain(sp):
        sp.add_argument("--domain", action="append", help="limit to this domain (repeatable)")
        return sp

    with_domain(sub.add_parser("sync", help="pull sitemaps and re-plan"))
    sp = sub.add_parser("import", help="add URLs from a sitemap .xml, .txt or GSC .csv export")
    sp.add_argument("domain_name")
    sp.add_argument("file")
    sp = with_domain(sub.add_parser("plan", help="deal open URLs into daily batches"))
    sp.add_argument("--start", help="first batch day, YYYY-MM-DD (default: today)")
    sp = with_domain(sub.add_parser("today", help="print and write today's batch"))
    sp.add_argument("--date", help="YYYY-MM-DD (default: today)")
    sp = with_domain(sub.add_parser("mark", help="mark a day's batch or given URLs"))
    sp.add_argument("status", choices=["requested", "indexed", "excluded", "scheduled"])
    sp.add_argument("--date", help="batch day to mark (default: today)")
    sp.add_argument("--file", help="mark every URL listed in this .txt/.csv (e.g. a Search Console export)")
    sp.add_argument("urls", nargs="*")
    sp = with_domain(sub.add_parser("inspect", help="check index status through the URL Inspection API"))
    sp.add_argument("--limit", type=int, default=500, help="max inspections per domain (API allows 2000/day)")
    sp.add_argument("--min-age-days", type=int, default=3, help="skip URLs requested more recently than this")
    sp = with_domain(sub.add_parser("check", help="fetch each open URL; set aside ones that can't be indexed"))
    sp.add_argument("--all", action="store_true", help="also re-check requested and indexed URLs")
    sp.add_argument("--workers", type=int, default=6)
    sub.add_parser("page", help="build timetable.html for the published timetable page")
    sp = sub.add_parser("apply-ticks", help="apply ticks exported from the timetable page")
    sp.add_argument("file")
    with_domain(sub.add_parser("submit-sitemaps", help="submit configured sitemaps through the GSC API"))
    sp = with_domain(sub.add_parser("indexnow", help="ping IndexNow engines"))
    sp.add_argument("--all", action="store_true", help="resend every URL, not just ones never sent")
    with_domain(sub.add_parser("status", help="summary per domain"))
    with_domain(sub.add_parser("done", help="say whether each domain is finished"))

    args = p.parse_args()
    config, state = load()
    handler = {"sync": cmd_sync, "import": cmd_import, "plan": cmd_plan, "today": cmd_today, "mark": cmd_mark,
               "inspect": cmd_inspect, "check": cmd_check, "page": cmd_page, "apply-ticks": cmd_apply_ticks, "submit-sitemaps": cmd_submit_sitemaps, "indexnow": cmd_indexnow,
               "status": cmd_status, "done": cmd_done}[args.cmd]
    handler(args, config, state)
    save_json(STATE_PATH, state)


if __name__ == "__main__":
    main()
