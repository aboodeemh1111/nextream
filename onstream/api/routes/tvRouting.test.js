const test = require("node:test");
const assert = require("node:assert");
const express = require("express");

const tvRoute = require("./tv");
const tvAdminRoute = require("./tvAdmin");

// Regression cover for a routing bug that silently disabled the whole admin TV
// surface: the admin routes used to be registered in routes/tv.js *after* the
// "/:showId" and "/:showId/seasons/:seasonNumber/episodes" wildcards, which
// match "/admin" and "/admin/seasons/<id>/episodes" first. Every admin call
// fell through to a public handler and 500'd on a CastError, and the UI's
// catch-block fallback made it look like the data was simply empty.
//
// The assertion is about *which router answers*, so no database is needed: an
// unauthenticated request that reaches the admin router is rejected by
// verifyToken with 401, while one swallowed by the public router gets 400 or
// 500 from a handler that tried to treat "admin" as an object id.

function buildApp() {
  const app = express();
  app.use(express.json());
  // Same order as index.js — admin is mounted first, deliberately.
  app.use("/api/tv/admin", tvAdminRoute);
  app.use("/api/tv", tvRoute);
  return app;
}

function request(app, method, path) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const { port } = server.address();
      try {
        const res = await fetch(`http://127.0.0.1:${port}${path}`, { method });
        const body = await res.text();
        resolve({ status: res.status, body });
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
    server.on("error", reject);
  });
}

const ADMIN_PATHS = [
  ["GET", "/api/tv/admin/shows"],
  ["POST", "/api/tv/admin/shows"],
  ["GET", "/api/tv/admin/shows/507f1f77bcf86cd799439011"],
  ["PATCH", "/api/tv/admin/shows/507f1f77bcf86cd799439011"],
  ["DELETE", "/api/tv/admin/shows/507f1f77bcf86cd799439011"],
  ["GET", "/api/tv/admin/shows/507f1f77bcf86cd799439011/seasons"],
  ["POST", "/api/tv/admin/shows/507f1f77bcf86cd799439011/seasons"],
  ["POST", "/api/tv/admin/shows/507f1f77bcf86cd799439011/seasons/reorder"],
  ["POST", "/api/tv/admin/shows/507f1f77bcf86cd799439011/recount"],
  ["GET", "/api/tv/admin/seasons/507f1f77bcf86cd799439012/episodes"],
  ["POST", "/api/tv/admin/seasons/507f1f77bcf86cd799439012/episodes"],
  ["POST", "/api/tv/admin/seasons/507f1f77bcf86cd799439012/episodes/bulk"],
  ["POST", "/api/tv/admin/seasons/507f1f77bcf86cd799439012/episodes/reorder"],
  ["PATCH", "/api/tv/admin/seasons/507f1f77bcf86cd799439012"],
  ["DELETE", "/api/tv/admin/seasons/507f1f77bcf86cd799439012"],
  ["GET", "/api/tv/admin/episodes/507f1f77bcf86cd799439013"],
  ["PATCH", "/api/tv/admin/episodes/507f1f77bcf86cd799439013"],
  ["DELETE", "/api/tv/admin/episodes/507f1f77bcf86cd799439013"],
];

test("every admin TV route reaches the admin router, not a public wildcard", async () => {
  const app = buildApp();

  for (const [method, path] of ADMIN_PATHS) {
    const res = await request(app, method, path);
    assert.strictEqual(
      res.status,
      401,
      `${method} ${path} should be answered by the admin router (401 from verifyToken), got ${res.status}: ${res.body}`
    );
  }
});

test("public TV routes still answer without a token", async () => {
  const app = buildApp();

  // A malformed id is rejected by the public handler itself, which proves the
  // request was routed there rather than into the authenticated admin router.
  const show = await request(app, "GET", "/api/tv/not-an-object-id");
  assert.strictEqual(show.status, 400);

  const episode = await request(app, "GET", "/api/tv/episodes/not-an-object-id");
  assert.strictEqual(episode.status, 400);
});

test("the public router exposes no mutating routes", () => {
  const methods = tvRoute.stack
    .filter((layer) => layer.route)
    .flatMap((layer) => Object.keys(layer.route.methods));

  assert.deepStrictEqual([...new Set(methods)], ["get"]);
});
