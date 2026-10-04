# HANDOFF FOR Wesha Stones (as of 2026-10-04 ~12:40 UTC)

Topic chat: Wesha Stones (`session_01JoGi5xGQoHreNvuJsgz453`). This folder
starts with an underscore, so GitHub Pages never publishes it.

## What this is
- Export business: Egyptian marble, granite, quartz and semi-precious stone,
  sold by the 20 ft container. weshastones.com. Separate brand from Wesha
  Marble (the showroom).
- This chat's memory only covers work up to ~15 Sep 2026. Later work happened
  in chats on Dee's Mac (e.g. "Chinese investors for marble/stones business
  Egypt", which uploaded to weshastones.com on 15 Sep). Those chats should send
  "HANDOFF FOR Wesha Stones" messages to the topic chat. They take priority
  over this one.

## Today's work
1. **Daily indexing routine** "Wesha Stones indexing (daily)", 09:40 Cairo,
   runs in the Wesha Stones chat.
   - Repo `deeahmed-pixel/deeahmed-pixel.github.io` is attached with push
     access in that chat.
   - Branch `claude/index-three-domains-4pdebg`, at `e51e65d` when this was
     written.
   - Test push (nothing sent): "Everything up-to-date". The routine can push.
   - Plan and tracker: `_indexing/` (README.md, config.json, indexing.py,
     state/<site>.json, today.md).
   - Optional timetable page: https://claude.ai/artifact/RYo5J2S8my4gHALMqzU1re
   - The tool itself is changed only in the chat "Page indexing for three
     domains" (`session_012Lx3hN3n8BmE1sQ2CPc9ic`), which is being archived.
   - Mismatch: in `_indexing/today.md`, the weshastones.com links still say to
     use the deeahmed@leadsupcallcenter.com Chrome profile. They should now
     use the info@weshastones.com profile. Check that the next run fixes this.
2. **Google indexing status**
   - 1,029 pages in the sitemap across 9 languages. All checked on 4 Oct: no
     errors, no redirects, no noindex.
   - About 10 manual "Request indexing" clicks per day, so the last batch is
     Thu 14 Jan 2027.
   - Search Console property: `sc-domain:weshastones.com`, now used from the
     info@weshastones.com Chrome profile.
   - Verified owners: info@ and jack@leadsupcallcenter.com. Dee removed the
     property from deeahmed's Search Console list.
   - Open Search Console alerts: pages not found (404), pages marked noindex,
     alternate page with proper canonical, and "crawled – currently not
     indexed" (a validation partly failed on 16 Sep).
   - Search Console alerts now go to info@, which Claude can't read. Ask Dee
     about them.

## Live vs not live
- **Live:** the fix for the /contact/ error that stopped GA4
  `generate_lead` from firing (commit `aaee7f3f`, only `assets/js/app.js`
  uploaded).
- **Not live:**
  - Contact page HTML sync (on the next deploy).
  - IndexNow key file `8e78ff8430fb758377b0f1471e8fe529.txt` at the site root
    (its content is the name without .txt).
  - Prices (not approved).
- Site source is on Dee's Mac: `~/Desktop/wesha-stones-site` (branch `main`).
- Deploy: `npm run package`, upload in hPanel File Manager (10 MB cap), then
  `npm run indexnow`.
- SEO audit: `~/Desktop/wesha-stones-site/audit-2026-09-08/` (commit
  `dd858b10`). Report:
  https://claude.ai/code/artifact/d76bf53d-a415-4958-b66a-91cc32ef801a

## Waiting on Dee
- **Faster indexing option, yes or no:** add each language folder as its own
  Search Console property. About 15 days instead of 103, but about 80 clicks a
  day.
- **Optional cleanup:**
  - In Search Console, unverify deeahmed as an owner.
  - Delete only deeahmed's `google-site-verification` TXT record from the DNS.
  - Remove jack@ too, if no LeadsUp accounts should be on the site.
- **Upload** the IndexNow key file.
- **Audit decisions:**
  - Marmomac: Sep has passed, so a banner is no longer relevant.
  - Google Business Profile.
  - DMARC and DKIM.
  - Wording: "own quarries" vs buying blocks at the face, and floor area
    10,000 vs 2,000 m².
- **Granite load plan inputs:**
  - Crate weights.
  - New Halayeb density.
  - Whether the 26 t limit includes the container's tare (~2.2 t).
  - Destination road-weight limits.
- **Housekeeping:** delete the untracked `WESHA-SITE-08Sep-2019.zip` on the Mac.

## Next step
- Tomorrow 09:40 Cairo: the routine runs in the Wesha Stones chat. It pulls
  the branch, files yesterday's ticks, builds the next 10 links, pushes, and
  reports.
- Then do the top lead fixes from the audit: WhatsApp first with text for each
  stone, a two-step form, the /thank-you/ page, and email that reports when
  sending fails. These need the site repo on GitHub, or the Mac chat.

No passwords or keys are stored here. Hostinger and Google logins live in
Dee's Chrome profiles.
