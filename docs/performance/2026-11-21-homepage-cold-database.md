# The homepage on a quiet site: a cold database (21 Nov 2026)

The owner found the homepage slow again. The work of 16 and 19 Nov made a warm
request fast (0.3 to 0.5 s). This is about the request that is not warm, which
on a site with a visitor every few minutes is most of them.

## What a visitor waits for

Measured from the Netherlands in a headless Chromium, a fresh visitor each
time (curl is no use here: it gets the Vercel challenge page).

| Visits | First paint | The hero (largest paint) |
| --- | --- | --- |
| Right after each other | 0.3 to 0.6 s | 0.65 to 0.95 s |
| Thirty seconds apart, twelve in a row | 0.4 to 1.3 s | 0.8 to 6.1 s, median 2.7 s |

The frame (header, styles, scripts) always comes fast. The hero is in the part
of the page that waits for the personalisation decision, and that part took
0.5 to 5 s to arrive.

## Where the wait comes from

The Supabase API log, one request after 36 s of silence (17:43:34 UTC):

| Step | Reads | Time at Supabase |
| --- | --- | --- |
| 1 | `tenant_settings` | 605 ms |
| 2 | five at once: pipeline stages, platform settings, subscription, session count, credits | 686 to 1060 ms |
| 3 | `billing_plans` | 140 ms |
| 4 | `audience_segments`, `adaptive_blocks` | 129 and 196 ms |
| 5 | `plan_experiments`, four blocks by key | 64 to 129 ms |
| 6 | `design_effect_sets` | 52 ms |

2.5 s in all. The same six steps took 0.28 s fifteen seconds later.

The time is spent at Supabase itself: `x_envoy_upstream_service_time`, the
time PostgREST and Postgres take, is within tens of milliseconds of the total.
Over twelve hours of that day, by the silence before a request:

| Silence before the request | Median | 90th percentile |
| --- | --- | --- |
| under 1 s | 8 ms | 369 ms |
| 1 to 10 s | 28 ms | 312 ms |
| 30 s to 2 min | 421 ms | 949 ms |
| over 2 min | about 440 ms | about 1 s |

So after half a minute of silence the first reads are slow, and requests that
arrive together are each slow. That fits PostgREST closing its idle database
connections after thirty seconds and opening new ones on the next request;
the cause was not confirmed further, because the fix below does not depend
on it.

## What changes

Every read in the table is configuration: the same for every visitor, changed
a few times a day at most. They now go through `rememberedRead()`
(`lib/cache/remembered-read.ts`), which keeps the answer in the Next data
cache. That cache is shared by all instances and survives a cold start; the
tenant lookup and the rules already used it.

- An answer is fresh for a minute. After that the next request still gets it
  at once and the read runs again behind the response. A visitor does not wait
  for the database; the answer is at most one visit behind.
- A failed read is never kept. The stores answer a database error with an
  empty list or null. They now call `noteFailedRead()` where they do, and the
  answer of such a read goes to the caller but not into the cache. A stale
  answer that fails to refresh stays as it was.
- A save in the admin (tenant, block, effect set, segment, experiment,
  platform settings) drops the remembered answers, so the edit shows on the
  next visit.

What is remembered: the tenant settings (the existing two-minute cache, which
the pipeline did not use), the session cap verdict, the pipeline stages and
platform enricher settings, the active audience segments, the adaptive blocks
(the list and each block by key), the active experiments of a rule, and the
effect sets.

## What this costs

- An edit made straight in the database (not through the admin) shows after a
  minute at most, on the visit after that. Block text already had a five
  minute memory per instance.
- The session cap verdict is up to a minute and one visit old. The count
  itself stays exact (one row per session). Around the moment a tenant crosses
  the plan limit, a few sessions count under the plan instead of spending a
  purchased credit.
- The platform enricher settings, which hold API keys, are now kept in the
  Vercel data cache, as the tenant settings already were.

## Still open

- A visitor who gave consent has reads of their own (profile, history,
  behaviour state). Those still meet the cold database.
- The cold database itself: the size of the Supabase instance, or a setting
  that keeps the connections open. The owner's choice.
- The steps left open on 19 Nov (the second batch of block reads after the
  confidence gate, the decision log insert that fails for an anonymous id).
