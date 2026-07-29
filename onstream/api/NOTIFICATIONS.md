# Notifications

Everything the product says to a viewer, and everything it decides not to say.

The short version: an event happens, an audience is resolved, a message is
rendered from a catalog, a policy engine decides per person whether and how it
may arrive, and the result is recorded so the next decision is better informed.
The inbox always gets the notification; the push often should not.

```
event (episode published, comment posted, sweep finds an idle title)
  │
  ▼
audience.js      who cares, and how much (declared interest, or taste)
  │
  ▼
catalog.js       what it says, how long it lives, the key that stops a repeat
  │
  ▼
policy.js        may this interrupt this person, right now?          ← pure
  │
  ▼
dispatch.js      one bulk upsert, then SSE + FCM
  │
  ▼
stats.js         counters the next decision reads
```

---

## Why it is shaped like this

**One catalog, not templates at call sites.** The interesting questions about a
notification system are comparative: *can this wake someone at 2am, which of
these can a viewer switch off, is a new-episode alert louder than a review like?*
Those are unanswerable when every route invents its own payload and obvious when
they sit in one table. `services/notifications/catalog.js` is that table.

**The policy engine is pure.** No database, no `Date.now()` — `now` is always a
parameter. Quiet hours across a wrap-around midnight in a viewer's own timezone,
a daily counter that must be ignored when it belongs to yesterday, an engagement
throttle: these are the rules most likely to be subtly wrong, and they are the
ones a test can pin only if they touch nothing. See `policy.test.js`.

**Dedupe is a database constraint, not a convention.** `dedupeKey` is uniquely
indexed, so "tell this viewer about this episode" is idempotent whether the hook
fires twice, the request is retried, or two instances race. Callers cannot forget.

**Nothing can break its caller.** Publishing an episode must not 500 because
Mongo timed out inside a fan-out. `events.js` is the only entry point routes use,
and every function on it is detached and swallows its own errors.

---

## The types

Declared in `catalog.js`. Priority governs how far a type may push past a
viewer's limits: `transactional` skips every rule, `high` skips the daily cap
only, `normal` respects everything, `low` is inbox-only unless it opts in.

| Type | Category | Priority | Trigger |
|---|---|---|---|
| `episode.published` | new_content | high | An episode of a show you follow or are watching |
| `season.published` | new_content | high | 3+ episodes of one season land together |
| `show.published` | recommendations | normal | New series matching your taste (score ≥ 0.45) |
| `movie.published` | recommendations | normal | New film matching your taste (score ≥ 0.45) |
| `list.available` | new_content | high | Something you saved became watchable |
| `next_episode.ready` | continue_watching | low | You finished an episode; inbox only |
| `continue.reminder` | continue_watching | normal | Idle 3–21 days at 5–90% through |
| `finish.nudge` | continue_watching | normal | ≤2 episodes left in the season you are on |
| `comment.reply` | social | high | Someone commented on a title you commented on |
| `review.liked` | social | low | Someone liked your review; inbox only |
| `digest.weekly` | digest | low | Monday morning, in the viewer's timezone |
| `system.announcement` | product | normal | An admin broadcast |
| `account.security` | account | transactional | Sign-in from a device this account has not used |

Categories are the switches a viewer sees. There are seven rather than thirteen
because "new episodes of shows I watch" and "a series I might like" are different
promises, but thirteen switches is a form nobody finishes. `account` is locked —
a viewer who opted out of a sign-in alert has opted out of finding out their
account was taken.

### Adding a type

1. Add an entry to `TYPES` in `catalog.js`: category, priority, channels,
   `ttlDays`, a `render(ctx)` that returns `null` when the context is unusable,
   and a `dedupeKey(ctx)`.
2. Add a function to `events.js` that resolves the audience and calls `dispatch`.
3. Call it from the route where the event happens.

Nothing else changes. The settings page, the admin console and the policy engine
all read the catalog.

---

## The rules, in order

Applied per recipient in `policy.decide()`. Each exists because leaving it out
produces a specific failure.

1. **Category off** → nothing is created at all, inbox included. A switch that
   silences the push but keeps filling the bell is not an off switch.
2. **Digest mode** → `normal` and `low` pushes are absorbed into the weekly
   summary. Otherwise "one message a week" is a second inbox, not a replacement.
3. **Engagement** → after 4 consecutive unopened pushes in a category (8 for
   `high`), that category stops pushing and keeps filing. This is the only rule
   that learns, and it is what stops a recommendation stream from training people
   to dismiss the app. Disclosed on the settings page rather than hidden.
4. **Daily cap** → account-wide, default 6. `high` is exempt: letting unsolicited
   sends consume the budget that hides a followed show's new episode is the wrong
   trade.
5. **Quiet hours** → the push is *deferred*, not dropped. The inbox row is already
   there; only the interruption waits. Re-judged when it comes due, so a queue of
   deferrals does not become the 8am burst quiet hours existed to prevent.
6. **Minimum gap** → default 20 minutes, also a deferral. Timing, not volume.

A viewer with no registered device is recorded as `no_device` rather than
silently skipped, because "the campaign reached 40 of 200" is otherwise
indistinguishable from a broken transport.

---

## Delivery

**In-app** is the durable record: a `Notification` document, delivered live over
SSE to every tab the viewer has open.

**Push** is FCM web push, and two things about it are the opposite of the
Firebase quickstart:

- **Data-only messages.** A payload with a top-level `notification` key is
  rendered by the browser *and* delivered to `onBackgroundMessage`, so the
  obvious implementation shows everything twice. The service worker is the single
  renderer, which is also the only way to get `tag`-based collapsing (five new
  episodes of one show become one card), action buttons, and a click handler that
  reports the click before opening the deep link.
- **Tokens are pruned on the send that discovered them.** FCM reports
  unregistered tokens per recipient, and that is the only moment the system
  learns a device is gone.

### Realtime

`GET /api/notifications/stream` is server-sent events, authenticated with the
same `token` header as everything else — so the client reads it with `fetch`
rather than `EventSource`, which cannot set headers. The alternative was a bearer
token in a query string, logged by every proxy in the path.

Two things a naive SSE hub gets wrong, both handled in `stream.js`:
`Cache-Control: no-transform` stops the global `compression()` middleware
buffering the stream into uselessness, and both per-viewer and process-wide
connection counts are capped so a reconnect loop cannot exhaust file descriptors.

The client falls back to polling `/unread-count` whenever the stream is not
connected, and refetches on tab focus for the laptop-woken-from-sleep case.

### Click attribution

A service worker cannot read the bearer token from `localStorage`, so it cannot
report a click itself. It writes the notification id to IndexedDB
(`nextream-notifications` / `pendingClicks`) and the page drains it on load — see
`public/firebase-messaging-sw.js` and `src/lib/pendingClicks.ts`. Keep the
database name, version and store name in step between those two files.

---

## Background jobs

`scheduler.js`, started from `index.js` once Mongo connects. An interval in the
API process rather than a queue: this deployment is a single Node process, and
adding Redis and a worker to send a few thousand notifications a week would be
infrastructure with no corresponding problem. The cost is stated plainly — with
two API instances both would sweep, so every job is idempotent through the same
dedupe keys that protect the request path, and `NOTIFY_SCHEDULER=false` turns it
off on instances that should not run it.

| Job | Default interval | What it does |
|---|---|---|
| `drainDeferred` | 2 min | Sends held-back pushes, re-judging each as it comes due |
| `sendReminders` | 60 min | Continue-watching nudges and finish-the-season nudges |
| `sendDigests` | 60 min | Weekly roundup, to whoever's local Monday morning it is |

Run them all now: `POST /api/notifications/admin/run-jobs` (admin only). The
reminder and digest sweeps are otherwise only observable by waiting an hour,
which makes them the two parts of this system that would never get tested.

---

## Environment

| Variable | Required for | Notes |
|---|---|---|
| `FIREBASE_PROJECT_ID` | push | Service account, API side |
| `FIREBASE_CLIENT_EMAIL` | push | |
| `FIREBASE_PRIVATE_KEY` | push | `\n` escapes are unescaped on load |
| `NEXT_PUBLIC_VAPID_KEY` | push | **Client side.** Without it the browser cannot mint a token, and the settings page says push is unconfigured — even when the API is fully set up. Firebase console → Project settings → Cloud Messaging → Web Push certificates |
| `NEXT_PUBLIC_FIREBASE_*` | push | Public web config; defaults are baked in for this project |
| `NOTIFICATIONS_DISABLED` | — | `true` disables the whole feature, hooks included |
| `NOTIFY_SCHEDULER` | — | `false` stops this instance running the sweeps |
| `NOTIFY_COALESCE_MS` | — | Episode-publish buffer, default 60000 |
| `NOTIFY_DEFERRED_INTERVAL_MS` | — | Default 120000 |
| `NOTIFY_SWEEP_INTERVAL_MS` | — | Default 3600000 |

Push degrades rather than failing: with no service account the inbox works, the
stream works, and pushes are recorded as `failed` with `FCM_NOT_CONFIGURED`.
`GET /api/notifications/health` reports which of the three server variables is
missing.

---

## Endpoints

### Viewer

| Method | Path | |
|---|---|---|
| `GET` | `/api/notifications` | Inbox. `?cursor= &limit= &category= &unread=true &archived=true` |
| `GET` | `/api/notifications/unread-count` | Just the badge |
| `GET` | `/api/notifications/stream` | SSE: `hello`, `notification`, `read`, `archived` |
| `PATCH` | `/api/notifications/:id/read` | |
| `POST` | `/api/notifications/:id/click` | Clears the engagement throttle |
| `POST` | `/api/notifications/read-all` | |
| `DELETE` | `/api/notifications/:id` | Archives — never deletes, the stats depend on it |
| `POST` | `/api/notifications/archive-read` | |
| `GET`/`PUT` | `/api/notifications/preferences` | Validated and clamped on the way in |
| `POST` | `/api/notifications/devices` | Register a push token |
| `DELETE` | `/api/notifications/devices/:token` | |

Paging is a cursor over `(createdAt, _id)`. `createdAt` alone is not a cursor: a
fan-out writes every row in one bulk operation with an identical timestamp, so
paging on it drops or repeats the whole batch at the page boundary.

### Admin

| Method | Path | |
|---|---|---|
| `GET` | `/api/notifications/admin/stats?days=30` | Rates by type, category and day, plus suppression reasons |
| `GET` | `/api/notifications/admin/recent` | Newest rows across all viewers, with delivery state |
| `GET` | `/api/notifications/admin/catalog` | Feeds the composer's dropdowns |
| `POST` | `/api/notifications/admin/preview` | Recipient count *before* sending |
| `POST` | `/api/notifications/admin/broadcast` | Returns a per-rule breakdown, not a checkmark |
| `POST` | `/api/notifications/admin/test` | To the admin's own account |
| `POST` | `/api/notifications/admin/run-jobs` | Runs the sweeps now |

Every rate in the console is over notifications **created**, never over pushes
attempted. A type whose pushes are mostly suppressed is usually the system
working — quiet hours, a cap, an opt-out — and a delivery rate computed over
sends would report all of that as failure. That is why the suppression panel sits
next to the numbers.

---

## Verifying

```bash
npm test                    # 242 unit tests; catalog + policy are 54 of them
npm run notify:smoke        # 66 assertions against a running API, HTTP only
npm run notify:sync-indexes # reconcile indexes after a schema change
```

`notify:smoke` covers what unit tests cannot. It publishes a real episode of a
real followed show and checks that the follower is notified with the right copy
and deep link; that re-publishing announces nothing; that four episodes at once
collapse into one season notification; that a switched-off category produces
nothing at all; that quiet hours defer a push while still filing the inbox row;
that one viewer cannot read or mark another's notifications; and that the SSE
stream delivers in the same moment the row is written. It creates a throwaway show,
deletes it afterwards, restores the test viewer's preferences and archives what it
created, so it is safe to re-run.

`notify:sync-indexes` exists because MongoDB will not redefine an index whose
*options* changed — it rejects the create with `IndexOptionsConflict`, and
Mongoose's `autoIndex` swallows that, so the collection quietly keeps the old
definition while the code assumes the new one. Run it after changing an index.

### Two bugs the smoke test found, and no unit test could

Both were silent: notifications simply did not exist, with nothing in the log.

**`unique + sparse` on `dedupeKey`.** Sparse skips documents where the field is
*absent*, but Mongoose applies the schema's `null` default — so every repeatable
notification carried an explicit `null` and was indexed under it. The first admin
broadcast claimed the null slot and every broadcast after it failed as a duplicate
key, which the dispatcher correctly treats as "already sent". It is now a partial
index over string values only.

**`updatedAt` in `$setOnInsert`.** The schema has `timestamps: true`, so Mongoose
adds `$set: { updatedAt }` to every `bulkWrite` operation. A field present in both
`$set` and `$setOnInsert` makes MongoDB reject the operation outright (code 40,
"would create a conflict"). Every catalog notification takes the upsert branch, so
every one of them failed — while announcements, which have no dedupe key and take
the `insertOne` branch, worked perfectly. That asymmetry is what made it invisible:
the only type anyone had tested by hand was the only type that worked.

The second bug is also why `persist()` now inspects each write error instead of
treating the presence of `writeErrors` as benign. Judging a whole batch by "did it
contain errors" made a genuine schema conflict indistinguishable from the dedupe
index doing its job.
