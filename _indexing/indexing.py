#!/usr/bin/env python3
"""Indexing tracker for leadsupcallcenter.com, weshastones.com and weshamarble.com.

Google's "Request indexing" button (URL Inspection) has no public API and a
small daily quota per property, so this tool does the bookkeeping around it:
it collects every page from each site's sitemaps, ranks them, deals them out
into daily batches that fit the quota, and tracks each URL until Google
reports it indexed.

  python3 _indexing/indexing.py sync               # pull sitemaps, add new URLs
  python3 _indexing/indexing.py import D FILE      # add URLs from a sitemap/txt/csv export
  python3 _indexing/indexing.py plan               # (re)deal unrequested URLs into daily batches
  python3 _indexing/indexing.py today              # today's batch, with URL Inspection links
  python3 _indexing/indexing.py mark requested --date 2026-10-05
  python3 _indexing/indexing.py inspect            # GSC URL Inspection API (needs credentials)
  python3 _indexing/indexing.py submit-sitemaps    # GSC Sitemaps API (needs credentials)
  python3 _indexing/indexing.py indexnow           # Bing/Yandex/Seznam/Naver via IndexNow
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
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
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

def rank_key(url, info):
    path = urllib.parse.urlsplit(url).path or "/"
    depth = len([p for p in path.split("/") if p])
    return (0 if path == "/" else 1, -info.get("priority", 0.5), depth, url)


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
            key=lambda u: rank_key(u, urls[u]),
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
    with open(SCHEDULE_MD, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def status_lines(config, state):
    out = ["| Domain | Pages | Indexed | Requested | Waiting | Last batch day | Sync |",
           "|---|---|---|---|---|---|---|"]
    for name in config["domains"]:
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
                   f"{counts.get('scheduled', 0) + counts.get('pending', 0)} | {max(days) if days else '-'} | {sync} |")
    return out


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
            if rec["source"] == "sitemap" and url not in urls and rec["status"] in OPEN:
                rec["status"] = "dropped"
                dropped += 1
        dom["last_sync"] = now_iso(config)
        dom["sync_note"] = ""
        print(f"{name}: {len(urls)} URLs in sitemaps, {added} new, {dropped} dropped")
        for n in notes[:20]:
            print(f"  - {n}")
    plan(config, state, domains=args.domain)


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
                  key=lambda u: rank_key(u, urls[u]))


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
        targets = list(args.urls) if args.urls else batch_for(config, state, name, args.date or today(config).isoformat())
        for url in targets:
            rec = urls.get(url)
            if rec is None:
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
        todo.sort(key=lambda u: (urls[u].get("last_inspected") or "", rank_key(u, urls[u])))
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


def cmd_status(args, config, state):
    print("\n".join(status_lines(config, state)))
    t = today(config).isoformat()
    for name in config["domains"]:
        overdue = [u for u, r in state["domains"][name]["urls"].items()
                   if r["status"] == "scheduled" and r.get("scheduled") and r["scheduled"] < t]
        if overdue:
            print(f"{name}: {len(overdue)} scheduled URL(s) overdue — run `plan` to slide them forward")
        cutoff = (dt.datetime.now(tz(config)) - dt.timedelta(days=14)).isoformat()
        stuck = [u for u, r in state["domains"][name]["urls"].items()
                 if r["status"] == "requested" and r["requested"] and r["requested"][0] < cutoff]
        if stuck:
            print(f"{name}: {len(stuck)} URL(s) requested 14+ days ago and still not indexed — fix, don't re-request")


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
    sp.add_argument("urls", nargs="*")
    sp = with_domain(sub.add_parser("inspect", help="check index status through the URL Inspection API"))
    sp.add_argument("--limit", type=int, default=500, help="max inspections per domain (API allows 2000/day)")
    sp.add_argument("--min-age-days", type=int, default=3, help="skip URLs requested more recently than this")
    with_domain(sub.add_parser("submit-sitemaps", help="submit configured sitemaps through the GSC API"))
    sp = with_domain(sub.add_parser("indexnow", help="ping IndexNow engines"))
    sp.add_argument("--all", action="store_true", help="resend every URL, not just ones never sent")
    with_domain(sub.add_parser("status", help="summary per domain"))

    args = p.parse_args()
    config, state = load()
    handler = {"sync": cmd_sync, "import": cmd_import, "plan": cmd_plan, "today": cmd_today, "mark": cmd_mark,
               "inspect": cmd_inspect, "submit-sitemaps": cmd_submit_sitemaps, "indexnow": cmd_indexnow,
               "status": cmd_status}[args.cmd]
    handler(args, config, state)
    save_json(STATE_PATH, state)


if __name__ == "__main__":
    main()
