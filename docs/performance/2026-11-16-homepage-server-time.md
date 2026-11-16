# Where the homepage's server time goes (16 Nov 2026)

The owner found the site slow. Measured on production, morning of 16 Nov 2026,
from a browser in the Netherlands.

## What a visitor waits for

| | Warm | Cold |
| --- | --- | --- |
| First bytes of the page (the frame: header, styles, scripts) | 0.15 to 0.4 s | the same |
| The content of the homepage, hero included | 0.75 to 1.0 s | 1.9 to 3.9 s |
| Other pages (/hoe-het-werkt, /functies, /cases) | 0.6 to 0.7 s | not measured |

The page streams. The frame comes at once, the personalised content only when
the decision is made on the server. The hero image starts loading after that.
The images are not the problem: the largest is 260 KB and they load lazily.

## Where the wait comes from

One homepage request, read from the Supabase API log (07:07:44 UTC): about
twenty database requests in nine steps one after another, over 1.1 s.

1. `tenant_settings`
2. five at once: `tenant_pipeline_stages`, `platform_settings`,
   `subscriptions`, `personalization_sessions`, `session_credit_balances`
3. `visitor_profiles`
4. `interest_profiles`
5. `audience_segments`
6. `adaptive_blocks` (the whole list)
7. `visitor_journey_events`
8. `plan_experiments`
9. `adaptive_blocks` eight more times, one per variant key, in two batches

Each step costs the journey to the database and back, plus what Supabase needs
(30 to 260 ms per request in this trace, the slowest on the first requests).

## What changes here

The functions ran in Frankfurt (`fra1`). The database is in Ireland
(`eu-west-1`). Every one of those nine steps crossed that distance. This
change moves the functions to Dublin (`dub1`), next to the database.

Expected: some 20 to 30 ms less per step, so roughly a quarter of a second
less on every page that makes a decision. Measure again after the deploy with
the same request; the number above is an estimate, not a measurement.

## What is left, in order of expected gain

1. **Fewer steps.** Step 9 asks for eight blocks that step 6 already fetched.
   Steps 3, 4 and 5 do not depend on each other and can go at once. Steps 1
   and 2 and 8 read things that change a few times a day; a short memory in
   the function (30 to 60 seconds) would skip them on most requests.
2. **Cold starts.** After a quiet period the first visitor waits 2 to 4 s. On
   the Hobby plan a function sleeps and the cron may only run daily. Keeping
   it awake needs a pinger from outside or the Pro plan. That is the owner's
   choice.
3. **The slow first requests at Supabase** (150 to 260 ms for a simple read).
   Likely the size of the database instance. Also the owner's choice.
