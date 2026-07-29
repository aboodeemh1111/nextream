/**
 * The notification type registry.
 *
 * Every notification the product can send is declared here, once, as data: its
 * preference category, how loudly it is allowed to arrive, how long it stays
 * worth reading, what it says, and the key that makes sending it twice
 * impossible. Nothing else in the system decides those things.
 *
 * The reason it is one file rather than a template scattered across the routes
 * that emit them: the interesting questions about a notification system are all
 * comparative. "Can this interrupt someone at 2am?" "Which of these can a
 * viewer switch off?" "Is a new-episode alert louder than a review like?" Those
 * are unanswerable when each call site invents its own payload, and obvious
 * when they sit in one table.
 *
 * Everything in this module is pure — no database, no clock beyond the `now`
 * the caller passes in — so catalog.test.js can pin the copy and the dedupe
 * behaviour without a Mongo connection.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// --- categories --------------------------------------------------------------

/**
 * The preference buckets. These are what a viewer actually sees on the settings
 * page, so there are seven of them rather than one per type: "new episodes of
 * shows I watch" and "a series I might like" are different promises, but
 * thirteen individual switches is a form nobody finishes.
 *
 * `locked` categories cannot be switched off. Only account and security
 * notifications qualify — a viewer who has opted out of a sign-in alert has
 * opted out of finding out their account was taken, which is not a preference
 * any product should honour.
 */
const CATEGORIES = {
  new_content: {
    key: "new_content",
    label: "New episodes & releases",
    description: "New episodes and seasons of shows you watch or follow.",
    default: true,
  },
  continue_watching: {
    key: "continue_watching",
    label: "Continue watching",
    description: "Reminders about titles you started but haven't finished.",
    default: true,
  },
  recommendations: {
    key: "recommendations",
    label: "Picked for you",
    description: "New titles that match what you watch.",
    default: true,
  },
  social: {
    key: "social",
    label: "Replies & likes",
    description: "Activity on your comments and reviews.",
    default: true,
  },
  digest: {
    key: "digest",
    label: "Weekly roundup",
    description: "One summary a week instead of alerts as things happen.",
    default: false,
  },
  product: {
    key: "product",
    label: "Product news",
    description: "Announcements and offers from Nextream.",
    default: true,
  },
  account: {
    key: "account",
    label: "Account & security",
    description: "Sign-ins and changes to your account. Always on.",
    default: true,
    locked: true,
  },
};

/**
 * How loudly a type may arrive.
 *
 *   transactional — bypasses quiet hours, caps and engagement suppression.
 *                   Security only. Nothing about the catalogue is transactional.
 *   high          — bypasses the daily cap, still respects quiet hours. For
 *                   things the viewer asked for by name: an episode of a show
 *                   they follow, a reply to their own comment.
 *   normal        — respects everything.
 *   low           — in-app only unless the type opts into push explicitly;
 *                   these are the ones a digest exists to absorb.
 */
const PRIORITIES = ["transactional", "high", "normal", "low"];

// --- copy helpers ------------------------------------------------------------

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** Titles arrive from admin forms and TMDB imports; neither guarantees length. */
function truncate(value, max) {
  const clean = text(value).replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  // Cut on a word boundary when one is close enough that the ellipsis does not
  // land mid-word, which reads as a rendering bug rather than as elision.
  const slice = clean.slice(0, max - 1);
  const space = slice.lastIndexOf(" ");
  return `${(space > max * 0.6 ? slice.slice(0, space) : slice).trimEnd()}…`;
}

function plural(count, singular, pluralForm) {
  return Number(count) === 1 ? singular : pluralForm || `${singular}s`;
}

/** "S2:E7" — the same code the search results and Continue Watching rows use. */
function episodeCode(episode) {
  const season = Number(episode?.seasonNumber);
  const number = Number(episode?.episodeNumber);
  if (!Number.isFinite(season) || !Number.isFinite(number)) return "";
  return `S${season}:E${number}`;
}

/**
 * ISO-8601 week key, e.g. "2026-W31".
 *
 * Used by the types that are allowed to repeat but only once per week. A
 * calendar-month or day-of-year key would let a Sunday-and-Monday pair through
 * as two different periods; ISO weeks are what "once a week" means to a person.
 */
function weekKey(date) {
  const at = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(at.getTime())) return "0000-W00";

  // Thursday of the current ISO week determines the year the week belongs to.
  const thursday = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const dayIndex = (thursday.getUTCDay() + 6) % 7; // Monday = 0
  thursday.setUTCDate(thursday.getUTCDate() - dayIndex + 3);

  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const firstDayIndex = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayIndex + 3);

  const week = 1 + Math.round((thursday - firstThursday) / (7 * DAY_MS));
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function id(value) {
  if (!value) return "";
  return String(value._id || value.id || value);
}

// --- the registry ------------------------------------------------------------

/**
 * Each entry:
 *
 *   category   which switch on the settings page governs it
 *   priority   how far it may push past the viewer's quiet hours and caps
 *   channels   the channels it *wants*; policy narrows this, never widens it
 *   ttlDays    how long it stays in the inbox before Mongo reaps it
 *   minScore   audience relevance floor, for the types chosen by taste rather
 *              than by an explicit follow. Below it, nothing is created at all.
 *   render     ctx -> { title, body, deepLink, image, entity, ... } or null
 *   dedupeKey  ctx -> a globally unique string, or null to allow repeats
 *   groupKey   ctx -> a key the inbox collapses on, or null
 *
 * `render` returning null means "not enough context to say anything true", and
 * the caller drops the notification rather than persisting a row that reads
 * "New episode of undefined".
 */
const TYPES = {
  // --- catalogue -----------------------------------------------------------

  /** An episode of a show this viewer follows or has already been watching. */
  "episode.published": {
    type: "episode.published",
    category: "new_content",
    priority: "high",
    channels: ["inapp", "push"],
    ttlDays: 30,
    render(ctx) {
      const show = ctx.show;
      const episode = ctx.episode;
      if (!show?.title || !episode) return null;

      const code = episodeCode(episode);
      const name = text(episode.title);

      return {
        title: `New episode of ${truncate(show.title, 48)}`,
        // The code alone is what a viewer scans for; the episode name is the
        // part that makes them press play, so both are here and the name is
        // what gets sacrificed to length.
        body: [code, name && truncate(name, 60)].filter(Boolean).join(" · ") || "A new episode is ready to watch.",
        deepLink: `/watch/episode/${id(episode)}`,
        image: text(episode.stillPath) || text(show.backdrop) || text(show.poster),
        entity: { kind: "episode", id: id(episode), title: name || code },
      };
    },
    dedupeKey: (ctx) => `episode.published:${id(ctx.episode)}:${id(ctx.userId)}`,
    groupKey: (ctx) => `show:${id(ctx.show)}`,
  },

  /**
   * A whole season landing at once.
   *
   * Distinct from ten episode.published rows on purpose: a season drop is one
   * event to a viewer, and announcing it per episode is the single most
   * reliable way to make someone turn notifications off.
   */
  "season.published": {
    type: "season.published",
    category: "new_content",
    priority: "high",
    channels: ["inapp", "push"],
    ttlDays: 30,
    render(ctx) {
      const show = ctx.show;
      const seasonNumber = Number(ctx.season?.seasonNumber ?? ctx.seasonNumber);
      if (!show?.title || !Number.isFinite(seasonNumber)) return null;

      const count = Number(ctx.episodeCount) || 0;

      return {
        title: `${truncate(show.title, 44)} — Season ${seasonNumber}`,
        body: count
          ? `${count} new ${plural(count, "episode")} just landed.`
          : "A new season just landed.",
        deepLink: `/series/${id(show)}`,
        image: text(ctx.season?.backdrop) || text(show.backdrop) || text(show.poster),
        entity: { kind: "show", id: id(show), title: text(show.title) },
      };
    },
    dedupeKey: (ctx) =>
      `season.published:${id(ctx.season) || `${id(ctx.show)}:${ctx.seasonNumber}`}:${id(ctx.userId)}`,
    groupKey: (ctx) => `show:${id(ctx.show)}`,
  },

  /**
   * A new series, offered on taste rather than on a follow.
   *
   * `minScore` is what separates this from spam: nobody is told about a new
   * series because it is new, only because it looks like something they watch.
   */
  "show.published": {
    type: "show.published",
    category: "recommendations",
    priority: "normal",
    channels: ["inapp", "push"],
    ttlDays: 21,
    minScore: 0.45,
    render(ctx) {
      const show = ctx.show;
      if (!show?.title) return null;

      return {
        title: `New series: ${truncate(show.title, 46)}`,
        body:
          truncate(show.overview, 110) ||
          [
            Array.isArray(show.genres) ? show.genres.filter(Boolean).slice(0, 2).join(" · ") : "",
            show.releaseYear ? String(show.releaseYear) : "",
          ]
            .filter(Boolean)
            .join(" · ") ||
          "Just added to Nextream.",
        deepLink: `/series/${id(show)}`,
        image: text(show.backdrop) || text(show.poster),
        entity: { kind: "show", id: id(show), title: text(show.title) },
      };
    },
    dedupeKey: (ctx) => `show.published:${id(ctx.show)}:${id(ctx.userId)}`,
    groupKey: () => "new-releases",
  },

  "movie.published": {
    type: "movie.published",
    category: "recommendations",
    priority: "normal",
    channels: ["inapp", "push"],
    ttlDays: 21,
    minScore: 0.45,
    render(ctx) {
      const movie = ctx.movie;
      if (!movie?.title) return null;

      return {
        title: `New on Nextream: ${truncate(movie.title, 42)}`,
        body:
          truncate(movie.desc, 110) ||
          [text(movie.genre), movie.year ? String(movie.year) : ""].filter(Boolean).join(" · ") ||
          "Just added to Nextream.",
        deepLink: `/details/${id(movie)}`,
        image: text(movie.img) || text(movie.imgSm),
        entity: { kind: "movie", id: id(movie), title: text(movie.title) },
      };
    },
    dedupeKey: (ctx) => `movie.published:${id(ctx.movie)}:${id(ctx.userId)}`,
    groupKey: () => "new-releases",
  },

  /**
   * Something the viewer explicitly saved became watchable.
   *
   * High priority and no score floor, because saving a title *is* the request
   * to be told about it — this is the one new-content notification the viewer
   * has already asked for in as many words.
   */
  "list.available": {
    type: "list.available",
    category: "new_content",
    priority: "high",
    channels: ["inapp", "push"],
    ttlDays: 30,
    render(ctx) {
      const title = text(ctx.entityTitle);
      if (!title || !ctx.deepLink) return null;

      return {
        title: `${truncate(title, 44)} is ready`,
        body: "From your list — it's now available to watch.",
        deepLink: String(ctx.deepLink),
        image: text(ctx.image),
        entity: { kind: text(ctx.entityKind) || "movie", id: id(ctx.entityId), title },
      };
    },
    dedupeKey: (ctx) => `list.available:${id(ctx.entityId)}:${id(ctx.userId)}`,
    groupKey: () => "my-list",
  },

  // --- continue watching ---------------------------------------------------

  /**
   * The next episode is queued.
   *
   * In-app only, and deliberately so. Finishing an episode is not a moment that
   * needs a phone to buzz — the viewer is looking at the screen. It exists so
   * that when they come back, the inbox already points at the right episode.
   */
  "next_episode.ready": {
    type: "next_episode.ready",
    category: "continue_watching",
    priority: "low",
    channels: ["inapp"],
    ttlDays: 14,
    render(ctx) {
      const show = ctx.show;
      const episode = ctx.episode;
      if (!show?.title || !episode) return null;

      const code = episodeCode(episode);

      return {
        title: `Next up in ${truncate(show.title, 46)}`,
        body: [code, truncate(episode.title, 58)].filter(Boolean).join(" · "),
        deepLink: `/watch/episode/${id(episode)}`,
        image: text(episode.stillPath) || text(show.backdrop),
        entity: { kind: "episode", id: id(episode), title: text(episode.title) || code },
      };
    },
    dedupeKey: (ctx) => `next_episode.ready:${id(ctx.episode)}:${id(ctx.userId)}`,
    groupKey: (ctx) => `show:${id(ctx.show)}`,
  },

  /**
   * A title left unfinished for long enough that the viewer has probably
   * forgotten it. Once per title per week, enforced by the dedupe key.
   */
  "continue.reminder": {
    type: "continue.reminder",
    category: "continue_watching",
    priority: "normal",
    channels: ["inapp", "push"],
    ttlDays: 10,
    render(ctx) {
      const title = text(ctx.entityTitle);
      if (!title || !ctx.deepLink) return null;

      const percent = Math.round(Number(ctx.percent) || 0);
      // "0% through" is not a fact worth stating, and neither is 99% — the
      // former means they never really started, the latter that they all but
      // finished. Both fall back to the generic line.
      const progress =
        percent >= 5 && percent <= 95
          ? `You're ${percent}% through. Pick up where you left off.`
          : "Pick up where you left off.";

      return {
        title: `Still watching ${truncate(title, 42)}?`,
        body: ctx.episodeCode ? `${ctx.episodeCode} · ${progress}` : progress,
        deepLink: String(ctx.deepLink),
        image: text(ctx.image),
        entity: { kind: text(ctx.entityKind) || "movie", id: id(ctx.entityId), title },
      };
    },
    dedupeKey: (ctx) =>
      `continue.reminder:${id(ctx.entityId)}:${id(ctx.userId)}:${weekKey(ctx.now || new Date())}`,
    groupKey: () => "continue",
  },

  /** Close enough to the end of a season that finishing is one sitting. */
  "finish.nudge": {
    type: "finish.nudge",
    category: "continue_watching",
    priority: "normal",
    channels: ["inapp", "push"],
    ttlDays: 10,
    render(ctx) {
      const show = ctx.show;
      const remaining = Number(ctx.remaining);
      if (!show?.title || !Number.isFinite(remaining) || remaining <= 0) return null;
      if (!ctx.episode) return null;

      return {
        title: `${remaining} ${plural(remaining, "episode")} left in ${truncate(show.title, 34)}`,
        body: `Finish ${ctx.seasonNumber ? `Season ${ctx.seasonNumber}` : "the season"} — next up is ${episodeCode(ctx.episode)}.`,
        deepLink: `/watch/episode/${id(ctx.episode)}`,
        image: text(ctx.episode.stillPath) || text(show.backdrop) || text(show.poster),
        entity: { kind: "show", id: id(show), title: text(show.title) },
      };
    },
    dedupeKey: (ctx) =>
      `finish.nudge:${id(ctx.show)}:${id(ctx.userId)}:${weekKey(ctx.now || new Date())}`,
    groupKey: (ctx) => `show:${id(ctx.show)}`,
  },

  // --- social --------------------------------------------------------------

  /**
   * Someone commented on a title this viewer reviewed or commented on.
   *
   * High: a reply is addressed to a person, and a reply that arrives a day late
   * has stopped being a conversation.
   */
  "comment.reply": {
    type: "comment.reply",
    category: "social",
    priority: "high",
    channels: ["inapp", "push"],
    ttlDays: 30,
    render(ctx) {
      const author = text(ctx.actorName);
      const title = text(ctx.entityTitle);
      if (!author || !ctx.deepLink) return null;

      return {
        title: title ? `${truncate(author, 24)} commented on ${truncate(title, 34)}` : `${truncate(author, 24)} left a comment`,
        body: truncate(ctx.excerpt, 120) || "Tap to read the thread.",
        deepLink: String(ctx.deepLink),
        entity: { kind: "movie", id: id(ctx.entityId), title },
      };
    },
    dedupeKey: (ctx) => `comment.reply:${id(ctx.commentId)}:${id(ctx.userId)}`,
    groupKey: (ctx) => `discussion:${id(ctx.entityId)}`,
  },

  /** A like on the viewer's own review. Pleasant, never urgent. */
  "review.liked": {
    type: "review.liked",
    category: "social",
    priority: "low",
    channels: ["inapp"],
    ttlDays: 30,
    render(ctx) {
      const author = text(ctx.actorName);
      const title = text(ctx.entityTitle);
      if (!author || !ctx.deepLink) return null;

      return {
        title: `${truncate(author, 26)} liked your review`,
        body: title ? `Your review of ${truncate(title, 60)}.` : "Tap to see it.",
        deepLink: String(ctx.deepLink),
        entity: { kind: "review", id: id(ctx.reviewId), title },
      };
    },
    // One notification per (review, liker): a like/unlike/like loop must not
    // produce three. The recipient is implied by the review's author.
    dedupeKey: (ctx) => `review.liked:${id(ctx.reviewId)}:${id(ctx.actorId)}`,
    groupKey: (ctx) => `review:${id(ctx.reviewId)}`,
  },

  // --- digest & product ----------------------------------------------------

  /**
   * The weekly roundup: what a viewer gets instead of individual alerts if they
   * would rather have one thing a week. Repeats by design, so the dedupe key
   * carries the week rather than being null — that way a scheduler that runs
   * twice on a Monday still only sends one.
   */
  "digest.weekly": {
    type: "digest.weekly",
    category: "digest",
    priority: "low",
    channels: ["inapp", "push"],
    ttlDays: 14,
    render(ctx) {
      const items = Array.isArray(ctx.items) ? ctx.items.filter((item) => text(item?.title)) : [];
      if (!items.length) return null;

      const names = items.slice(0, 3).map((item) => truncate(item.title, 28));
      const extra = items.length - names.length;

      return {
        title: `${items.length} new ${plural(items.length, "title")} for you this week`,
        body: extra > 0 ? `${names.join(", ")} and ${extra} more.` : `${names.join(", ")}.`,
        deepLink: "/",
        image: text(items[0]?.image),
        entity: { kind: "digest", id: weekKey(ctx.now || new Date()), title: "Weekly roundup" },
      };
    },
    dedupeKey: (ctx) => `digest.weekly:${id(ctx.userId)}:${weekKey(ctx.now || new Date())}`,
    groupKey: () => "digest",
  },

  /**
   * An admin broadcast. The only type whose copy comes from outside this file,
   * so it is the only one whose render is a pass-through — and it still refuses
   * to build a row without a title.
   */
  "system.announcement": {
    type: "system.announcement",
    category: "product",
    priority: "normal",
    channels: ["inapp", "push"],
    ttlDays: 60,
    render(ctx) {
      const title = text(ctx.title);
      if (!title) return null;

      return {
        title: truncate(title, 90),
        body: truncate(ctx.body, 220),
        deepLink: text(ctx.deepLink) || "/",
        image: text(ctx.image),
        entity: { kind: "announcement", id: id(ctx.campaignId), title },
      };
    },
    // Null: an admin may legitimately send the same words twice, and a unique
    // key would silently swallow the second campaign.
    dedupeKey: () => null,
    groupKey: () => "announcements",
  },

  /**
   * A sign-in from a device we have not seen before.
   *
   * Transactional: it ignores quiet hours, caps and every preference, because
   * the whole value of the message is that it arrives while the session it is
   * describing is still live.
   */
  "account.security": {
    type: "account.security",
    category: "account",
    priority: "transactional",
    channels: ["inapp", "push"],
    ttlDays: 180,
    render(ctx) {
      const device = text(ctx.device) || "a new device";

      return {
        title: "New sign-in to your account",
        body: `Your account was just used to sign in on ${truncate(device, 70)}. If this wasn't you, change your password.`,
        deepLink: "/profile",
        entity: { kind: "account", id: id(ctx.userId), title: "Account" },
      };
    },
    dedupeKey: (ctx) => (ctx.fingerprint ? `account.security:${id(ctx.userId)}:${ctx.fingerprint}` : null),
    groupKey: () => "account",
  },
};

// --- accessors ---------------------------------------------------------------

function getType(type) {
  return Object.prototype.hasOwnProperty.call(TYPES, type) ? TYPES[type] : null;
}

function categoryOf(type) {
  return getType(type)?.category || null;
}

/** Types a viewer can be sent, grouped by the switch that controls them. */
function typesByCategory() {
  const out = {};
  for (const key of Object.keys(CATEGORIES)) out[key] = [];
  for (const definition of Object.values(TYPES)) {
    if (out[definition.category]) out[definition.category].push(definition.type);
  }
  return out;
}

/**
 * The default preference document.
 *
 * Built from CATEGORIES rather than written out, so adding a category cannot
 * leave a viewer with an undefined switch that reads as "off" in one place and
 * "on" in another.
 */
function defaultPreferences() {
  const categories = {};
  for (const entry of Object.values(CATEGORIES)) {
    categories[entry.key] = entry.default !== false;
  }
  return {
    /** Master switch. Off means in-app only — never off for the inbox itself. */
    push: true,
    categories,
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    timezone: "UTC",
    /** Account-wide ceiling on interruptions per day. */
    maxPushPerDay: 6,
    /** Minimum spacing between two pushes, in minutes. */
    minPushGapMinutes: 20,
    /** Absorb low-priority types into one weekly summary instead. */
    digest: false,
  };
}

// --- entry construction ------------------------------------------------------

/**
 * Turns an event context into a persistable notification draft.
 *
 * Returns null — rather than throwing — whenever the result would be a row that
 * cannot be rendered honestly: an unknown type, a score below the type's floor,
 * or a render that could not find the fields it needs. A dropped notification
 * is a non-event; a notification titled "New episode of undefined" is a bug the
 * viewer sees.
 */
function buildEntry(type, ctx = {}) {
  const definition = getType(type);
  if (!definition) return null;

  const score = Number.isFinite(Number(ctx.score)) ? Number(ctx.score) : 1;
  if (Number.isFinite(definition.minScore) && score < definition.minScore) return null;

  let rendered;
  try {
    rendered = definition.render(ctx);
  } catch (err) {
    // A malformed context is the caller's bug, but it must not take down the
    // request that emitted the event.
    return null;
  }
  if (!rendered || !text(rendered.title)) return null;

  const now = ctx.now instanceof Date ? ctx.now : new Date(ctx.now || Date.now());
  const dedupeKey = definition.dedupeKey ? definition.dedupeKey({ ...ctx, now }) : null;
  const groupKey = definition.groupKey ? definition.groupKey({ ...ctx, now }) : null;

  return {
    type: definition.type,
    category: definition.category,
    priority: definition.priority,
    title: rendered.title,
    body: rendered.body || "",
    icon: rendered.icon || "",
    image: rendered.image || "",
    deepLink: rendered.deepLink || "",
    entity: {
      kind: rendered.entity?.kind || "",
      id: rendered.entity?.id ? String(rendered.entity.id) : "",
      title: rendered.entity?.title || "",
    },
    data: { ...(ctx.data || {}) },
    reason: text(ctx.reason),
    score,
    groupKey: groupKey || null,
    dedupeKey: dedupeKey || null,
    /** What the type would *like*; policy narrows this before it is stored. */
    channels: [...definition.channels],
    expiresAt: Number.isFinite(definition.ttlDays)
      ? new Date(now.getTime() + definition.ttlDays * DAY_MS)
      : null,
    campaignId: ctx.campaignId ? String(ctx.campaignId) : null,
    createdBy: ctx.createdBy || null,
  };
}

module.exports = {
  CATEGORIES,
  PRIORITIES,
  TYPES,
  buildEntry,
  categoryOf,
  defaultPreferences,
  episodeCode,
  getType,
  plural,
  truncate,
  typesByCategory,
  weekKey,
};
