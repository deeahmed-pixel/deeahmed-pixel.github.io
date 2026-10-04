# Indexing plan: leadsupcallcenter.com · leadsupdata.com · weshastones.com · weshamarble.com

This folder runs the indexing work for the four sites, **with nothing for you
to press**. Each website has a fixed daily routine in its own Claude chat. The
routine pulls this branch, does the day's work for its site, pushes, and
reports in that chat:

| Routine | Chat (session) | Sites | Time (Cairo) | Google account |
|---|---|---|---|---|
| **LeadsUp indexing** | LeadsUpCallCenter.com (`session_01PY6abgPAHkZ9DBVKpY2c8r`) | leadsupcallcenter.com, leadsupdata.com | 09:24 daily | deeahmed@leadsupcallcenter.com |
| **Wesha Stones indexing** | Wesha Stones (`session_01JoGi5xGQoHreNvuJsgz453`) | weshastones.com | 09:40 daily | info@weshastones.com |
| **Wesha Marble indexing** | Wesha Marble (`session_01J4rNyEGw29QXNng9nwsWD6`) | weshamarble.com | 09:56 daily | adnan@weshamarble.com |

**Update routing.** Each routine reports in its own chat. The LeadsUp routine
also sends the leadsupdata.com and data.leadsupcallcenter.com part to the
**LeadsUp Data** chat (`session_016Snr4x31EXWQoMbUHdyqyQ`) with
`send_message`, marked "no reply needed". The update covers the daily run, new
Search Console issues, account or ownership changes, and milestones.

The chat "Page indexing for three domains" (`session_012Lx3hN3n8BmE1sQ2CPc9ic`)
built this tool and is where changes to it are made.

The **timetable page** (https://claude.ai/artifact/RYo5J2S8my4gHALMqzU1re) is
now optional. It shows progress for every site, plus each day's links for
anyone who wants to press Request indexing by hand, which still speeds
things up. Ticks there are filed by the next run.

The folder name starts with an underscore, so GitHub Pages (Jekyll) never
publishes it with this site. Each site's progress lives in
`state/<site>.json`, so the three routines never edit the same file.

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
2. **Take deeahmed out** (asked for on 4 Oct). As of 4 Oct, Users and
   permissions on weshastones.com lists three **verified owners**:
   deeahmed@leadsupcallcenter.com, info@weshastones.com and
   jack@leadsupcallcenter.com. info@ is already verified, so removing deeahmed
   leaves the property safely owned.
   - **Find deeahmed's DNS token.** In the deeahmed window, go to Settings, then
     Ownership verification. Note the `google-site-verification=…` TXT value
     shown there.
   - **Unverify deeahmed.** In the info@weshastones.com window, go to Settings,
     then Users and permissions. Open ⋮ next to Dee Ahmed, then Manage property
     owners, and press **Unverify** on deeahmed@leadsupcallcenter.com.
   - **Delete only that TXT record** at the weshastones.com DNS host. Keep
     info@'s and jack's records, or they lose verification too. If deeahmed's
     record stays, Google re-verifies it on its own.
   - **jack@leadsupcallcenter.com is also a verified owner.** For weshastones.com
     to have no LeadsUp accounts at all, remove jack the same way.

   After this step, weshastones.com Search Console emails reach
   info@weshastones.com, and jack@ while jack is still an owner. Neither inbox
   is connected to the session, so the session asks you about weshastones
   alerts instead of reading them.

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

**Needed for the automatic Google status checks**

8. **Service account (needed for the no-press mode, about 10 minutes).**
   - In any Google account (deeahmed is fine), open
     https://console.cloud.google.com and create a project, for example
     `site-indexing`.
   - **APIs & Services → Library**: enable **Google Search Console API**.
   - **IAM & Admin → Service accounts → Create service account**: name it
     `indexing-bot` and finish (no roles needed).
   - Open it, then **Keys → Add key → Create new key → JSON**. A `.json` file
     downloads.
   - Copy the service account's email (`indexing-bot@…iam.gserviceaccount.com`).
     Add it as a user with **Full** permission on every property, from that
     site's own profile: Search Console → site → Settings → Users and
     permissions → Add user.
     - deeahmed window: leadsupcallcenter.com and leadsupdata.com.
     - info@ window: weshastones.com.
     - adnan@ window: weshamarble.com.
   - In this cloud environment's settings (environment name in the title bar
     → Edit → Environment variables), add `GSC_SERVICE_ACCOUNT_JSON` with
     the whole contents of the `.json` file on one line. Never paste it into
     chat. New runs pick it up.

Done 4 Oct: network access for the sites in the environment settings, and
the GitHub connection.

### Phase 1: the daily run (automatic, every routine)

Google's **Request indexing** button has no API, so no routine can press it.
On 4 Oct you chose to automate everything else:

| Step | What the routine does | Needs |
|---|---|---|
| 1 | `git pull`, then file any ticks from the timetable page (`apply-ticks`) | — |
| 2 | `sync` picks up new or removed sitemap pages | network access (done) |
| 3 | `check` fetches the pages it still tracks and sets aside errors, redirects, `noindex` pages and foreign canonicals as fix items | network access (done) |
| 4 | `inspect` asks Google for each page's real status. Indexed pages close out. A page Google keeps out for 28+ days becomes a fix item, with Google's reason ("Crawled – currently not indexed" and so on) | **service account** (setup step 8) |
| 5 | Mondays: `submit-sitemaps` resubmits each sitemap, and `indexnow` pings Bing, Yandex and the others with every page not sent yet | service account; IndexNow key files (step 6) |
| 6 | `page` rebuilds the timetable page and republishes it | — |
| 7 | Reports in its chat: new indexed pages, new fix items, the `status` table. Commits its site's state file and pushes | — |

Without the service account, steps 4 and 5 can't run. The routines then
track and check pages but can't see what Google has indexed, and they remind
you about the service account once a week.

Pressing Request indexing by hand stays optional. The timetable page still
lists 10 links per site per day (home first, then language by language,
most-linked pages first, legal pages last). Ticks there are filed by the next
run.

### Finish line

A site is finished when `done` reports it: every sitemap page is confirmed
indexed, or is on the fix list with a reason (Google kept it out for 28+
days, or the page is broken). The routine then posts the fix list and
deletes itself. Fix items need changes to the site, not more requests.

## Commands

```bash
python3 _indexing/indexing.py sync                  # read sitemaps (robots.txt Sitemap: lines too), re-plan
python3 _indexing/indexing.py import weshastones.com export.csv   # add URLs from a GSC export / .txt / sitemap file
python3 _indexing/indexing.py check [--all]         # fetch pages: errors, redirects, noindex, foreign canonicals; count internal links
python3 _indexing/indexing.py plan [--start 2026-10-06]
python3 _indexing/indexing.py today                 # writes today.md
python3 _indexing/indexing.py mark requested        # today's batch; or --date D, or list URLs
python3 _indexing/indexing.py mark excluded URL...  # deliberately not indexed
python3 _indexing/indexing.py inspect [--limit N]   # Google status per page; 28+ days unindexed → fix list (needs GSC credentials)
python3 _indexing/indexing.py done                  # is each site finished?
python3 _indexing/indexing.py apply-ticks F.json    # file ticks read from the timetable page
python3 _indexing/indexing.py page                  # rebuild timetable.html
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
| `state/<site>.json` | One file per site. Every URL with its status (`scheduled` → `requested` → `indexed`; also `fix`, `excluded` and `dropped`), its problem if any, Google's coverage state, its internal link count, and its request history |
| `schedule.md` / `schedule.csv` | The full day-by-day timetable (generated locally, not committed) |
| `today.md` | Today's checklist (generated locally, not committed) |
| `timetable_template.html` / `timetable.html` | The timetable page: the template (committed), and the built page that gets published (not committed) |
