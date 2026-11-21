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

## After the first deploy (21 Nov, 18:22 UTC)

The same twelve visits thirty seconds apart, starting half a minute after the
deploy. Time until the whole page, hero included, has arrived:

| | Fastest | Median | Slowest |
| --- | --- | --- | --- |
| Before | 0.5 s | 2.4 s | 5.0 s |
| After | 0.4 s | 0.9 s | 7.5 s |

Seven of twelve visits under a second, where it was three. But three visits
still took 2.4 to 7.5 s, and that had a cause of its own.

The Supabase log of one of them (18:24:10) shows ten reads in the same
instant: the refresh of every stale answer, behind the response as intended.
Among them one read that the page did wait for: `tenant_settings`. The root
layout, the site layout, the theme decision and the renderer read the tenant
with `getTenantById()`, straight from the database. That read used to take
0.6 s on a cold database. Now it stood in line with nine others that each
opened a connection, and took 2.2 s.

Two of the slow visits also had a slow first byte (3.4 and 5.4 s), both
within four minutes of the deploy. That fits a cold function instance right
after a deployment and was not seen later.

## Second round

- Everything that renders a public page reads the tenant with
  `getTenantForRender()`: the cross-instance tenant cache first, the database
  only when that has nothing. A test holds the list of files.
- The refresh opens at most three reads at a time. The rest follow as those
  finish and find the connections warm. A read that has waited two seconds
  for its turn goes anyway.

## After the second round (21 Nov, 18:50 UTC)

The same twelve visits thirty seconds apart, three minutes after the deploy.
Time until the whole page, hero included, has arrived:

| | Fastest | Median | Slowest |
| --- | --- | --- | --- |
| Before | 0.5 s | 2.4 s | 5.0 s |
| After the first round, twice | 0.3 to 0.4 s | 0.9 s | 4.0 to 7.5 s |
| After the second round | 0.24 s | 0.39 s | 3.9 s |

Eleven of twelve visits had the whole page within 0.85 s. A visit after two
and a half minutes of silence took 0.5 s.

The one slow visit (3.9 s) waited 3.6 s for its first byte. The Supabase log
shows no read in that time: the only reads of that request came after the
response, the refresh of five blocks, three at a time. So that wait was not
the database. It fits a function instance that had to start, which is the
cold start listed as open on 16 Nov (the Hobby plan lets a function sleep;
keeping it awake needs a pinger from outside or the Pro plan).

A note on reading these numbers: the largest contentful paint that Chrome
reports is not usable here. The hero fades in, and an element that is
invisible at its first paint is not counted, so the cookie banner is reported
as the largest paint in most runs. The moment the document has arrived is the
number to compare.

## A visitor who accepted cookies (21 Nov, 19:50 UTC)

The rounds above were measured with a fresh visitor, who has nothing stored.
A visitor who accepted cookies has, and the page reads it before it decides:
history, behaviour state and profile. One such visitor, nine and then six
visits thirty seconds apart; time until the hero is in the document:

| Fastest | Median | Slowest |
| --- | --- | --- |
| 0.4 s | 1.3 s | 7.1 s |

(An earlier version of this note said 1.5 s. The fifteen visits sorted give
1.3 s; six of them had the hero within a second.)

The Supabase log of the slowest visit: five reads at once (`events`,
`served_variants`, `visitor_behavior_state`, `visitor_profiles` twice) that
took 5.3 to 5.9 s each, then `interest_profiles` (0.6 s) and
`tenant_interest_profiles` (0.35 s) one after the other. Reads that arrive
together on a quiet database each open a connection, and the more of them,
the longer each takes: one read alone took about 0.4 s that day, five
together 0.7 to 5.9 s, ten together 1.7 to 2.7 s.

### What changes

- **One read for the visitor.** Migration 188 adds the function
  `visitor_stored_context(tenant, session)`, which returns the page views, the
  clicks, the last served variant, the behaviour state and the profile columns
  in one request. The page starts it once (`context/visitor-stored-context.ts`)
  and hands the promise to the three readers, which take their rows from it
  instead of reading themselves. On the other pages the returning-visitor
  signals were a read of their own after the history; they come from the same
  answer now.
- **Deployable before the migration.** While the function is not there, or
  when the read fails, the promise resolves to null and every reader does its
  own reads as before. A missing function is remembered for five minutes, so
  the page does not pay for a failed call on every request.
- **The interest profiles are configuration** and go through
  `rememberedRead()` like the rest: two steps less for every visitor with a
  keyword to score.
- **The visitor's read goes first.** The refresh of remembered configuration
  runs behind the response, but it started in the same instant as the
  visitor's read and competed for the cold database. A remembered read now
  waits until a read marked with `foregroundRead()` has answered, two seconds
  at most.

The migration is applied by hand. `npm run db:migrate` reaches the database
that `.env.local` points to, which on the owner's machine is the development
one; production got the same SQL through the SQL editor on 21 Nov, 20:50 UTC.

### After the migration (21 Nov, 20:53 UTC)

The same visitor, twelve visits thirty seconds apart:

| | Fastest | Median | Slowest | Within a second |
| --- | --- | --- | --- | --- |
| Before | 0.4 s | 1.3 s | 7.1 s | 6 of 15 |
| After | 0.3 s | 0.7 s | 3.3 s | 10 of 12 |

The Supabase log of a slow visit after the change (2.4 s) shows what is left:
the page made one request, `rpc/visitor_stored_context`, and the database
took 2.2 s to answer it. Two requests from the browser of the same visitor
(session and journey events) arrived in the same moment and took 1.4 and
1.6 s. So one read is what the page waits for now, and when the database is
cold that one read is still slow. Nothing more can be taken out on this side;
what remains is the cold database itself (the size of the Supabase instance,
or keeping its connections open), which is the owner's choice.

Between the deploy and the migration the page asked for a function that was
not there yet, once per five minutes per instance, and then fell back to the
six reads. The first visit in that window took 7.6 s. Apply a migration like
this one before the code that calls it, or right after.
