const jwt = require("jsonwebtoken");

/**
 * Sets req.user when a valid token is present, and never rejects.
 *
 * The public catalogue has to answer signed-out visitors, but the same rows read
 * much better when they can carry the viewer's progress and My List state.
 * verifyToken is all-or-nothing (401 with no token), so personalising a public
 * route with it would mean either two endpoints or a logged-out 401 — this is
 * the middle ground: same payload shape, personalised only when we know who is
 * asking. A bad or expired token is treated as signed out rather than an error,
 * so a stale tab degrades to the public view instead of breaking.
 */
module.exports = function optionalAuth(req, res, next) {
  const header = req.headers.token;
  if (!header) return next();

  const token = String(header).startsWith("Bearer ")
    ? String(header).slice(7)
    : String(header);
  if (!token) return next();

  jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
    if (!err && user) req.user = user;
    next();
  });
};
