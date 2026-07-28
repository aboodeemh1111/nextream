const router = require("express").Router();
const mongoose = require("mongoose");
const optionalAuth = require("../optionalAuth");
const { buildHomeFeed } = require("../services/recommendations");

/**
 * The home page, in one request.
 *
 * The page used to fan out: /lists for the row definitions, then one
 * /lists/find/:id per row, plus /movies/featured for the hero — a waterfall of
 * six or more round trips whose result was still movies-only, because `List`
 * documents reference the Movie collection and the TVShow catalogue has no
 * representation in them at all.
 *
 * optionalAuth rather than verify: the ranking is better with a token, but a
 * signed-out visitor should get the catalogue rather than a 401, and the payload
 * shape is identical either way so the client needs one code path.
 */

router.use(optionalAuth);

// Long enough that a reload inside a session is cheap, short enough that a
// freshly published title shows up without a deploy. `private` because the
// payload is ranked per viewer and must never land in a shared cache.
const CACHE_CONTROL = "private, max-age=60";

router.get("/feed", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      // Local dev without a database: an empty feed renders the "nothing
      // published yet" state, which is honest. A 500 renders a broken page.
      return res.status(200).json({
        hero: null,
        rows: [],
        profile: { personalised: false, topGenres: [] },
        degraded: "DB_UNAVAILABLE",
      });
    }

    const feed = await buildHomeFeed(req.user?.id || null, {
      rowSize: req.query.rowSize,
    });

    res.set("Cache-Control", CACHE_CONTROL);
    res.json(feed);
  } catch (err) {
    console.error("HOME_FEED_FAILED:", err);
    res.status(500).json({ error: "HOME_FEED_FAILED", message: err.message });
  }
});

module.exports = router;
