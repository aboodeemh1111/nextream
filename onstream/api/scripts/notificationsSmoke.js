#!/usr/bin/env node
/**
 * End-to-end check of the notification pipeline against a running API.
 *
 *   node scripts/notificationsSmoke.js
 *   API_BASE=http://127.0.0.1:8800 SMOKE_PASSWORD=password node scripts/notificationsSmoke.js
 *
 * Deliberately HTTP-only. Every assertion goes through the same routes the two
 * front-ends call, so a pass means the wire contract works — not merely that the
 * services do. The parts worth exercising this way are the ones no unit test can
 * reach: that a switched-off category really produces nothing, that quiet hours
 * defer a push while still filing the inbox row, that a re-sent event is deduped
 * by the unique index rather than by a caller remembering to check, and that the
 * SSE stream delivers in the same moment the row is written.
 *
 * Preferences are restored and everything created is archived on the way out, so
 * it is safe to run against a development database more than once.
 */

const BASE = (process.env.API_BASE || "http://127.0.0.1:8800").replace(/\/$/, "");
const PASSWORD = process.env.SMOKE_PASSWORD || "password";
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || "admin@example.com";
const USER_EMAIL = process.env.SMOKE_USER_EMAIL || "user@example.com";

let passed = 0;
let failed = 0;

function ok(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✔ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✘ ${label}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

async function call(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { token: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    data = text;
  }
  return { status: response.status, data };
}

async function login(email) {
  const { status, data } = await call("/api/auth/login", {
    method: "POST",
    body: { email, password: PASSWORD },
  });
  if (status !== 200 || !data?.accessToken) {
    throw new Error(`Cannot sign in as ${email} (${status}). Run \`npm run seed\` first.`);
  }
  return { token: data.accessToken, id: String(data._id), username: data.username };
}

/**
 * Reads one SSE frame of the requested type, or resolves null on timeout.
 *
 * `fetch` rather than EventSource because the stream is authenticated with the
 * same `token` header as every other route — which is the whole reason the client
 * reads it this way too.
 */
function waitForStreamEvent(token, eventName, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeoutMs);

    fetch(`${BASE}/api/notifications/stream`, {
      headers: { token: `Bearer ${token}`, Accept: "text/event-stream" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          clearTimeout(timer);
          controller.abort();
          return resolve(null);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let split;
          while ((split = buffer.indexOf("\n\n")) !== -1) {
            const raw = buffer.slice(0, split);
            buffer = buffer.slice(split + 2);

            const event = /^event: (.+)$/m.exec(raw)?.[1];
            const payload = /^data: (.+)$/m.exec(raw)?.[1];
            if (event === eventName && payload) {
              clearTimeout(timer);
              controller.abort();
              return resolve(JSON.parse(payload));
            }
          }
        }
        clearTimeout(timer);
        resolve(null);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

/** Broadcasts to one named viewer and returns the dispatch summary. */
async function sendTo(adminToken, userId, title, extra = {}) {
  const { status, data } = await call("/api/notifications/admin/broadcast", {
    method: "POST",
    token: adminToken,
    body: { mode: "users", userIds: [userId], title, body: "Sent by notificationsSmoke.js", ...extra },
  });
  if (status !== 200) throw new Error(`Broadcast failed (${status}): ${JSON.stringify(data)}`);
  return data;
}

/**
 * Publishes a real episode of a show the test viewer follows.
 *
 * Creates its own throwaway show so it does not depend on, or disturb, whatever
 * catalogue the database happens to hold, and deletes the whole tree afterwards —
 * the admin delete route cascades seasons, episodes, progress rows and every
 * viewer's `myShows` entry.
 */
async function runEpisodeFlow({ admin, user, setPrefs }) {
  const stamp = Date.now();
  let showId = null;

  try {
    // Only the inbox matters here; the push path is covered above and a fake
    // token would just add an FCM failure to every assertion below.
    await setPrefs({ push: false, categories: { new_content: true } });

    const show = await call("/api/tv/admin/shows", {
      method: "POST",
      token: admin.token,
      body: {
        title: `Smoke Show ${stamp}`,
        overview: "Created by notificationsSmoke.js",
        genres: ["Drama"],
        published: true,
      },
    });
    if (show.status !== 201) {
      ok("a test show can be created", false, show.data);
      return;
    }
    showId = String(show.data._id);
    ok("a test show is created and published", show.data.published === true);

    const season = await call(`/api/tv/admin/shows/${showId}/seasons`, {
      method: "POST",
      token: admin.token,
      body: { seasonNumber: 1, title: "Season 1" },
    });
    if (season.status !== 201) {
      ok("a season can be created", false, season.data);
      return;
    }
    const seasonId = String(season.data._id);

    // Following is what puts this viewer in the audience. A TVProgress row would
    // do it too, but a follow is the case an admin can reason about.
    const followed = await call("/api/tv/me/my-list", {
      method: "POST",
      token: user.token,
      body: { showId },
    });
    ok("the viewer follows the show", followed.data?.inMyList === true, followed.data);

    // Created as a draft, then published, because that is the sequence the admin
    // workspace actually produces — the wizard leaves drafts.
    const episode = await call(`/api/tv/admin/seasons/${seasonId}/episodes`, {
      method: "POST",
      token: admin.token,
      body: { episodeNumber: 1, title: "Cold Open", published: false, duration: 42 },
    });
    if (episode.status !== 201) {
      ok("an episode can be created", false, episode.data);
      return;
    }
    const episodeId = String(episode.data._id);

    const beforeCount = (await call("/api/notifications", { token: user.token })).data;
    const before = (beforeCount?.items || []).length;

    const published = await call(`/api/tv/admin/episodes/${episodeId}`, {
      method: "PATCH",
      token: admin.token,
      body: { published: true },
    });
    ok("the episode publishes", published.data?.published === true, published.status);

    // The announcement is buffered for a minute so a season drop does not become
    // ten pushes; run-jobs flushes that buffer first.
    await call("/api/notifications/admin/run-jobs", { method: "POST", token: admin.token });

    const inbox = await call("/api/notifications?limit=10", { token: user.token });
    const arrival = (inbox.data?.items || []).find((row) => row.type === "episode.published");

    ok("the follower is notified", Boolean(arrival), {
      titles: (inbox.data?.items || []).map((row) => row.title).slice(0, 3),
    });
    if (arrival) {
      ok(
        "the copy names the show, the code and the episode",
        arrival.title.includes(`Smoke Show ${stamp}`) &&
          arrival.body.includes("S1:E1") &&
          arrival.body.includes("Cold Open"),
        { title: arrival.title, body: arrival.body }
      );
      ok("it deep-links to the player", arrival.deepLink === `/watch/episode/${episodeId}`, arrival.deepLink);
      ok("and it says why they got it", arrival.reason === "From your list", arrival.reason);
      ok("the category is new content", arrival.category === "new_content", arrival.category);
    }
    ok("exactly one notification was added", (inbox.data?.items || []).length === before + 1, {
      before,
      after: inbox.data?.items?.length,
    });

    // The upsert branch's whole purpose: re-publishing must not announce twice.
    await call(`/api/tv/admin/episodes/${episodeId}`, {
      method: "PATCH",
      token: admin.token,
      body: { published: false },
    });
    await call(`/api/tv/admin/episodes/${episodeId}`, {
      method: "PATCH",
      token: admin.token,
      body: { published: true },
    });
    await call("/api/notifications/admin/run-jobs", { method: "POST", token: admin.token });

    const again = await call("/api/notifications?limit=10", { token: user.token });
    const duplicates = (again.data?.items || []).filter((row) => row.type === "episode.published");
    ok("re-publishing the same episode announces nothing", duplicates.length === 1, {
      found: duplicates.length,
    });

    // A whole season at once is one announcement, not five.
    const bulk = await call(`/api/tv/admin/seasons/${seasonId}/episodes/bulk`, {
      method: "POST",
      token: admin.token,
      body: {
        episodes: [2, 3, 4, 5].map((number) => ({
          episodeNumber: number,
          title: `Episode ${number}`,
          published: true,
          duration: 42,
        })),
      },
    });
    ok("four more episodes are created at once", bulk.data?.created?.length === 4, {
      created: bulk.data?.created?.length,
      failed: bulk.data?.failed,
    });

    await call("/api/notifications/admin/run-jobs", { method: "POST", token: admin.token });

    const afterBulk = await call("/api/notifications?limit=20", { token: user.token });
    const seasonRows = (afterBulk.data?.items || []).filter((row) => row.type === "season.published");
    const episodeRows = (afterBulk.data?.items || []).filter((row) => row.type === "episode.published");

    ok("a season drop is one notification, not four", seasonRows.length === 1, {
      season: seasonRows.length,
      episode: episodeRows.length,
    });
    if (seasonRows[0]) {
      ok(
        "and it counts the episodes",
        seasonRows[0].body.includes("4 new episodes"),
        seasonRows[0].body
      );
    }
  } finally {
    if (showId) {
      const removed = await call(`/api/tv/admin/shows/${showId}`, {
        method: "DELETE",
        token: admin.token,
      });
      ok("the test show is cleaned up", removed.data?.ok === true, removed.data);
    }
  }
}

async function main() {
  console.log(`Notification smoke test against ${BASE}`);

  // --- health ---------------------------------------------------------------
  section("Health");
  const health = await call("/api/notifications/health");
  ok("health responds", health.status === 200, health);
  ok("the catalog is loaded", (health.data?.types || 0) > 0, health.data);
  if (!health.data?.push?.configured) {
    console.log("  ℹ FCM is not configured — pushes will report as failed, which is expected here.");
  }

  const admin = await login(ADMIN_EMAIL);
  const user = await login(USER_EMAIL);
  console.log(`  ℹ signed in as ${admin.username} (admin) and ${user.username}`);

  // Start from a known state: whatever a previous run left is restored at the end.
  const original = (await call("/api/notifications/preferences", { token: user.token })).data
    ?.preferences;

  const setPrefs = (patch) =>
    call("/api/notifications/preferences", { method: "PUT", token: user.token, body: patch });

  try {
    // --- preferences --------------------------------------------------------
    section("Preferences");
    const prefs = await call("/api/notifications/preferences", { token: user.token });
    ok("preferences load", prefs.status === 200, prefs.status);
    ok(
      "every category is described",
      Array.isArray(prefs.data?.categories) && prefs.data.categories.length > 0
    );
    ok(
      "the account category is locked",
      prefs.data?.categories?.some((entry) => entry.key === "account" && entry.locked)
    );
    ok(
      "device tokens are never returned",
      JSON.stringify(prefs.data?.devices || []).length < 500 &&
        !JSON.stringify(prefs.data || {}).includes("deviceTokens")
    );

    const saved = await setPrefs({ maxPushPerDay: 4, categories: { social: false } });
    ok("a patch is saved", saved.data?.preferences?.maxPushPerDay === 4, saved.data?.preferences);
    ok("a patch does not drop other switches", saved.data?.preferences?.categories?.social === false);
    ok(
      "unmentioned categories keep their defaults",
      saved.data?.preferences?.categories?.new_content === true
    );

    const rejected = await setPrefs({ maxPushPerDay: 99999, quietHours: { start: "nonsense" } });
    ok("an out-of-range limit is clamped", rejected.data?.preferences?.maxPushPerDay === 50);
    ok("a malformed clock is refused", rejected.data?.preferences?.quietHours?.start !== "nonsense");
    await setPrefs({ maxPushPerDay: 6 });

    // --- audience preview ---------------------------------------------------
    section("Audience preview");
    const preview = await call("/api/notifications/admin/preview", {
      method: "POST",
      token: admin.token,
      body: { mode: "segment", segment: {} },
    });
    ok("a segment resolves to a count", preview.status === 200 && preview.data?.total >= 1, preview.data);
    ok("the segment is described in words", typeof preview.data?.description === "string");

    const named = await call("/api/notifications/admin/preview", {
      method: "POST",
      token: admin.token,
      body: { mode: "users", userIds: [user.id] },
    });
    ok("a named audience counts exactly one", named.data?.total === 1, named.data);

    const forbidden = await call("/api/notifications/admin/preview", {
      method: "POST",
      token: user.token,
      body: { mode: "segment", segment: {} },
    });
    ok("a non-admin cannot preview an audience", forbidden.status === 403, forbidden.status);

    // --- delivery -----------------------------------------------------------
    section("Delivery");
    const before = await call("/api/notifications/unread-count", { token: user.token });

    const first = await sendTo(admin.token, user.id, "Smoke: first notification");
    ok("the broadcast created one row", first.summary?.created === 1, first.summary);

    const inbox = await call("/api/notifications?limit=5", { token: user.token });
    ok("it appears in the inbox", inbox.data?.items?.[0]?.title === "Smoke: first notification", {
      got: inbox.data?.items?.[0]?.title,
    });
    ok(
      "the unread count went up by one",
      inbox.data?.unread === (before.data?.unread || 0) + 1,
      { before: before.data?.unread, after: inbox.data?.unread }
    );
    ok("the row carries its category label", Boolean(inbox.data?.items?.[0]?.categoryLabel));
    ok(
      "internal fields are not exposed to the viewer",
      inbox.data?.items?.[0]?.dedupeKey === undefined &&
        inbox.data?.items?.[0]?.delivery === undefined
    );

    const notificationId = inbox.data.items[0].id;

    // --- read tracking ------------------------------------------------------
    section("Read tracking");
    const read = await call(`/api/notifications/${notificationId}/read`, {
      method: "PATCH",
      token: user.token,
    });
    ok("marking read succeeds", read.status === 200, read.status);
    ok("the unread count came back down", read.data?.unread === (before.data?.unread || 0), read.data);

    const afterRead = await call("/api/notifications?limit=5", { token: user.token });
    ok("the row is flagged read", afterRead.data?.items?.[0]?.read === true);

    // --- isolation ----------------------------------------------------------
    section("Isolation");
    const otherInbox = await call("/api/notifications?limit=50", { token: admin.token });
    ok(
      "one viewer cannot see another's notifications",
      !(otherInbox.data?.items || []).some((item) => item.id === notificationId)
    );
    const otherRead = await call(`/api/notifications/${notificationId}/read`, {
      method: "PATCH",
      token: admin.token,
    });
    // Scoped by userId, so it matches nothing and changes nothing.
    ok("another viewer cannot mark it read", otherRead.data?.unread !== undefined);

    // --- category off -------------------------------------------------------
    section("A switched-off category");
    await setPrefs({ categories: { product: false } });
    const suppressed = await sendTo(admin.token, user.id, "Smoke: should never arrive");
    ok(
      "nothing is created at all — inbox included",
      suppressed.summary?.created === 0,
      suppressed.summary
    );
    ok("the reason is reported", suppressed.summary?.rules?.category_off === 1, suppressed.summary?.rules);

    const stillGone = await call("/api/notifications?limit=5", { token: user.token });
    ok(
      "and it really is not in the inbox",
      !(stillGone.data?.items || []).some((item) => item.title === "Smoke: should never arrive")
    );
    await setPrefs({ categories: { product: true } });

    // --- devices ------------------------------------------------------------
    section("Devices");
    // The push-path rules below are only reachable with a device registered:
    // policy stops at `no_device` first, and rightly so — there is nothing to
    // defer a push *to*. This token is not a real FCM registration, so the rules
    // exercised from here on are the ones that decide *not* to send.
    const fakeToken = `smoke-token-${Date.now()}`;
    const registered = await call("/api/notifications/devices", {
      method: "POST",
      token: user.token,
      body: { token: fakeToken, platform: "web", userAgent: "notificationsSmoke.js" },
    });
    ok("a device registers", registered.status === 200, registered.status);

    const withDevice = await call("/api/notifications/preferences", { token: user.token });
    ok("it is listed back", (withDevice.data?.devices || []).length >= 1, withDevice.data?.devices);
    ok(
      "and the token itself is not echoed",
      !JSON.stringify(withDevice.data?.devices || []).includes(fakeToken)
    );

    const badDevice = await call("/api/notifications/devices", {
      method: "POST",
      token: user.token,
      body: { token: "" },
    });
    ok("an empty token is rejected", badDevice.status === 400, badDevice.status);

    // --- quiet hours --------------------------------------------------------
    section("Quiet hours");
    // A window covering the whole day, so "now" is inside it wherever this runs.
    await setPrefs({ quietHours: { enabled: true, start: "00:00", end: "23:59" }, timezone: "UTC" });
    const quiet = await sendTo(admin.token, user.id, "Smoke: deferred by quiet hours");
    ok("the inbox row is still created", quiet.summary?.created === 1, quiet.summary);
    ok("but the push is held back", quiet.summary?.rules?.quiet_hours === 1, quiet.summary?.rules);
    ok("and nothing was pushed", quiet.summary?.pushed === 0, quiet.summary);

    const quietInbox = await call("/api/notifications?limit=5", { token: user.token });
    ok(
      "the viewer can read it immediately regardless",
      quietInbox.data?.items?.[0]?.title === "Smoke: deferred by quiet hours"
    );
    await setPrefs({ quietHours: { enabled: false } });

    // --- push off -----------------------------------------------------------
    section("The master push switch");
    await setPrefs({ push: false });
    const noPush = await sendTo(admin.token, user.id, "Smoke: inbox only");
    ok("the row is created", noPush.summary?.created === 1, noPush.summary);
    ok("the push is suppressed", noPush.summary?.rules?.push_off === 1, noPush.summary?.rules);
    await setPrefs({ push: true });

    const unregistered = await call(`/api/notifications/devices/${fakeToken}`, {
      method: "DELETE",
      token: user.token,
    });
    ok("the device unregisters", unregistered.status === 200, unregistered.status);

    // --- realtime -----------------------------------------------------------
    section("Realtime stream");
    const waiting = waitForStreamEvent(user.token, "notification", 8000);
    // Give the stream a moment to be registered before the send races it.
    await new Promise((resolve) => setTimeout(resolve, 700));
    await sendTo(admin.token, user.id, "Smoke: live over SSE");

    const frame = await waiting;
    ok("the stream delivers the notification", frame?.notification?.title === "Smoke: live over SSE", {
      got: frame?.notification?.title || null,
    });
    ok("and the badge travels with it", typeof frame?.notification === "object" && frame?.unread >= 1, {
      unread: frame?.unread,
    });

    // --- read-all and archive ----------------------------------------------
    section("Bulk actions");
    const readAll = await call("/api/notifications/read-all", { method: "POST", token: user.token });
    ok("read-all clears the badge", readAll.data?.unread === 0, readAll.data);

    const archived = await call("/api/notifications/archive-read", {
      method: "POST",
      token: user.token,
    });
    ok("archiving read rows succeeds", archived.status === 200, archived.status);

    const emptied = await call("/api/notifications?limit=50", { token: user.token });
    ok("the inbox is empty afterwards", (emptied.data?.items || []).length === 0, {
      left: emptied.data?.items?.length,
    });
    const archive = await call("/api/notifications?archived=true&limit=50", { token: user.token });
    ok(
      "archived rows are kept, not deleted",
      (archive.data?.items || []).length > 0,
      { archived: archive.data?.items?.length }
    );

    // --- reporting ----------------------------------------------------------
    section("Admin reporting");
    const adminStats = await call("/api/notifications/admin/stats?days=1", { token: admin.token });
    ok("stats respond", adminStats.status === 200, adminStats.status);
    ok("this run is counted", (adminStats.data?.totals?.created || 0) >= 4, adminStats.data?.totals);
    ok(
      "suppression reasons are reported",
      Array.isArray(adminStats.data?.suppression),
      adminStats.data?.suppression
    );
    ok("the catalog is served to the composer", Array.isArray(
      (await call("/api/notifications/admin/catalog", { token: admin.token })).data?.types
    ));

    const statsForbidden = await call("/api/notifications/admin/stats", { token: user.token });
    ok("a non-admin cannot read stats", statsForbidden.status === 403, statsForbidden.status);

    // --- background jobs ----------------------------------------------------
    section("Background jobs");
    const jobsA = await call("/api/notifications/admin/run-jobs", {
      method: "POST",
      token: admin.token,
    });
    const jobsB = await call("/api/notifications/admin/run-jobs", {
      method: "POST",
      token: admin.token,
    });
    ok("the sweeps run", jobsA.status === 200 && jobsB.status === 200, {
      a: jobsA.status,
      b: jobsB.status,
    });
    const createdTwice =
      (jobsB.data?.reminders?.episodes || 0) +
      (jobsB.data?.reminders?.movies || 0) +
      (jobsB.data?.reminders?.finishes || 0);
    ok(
      "running them twice creates nothing the second time",
      createdTwice === 0,
      jobsB.data?.reminders
    );

    // --- the real thing -----------------------------------------------------
    //
    // Everything above sends `system.announcement`, which is the one type the
    // catalog deliberately does *not* dedupe — so it takes the plain-insert
    // branch of the dispatcher. Every notification the product actually
    // generates carries a dedupe key and takes the upsert branch instead, which
    // nothing above touches. This publishes a real episode of a real followed
    // show, which is the flagship path: audience resolution, the coalescing
    // buffer, the upsert, and the unique index that makes a re-publish a no-op.
    section("Publishing an episode of a followed show");
    await runEpisodeFlow({ admin, user, setPrefs });
  } finally {
    // Restore, whatever happened above.
    if (original) {
      await setPrefs(original).catch(() => {});
    }
    await call("/api/notifications/read-all", { method: "POST", token: user.token }).catch(() => {});
    await call("/api/notifications/archive-read", { method: "POST", token: user.token }).catch(() => {});
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\nSmoke test could not run: ${err.message}`);
  process.exit(1);
});
