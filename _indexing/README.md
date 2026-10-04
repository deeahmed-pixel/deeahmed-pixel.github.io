# Indexing plan: leadsupcallcenter.com · weshastones.com · weshamarble.com

This folder runs the indexing work for the three sites. The Claude Code session
"Page indexing for three domains" is where it happens: a routine wakes that
session every morning and it posts the day's URLs. The folder name starts with
an underscore, so GitHub Pages (Jekyll) never publishes it with this site.

## Where each site stands (4 Oct 2026, from the Search Console emails)

| Site | Search Console property | Known state |
|---|---|---|
| leadsupcallcenter.com | `https://leadsupcallcenter.com/` (URL prefix), verified 1 Sep 2026 | No indexing alerts so far. `data.leadsupcallcenter.com` is a separate property with its own "Blocked by robots.txt" and "Duplicate without user-selected canonical" alerts. It's outside this plan. |
| weshastones.com | `sc-domain:weshastones.com` (Domain), verified 26 Aug 2026 | Getting impressions since 26 Aug. It reached 30 clicks in 28 days on 21 Sep. Open alerts: **Not found (404)**, **Excluded by 'noindex' tag**, **Alternate page with proper canonical**, and **Crawled – currently not indexed** (validation partly failed on 16 Sep). |
| weshamarble.com | `sc-domain:weshamarble.com` (Domain), owned by **adnan@weshamarble.com** | Verified. Search Console emailed adnan@weshamarble.com on 20 Sep about new reasons preventing indexing. That inbox isn't connected here, so the reasons are still unread on this side. |

**Pages and finish dates** (first sync on 4 Oct 2026, 10 requests per site per
day, all three sites in parallel):

| Site | Pages in sitemap | Batches | First batch | Last batch |
|---|---|---|---|---|
| leadsupcallcenter.com | 42 | 5 | Sun 4 Oct | Thu 8 Oct 2026 |
| weshamarble.com | 307 (302 root + 5 `/en/`) | 31 | Sun 4 Oct | Tue 3 Nov 2026 |
| weshastones.com | 1,029 in 9 languages (en 152, it 142, de 139, es 139, fr 138, tr 138, hu 134, ar 46, zh 1) | 103 | Sun 4 Oct | Thu 14 Jan 2027 |

`check` fetched every page on 4 Oct. None returned an error or a redirect,
carried `noindex`, or pointed its canonical at another URL, so all 1,378 pages
are eligible. The last-batch dates are the worst case. Pages Google indexes on
its own drop out as soon as they're confirmed, through the `inspect` API or
because you saw "URL is on Google".

## Which Chrome profile requests which site

Request indexing only works from a Google account that has access to the
property. Each site's links go in that account's Chrome profile.

| Site | Chrome profile / Google account | How we know |
|---|---|---|
| leadsupcallcenter.com | **deeahmed@leadsupcallcenter.com** | Search Console verification emails for `https://leadsupcallcenter.com/` go to this inbox |
| weshastones.com | **deeahmed@leadsupcallcenter.com** | All weshastones.com Search Console emails go to this inbox |
| weshamarble.com | **adnan@weshamarble.com** | Its Search Console alert (20 Sep) arrived in this inbox |

The info@weshastones.com profile isn't needed. Even if it's also an owner of
weshastones.com, the quota of about 10 requests a day belongs to the
property, not the account. A second profile doesn't add requests.

The daily checklist puts the right account above each site's links. Each link
also carries `authuser=<that account>`, which picks the account when several
are signed in to one Chrome profile. In practice: click the leadsupcallcenter
and weshastones links from the deeahmed@leadsupcallcenter.com window. Copy the
weshamarble links into the adnan@weshamarble.com window. If you click those
from the deeahmed window, Search Console says you don't have access.

## Why the old routine couldn't work

1. **Nothing can press Google's "Request indexing" button for you.** It exists
   only in the Search Console UI, and Google limits it to a small daily quota
   per property (roughly 10 URLs; Google doesn't publish the exact number). The
   Google Indexing API is officially limited to JobPosting and livestream
   pages, and Google treats other use as spam, so this plan doesn't use it.
2. **The routine's environment couldn't reach the sites.** The same network
   block applies to every session in this environment.

So the automated parts are: tracking, scheduling, status checks, sitemap
submission and IndexNow. The button press stays with you, in batches the
quota allows.

## What each channel does

| Channel | Effect | Automated here? | Limit |
|---|---|---|---|
| Sitemap submitted in GSC | Google learns every URL at once | Yes with credentials (`submit-sitemaps`), or once by hand | none in practice |
| URL Inspection → **Request indexing** | Priority crawl of one URL | **No, manual button** | about 10 per property per day |
| URL Inspection API | Reads "indexed / not indexed and why" | Yes with credentials (`inspect`) | 2,000 per property per day |
| IndexNow | Bing, Yandex, Seznam, Naver and Yep crawl at once (Bing also feeds Copilot and ChatGPT search) | Yes (`indexnow`) | 10,000 URLs per call |

## Timetable

### Phase 0: setup (Mon 5 Oct, about 30–45 min, you)

1. **Delete the old routine.** It isn't in the cloud Routines list for this
   account, so it's likely a local scheduled task in the Claude desktop app.
   Delete it there.
2. ✅ *Done 4 Oct.* **Open network access for this environment.** Open the cloud environment
   menu in the session title bar, then Edit, then Network access. Choose Custom
   and keep the default package-manager list. Add `leadsupcallcenter.com`,
   `www.leadsupcallcenter.com`, `weshastones.com`, `www.weshastones.com`,
   `weshamarble.com`, `www.weshamarble.com` and `api.indexnow.org`.
3. **weshamarble.com: read the 20 Sep alert** in the adnan@weshamarble.com
   inbox ("New reasons prevent pages from being indexed"). Fix whatever it
   names before that site's batches start, the same as step 5.
4. **Submit the sitemap** for each property in Search Console under Sitemaps.
   Use the profile from the table above.
5. **weshastones.com: fix before you request.** URLs that return 404 or carry
   `noindex` waste the daily quota. Take them out of the sitemap, or fix them,
   before their batch comes up. `sync` drops any URL that leaves the sitemap.
6. **IndexNow key files.** Upload one text file to each site root. The file
   name is `<key>.txt` and its only content is the key. Keys are in
   `config.json`. They're meant to be public.

   | Site | File to upload at the site root |
   |---|---|
   | leadsupcallcenter.com | `11e8ac2284d19f26e34712f6578d2b8d.txt` |
   | weshastones.com | `8e78ff8430fb758377b0f1471e8fe529.txt` |
   | weshamarble.com | `8a3e9c14127f496749a9fd285f33d9c1.txt` |

7. *(Optional: lets the session confirm "indexed" by itself.)* In Google Cloud,
   create a service account and enable the **Google Search Console API**. Add
   the service account's email as a **Full** user on each property in Search
   Console (Settings, then Users and permissions). Do it from the deeahmed
   profile for leadsupcallcenter.com and weshastones.com, and from the adnan
   profile for weshamarble.com. Store the key JSON in this
   environment's settings as the variable `GSC_SERVICE_ACCOUNT_JSON`. Never
   paste it into chat. Without it, you mark pages indexed from what Search
   Console shows.

### Phase 1: daily batches (every day from Mon 5 Oct, 09:56 Cairo time)

All three sites start as soon as their URL lists are in. Until a site's list
is loaded (network access, or an `import`), the morning run for that site has
nothing to post and just names what's blocking it.

| When | Who | What |
|---|---|---|
| 09:56 | routine → session | `sync` → `check` → `today`. Posts up to **10 URLs per property**, each linking straight to its URL Inspection page. Pages that broke since the last run are set aside as fix items. |
| any time that day | you | Open each link in the profile named above it and press **Request indexing**. That's about 30 a day across the three sites, around 1 minute each. |
| after | you → session | Reply **done**, or "done except …". The session runs `mark requested` and commits. |

Batch order per site:

1. The homepage.
2. Each language in turn. weshastones.com goes English, Arabic, Italian,
   French, Spanish, German, Turkish, Hungarian, then Chinese (`lang_order` in
   `config.json`). weshamarble.com does its root pages before `/en/`.
3. Within a language, sitemap priority first. Then the pages most linked from
   the rest of the site, so hubs and categories come before deep product
   pages.
4. Privacy and terms pages go last.

Each language version is its own URL and takes its own slot. Requesting
English first also exposes the other languages to Google through hreflang, so
many of them may be indexed before their turn comes.

If a link opens on **"URL is on Google"**, there's nothing to request. Tell
the session, for example "done, 3 were already on Google", and those get
marked indexed.
A missed day doesn't break the plan. Unrequested URLs slide forward on the next
`plan` run.

### Phase 2: status loop (runs alongside Phase 1)

- **Daily** (only if step 7 is done): `inspect` checks URLs requested 3 or more
  days ago, and confirmed-indexed URLs close out.
- **Mondays**: `sync` picks up new pages, `indexnow` sends any URL not yet
  sent, and the session reads the Search Console Page indexing report emails.
- **URLs still not indexed 14 days after their request** are not requested
  again. Repeating doesn't help, and the session lists them as content or
  technical fixes instead.

### Finish line

The plan is finished when every live sitemap URL on all three sites is
`indexed`, or deliberately `excluded` (thank-you pages, duplicates). The three
sites run in parallel, so each takes about **pages ÷ 10** days of requests:
100 pages take about 10 days, 300 pages about 30. `schedule.md` gives the exact
date for each site after the first sync. The daily routine is deleted once
`status` shows nothing waiting.

## Commands

```bash
python3 _indexing/indexing.py sync                  # read sitemaps (robots.txt Sitemap: lines too), re-plan
python3 _indexing/indexing.py import weshastones.com export.csv   # add URLs from a GSC export / .txt / sitemap file
python3 _indexing/indexing.py check [--all]         # fetch pages: errors, redirects, noindex, foreign canonicals; count internal links
python3 _indexing/indexing.py plan [--start 2026-10-06]
python3 _indexing/indexing.py today                 # writes today.md
python3 _indexing/indexing.py mark requested        # today's batch; or --date D, or list URLs
python3 _indexing/indexing.py mark excluded URL...  # deliberately not indexed
python3 _indexing/indexing.py inspect               # needs GSC credentials
python3 _indexing/indexing.py submit-sitemaps       # needs GSC credentials
python3 _indexing/indexing.py indexnow              # needs key files live on each site
python3 _indexing/indexing.py status
```

`import` is the fallback while the domains are blocked. In Search Console,
open Pages, then a "Not indexed" reason, then Export, and hand the CSV over.
The same works with a downloaded `sitemap.xml`.

## Files

| File | What |
|---|---|
| `config.json` | Properties, sitemap URLs, daily quota, timezone, IndexNow keys |
| `state.json` | Every URL with its status (`scheduled` → `requested` → `indexed`; also `fix`, `excluded` and `dropped`), its problem if any, its internal link count, and its request history |
| `schedule.md` / `schedule.csv` | The full day-by-day timetable |
| `today.md` | Today's checklist |
