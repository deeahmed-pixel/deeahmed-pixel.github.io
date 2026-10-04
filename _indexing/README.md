# Indexing plan: leadsupcallcenter.com · leadsupdata.com · weshastones.com · weshamarble.com

This folder runs the indexing work for the four sites. The Claude Code session
"Page indexing for three domains" is where it happens: a routine wakes that
session every morning, and it refreshes the **timetable page**:
https://claude.ai/artifact/RYo5J2S8my4gHALMqzU1re

The page shows each day's links grouped by Chrome profile. It has a
"Requested" tick and an "On Google" button for each page, and the full
calendar and progress for every site. Ticks are saved with the page, and the
morning run reads them, so nothing has to be reported back by hand.
`indexing.py page` builds `timetable.html` from `state.json` and
`timetable_template.html`. The folder name starts with
an underscore, so GitHub Pages (Jekyll) never publishes it with this site.

## Where each site stands (4 Oct 2026, from the Search Console emails)

| Site | Search Console property | Known state |
|---|---|---|
| leadsupcallcenter.com | `https://leadsupcallcenter.com/` (URL prefix), verified 1 Sep 2026 | No indexing alerts so far. |
| data.leadsupcallcenter.com | `https://data.leadsupcallcenter.com/` (URL prefix), verified 1 Sep 2026 | **Moved.** Every URL now 301s to the same path on leadsupdata.com, so there's nothing left to request here. Its old alerts ("Blocked by robots.txt", "Duplicate without user-selected canonical") go away as Google follows the redirects. What it needs is **Change of address** to leadsupdata.com (setup step 2). |
| leadsupdata.com | `https://leadsupdata.com/` (URL prefix), verified 23 Sep 2026 | Impressions since 24 Sep. Structured-data alerts on 1 Oct. **Datasets** has a critical problem, a missing `description`, so those pages can't show as dataset results until it's fixed. It also has two non-critical ones: `creator` has the wrong type and `license` is missing. **Product snippets** has two non-critical ones: missing `review` and `aggregateRating`. None of them blocks indexing. |
| weshastones.com | `sc-domain:weshastones.com` (Domain), verified 26 Aug 2026 by deeahmed@leadsupcallcenter.com | Getting impressions since 26 Aug. It reached 30 clicks in 28 days on 21 Sep. Open alerts: **Not found (404)**, **Excluded by 'noindex' tag**, **Alternate page with proper canonical**, and **Crawled – currently not indexed** (validation partly failed on 16 Sep). |
| weshamarble.com | `sc-domain:weshamarble.com` (Domain), owned by **adnan@weshamarble.com** | Verified. Search Console emailed adnan@weshamarble.com on 20 Sep about new reasons preventing indexing. That inbox isn't connected here, so the reasons are still unread on this side. |

**Pages and finish dates** (first sync on 4 Oct 2026, 10 requests per site per
day, all four sites in parallel):

| Site | Pages in sitemap | Batches | First batch | Last batch |
|---|---|---|---|---|
| leadsupcallcenter.com | 42 | 5 | Sun 4 Oct | Thu 8 Oct 2026 |
| leadsupdata.com | 54 (24 of them under `/florida/`) | 6 | Sun 4 Oct | Fri 9 Oct 2026 |
| weshamarble.com | 307 (302 root + 5 `/en/`) | 31 | Sun 4 Oct | Tue 3 Nov 2026 |
| weshastones.com | 1,029 in 9 languages (en 152, it 142, de 139, es 139, fr 138, tr 138, hu 134, ar 46, zh 1) | 103 | Sun 4 Oct | Thu 14 Jan 2027 |

`check` fetched every page on 4 Oct. None returned an error or a redirect,
carried `noindex`, or pointed its canonical at another URL, so all 1,432 pages
are eligible. The last-batch dates are the worst case. Pages Google indexes on
its own drop out as soon as they're confirmed, through the `inspect` API or
because you saw "URL is on Google".

## One Google account per site

Each site is worked from its own Google account, in its own Chrome profile:

| Chrome profile / Google account | Sites | Search Console access today |
|---|---|---|
| **deeahmed@leadsupcallcenter.com** | leadsupcallcenter.com, leadsupdata.com (and data.leadsupcallcenter.com, for the change of address) | Verified owner of all three |
| **info@weshastones.com** | weshastones.com | **Needs adding.** deeahmed@leadsupcallcenter.com verified this property, so info@ only gets access once it's added as an owner (step 1 below) |
| **adnan@weshamarble.com** | weshamarble.com | Verified owner |

The daily checklist is grouped by these profiles. Each link carries
`authuser=<that account>`. Open each group's links in its own Chrome window. A
link opened in the wrong profile gets "You don't have access to this property".

The daily quota of about 10 requests belongs to the property, so splitting
accounts keeps things organised but doesn't add requests.

**Moving weshastones.com to info@weshastones.com:**

1. ✅ *Done by 4 Oct: info@weshastones.com can open the property.* **Give info@ access.** In the deeahmed@leadsupcallcenter.com
   window, open Search Console, then the `weshastones.com` property, then
   Settings, Users and permissions, and **Add user**. Enter
   `info@weshastones.com` and set Permission to **Owner**. info@ can now use
   the property and receives its alerts.
2. **Take deeahmed out** (asked for on 4 Oct). Do this from the
   info@weshastones.com window, in this order. weshastones.com always needs
   at least one verified owner; if deeahmed is removed before info@ is
   verified, nobody may be left who can manage it.
   - Settings, then Ownership verification: verify with its own DNS TXT
     record, added at the weshastones.com DNS host.
   - Settings, then Users and permissions: open ⋮ next to
     deeahmed@leadsupcallcenter.com, then Manage property owners, and
     **Unverify** it.
   - Delete deeahmed's old `google-site-verification` TXT record from DNS.
     Otherwise Google re-verifies it on its own.

   After this step, weshastones.com Search Console emails only reach
   info@weshastones.com. That inbox isn't connected to the session, so the
   session asks you about weshastones alerts instead of reading them.

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

### Phase 0: setup (one time, you)

Each step names the Chrome profile to do it in.

**In Search Console (about 20 minutes)**

1. **Take weshastones.com off the deeahmed account.** info@weshastones.com can
   already open it (done by 4 Oct). Removing deeahmed follows the order in
   "One Google account per site": verify info@ first, then unverify deeahmed,
   then delete deeahmed's TXT record.
2. **Point data.leadsupcallcenter.com at leadsupdata.com.** Do this in the
   deeahmed@leadsupcallcenter.com profile. Go to Search Console, then
   `https://data.leadsupcallcenter.com/`, then Settings, then **Change of
   address**. Pick `https://leadsupdata.com/`, then Validate and update. Every
   old URL already 301s to the same path on leadsupdata.com, so the move
   passes Google's checks. Google then moves the old site's ranking signals
   over and drops the old URLs on its own.
3. **Submit each sitemap.** Go to Search Console, then the site, then
   Sitemaps. Type `sitemap.xml` and press Submit. Do it from each site's own
   profile:
   - leadsupcallcenter.com and leadsupdata.com in the deeahmed profile.
   - weshastones.com: ✅ already done. Submitted 17 Sep, read 3 Oct, Success,
     1,030 pages.
   - weshamarble.com in the adnan@ profile. **Submit it again even if it's
     already listed.** URL Inspection shows "Sitemaps: Temporary processing
     error" for weshamarble pages, so Google failed to read it once.
4. **weshamarble.com: why pages aren't indexed.** URL Inspection on
   `/marble/asian-emperador/` (4 Oct) says **Crawled – currently not indexed**.
   The last crawl was 17 Sep, before the site's 22 Sep update. The page itself
   is fine now (200, self-canonical), and its old `/en/` twin 301s to it.
   Search URLs like `/showroom/?q=…` canonicalise to `/showroom/`, which is
   fine. The fix is fresh crawls, and the daily requests give it exactly
   that. If the 20 Sep alert in the adnan@ inbox names another reason, tell
   the session.
5. **Delete the old routine** in the Claude desktop app's scheduled tasks,
   if it's still there.

**For whoever edits the websites**

6. **IndexNow key files.** Upload one text file to each site root. The file
   name is `<key>.txt` and its only content is the key. The keys are meant to
   be public. Once the files are live, the Monday run sends every page to
   Bing, Yandex and the other IndexNow engines.

   | Site | File to upload at the site root |
   |---|---|
   | leadsupcallcenter.com | `11e8ac2284d19f26e34712f6578d2b8d.txt` |
   | leadsupdata.com | `3c94e44978e35515a4ffa8afa62bdb9e.txt` |
   | weshastones.com | `8e78ff8430fb758377b0f1471e8fe529.txt` |
   | weshamarble.com | `8a3e9c14127f496749a9fd285f33d9c1.txt` |

7. **leadsupdata.com: fix the Dataset structured data.** Add a `description`
   to each Dataset block. That one is critical. Also set `creator` to an
   Organization object and add a `license`.

**Optional: lets the session confirm "indexed" by itself**

8. In Google Cloud, create a service account and enable the **Google Search
   Console API**. Add the service account's email as a **Full** user on each
   property (Settings, then Users and permissions), from that site's own
   profile. Store the key JSON in this environment's settings as the
   variable `GSC_SERVICE_ACCOUNT_JSON`. Never paste it into chat.

Done 4 Oct: network access for the sites in the environment settings, and
the GitHub connection.

### Phase 1: daily batches (every day from Mon 5 Oct, 09:56 Cairo time)

All four sites start as soon as their URL lists are in. Until a site's list
is loaded (network access, or an `import`), the morning run for that site has
nothing to post and just names what's blocking it.

| When | Who | What |
|---|---|---|
| 09:56 | routine → session | Reads the page's ticks (`apply-ticks`), then `sync` → `check` → `page`, and republishes the timetable page. Up to **10 URLs per property** a day. Pages that broke since the last run are set aside as fix items. |
| any time that day | you | On the timetable page, open each group's links in that group's Chrome profile. Press **Request indexing** and tick the box, or press **On Google** if it's already indexed. That's up to 40 a day across the four sites. |
| next morning | routine → session | Files the ticks. Unticked pages slide to the next day. |

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

The plan is finished when every live sitemap URL on all four sites is
`indexed`, or deliberately `excluded` (thank-you pages, duplicates). The four
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
| `today.md` | Today's checklist (plain-text copy) |
| `timetable_template.html` / `timetable.html` | The timetable page: the template, and the built page that gets published |
