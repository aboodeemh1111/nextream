/**
 * Minimal User-Agent classification for analytics buckets.
 *
 * Deliberately not a UA-parsing library: the profile page only ever groups by
 * "desktop / mobile / tablet / TV" and a coarse OS and browser name, and a
 * dependency whose whole job is a regex table is a dependency that has to be
 * kept current forever. Anything unrecognised falls into "unknown" rather than
 * being guessed at, so a bucket that grows is a signal to extend the table.
 */

const TV_HINTS = /\b(smart-?tv|smarttv|hbbtv|appletv|apple tv|googletv|crkey|chromecast|roku|web0s|webos|tizen|netcast|viera|aft[bmts]|bravia|playstation|xbox)\b/i;
const TABLET_HINTS = /\b(ipad|tablet|kindle|silk|playbook|nexus (?:7|9|10))\b/i;
const MOBILE_HINTS = /\b(iphone|ipod|android|windows phone|blackberry|bb10|opera mini|iemobile|mobile safari|mobile)\b/i;

/** Ordered most-specific first — Edge and Opera both claim to be Chrome. */
const BROWSERS = [
  [/\bedg(?:e|a|ios)?\/([\d.]+)/i, "Edge"],
  [/\b(?:opr|opera)\/([\d.]+)/i, "Opera"],
  [/\bsamsungbrowser\/([\d.]+)/i, "Samsung Internet"],
  [/\bfirefox\/([\d.]+)/i, "Firefox"],
  [/\bchrome\/([\d.]+)/i, "Chrome"],
  [/\bcriOS\/([\d.]+)/i, "Chrome"],
  [/version\/([\d.]+).*\bsafari\//i, "Safari"],
  [/\bsafari\/([\d.]+)/i, "Safari"],
];

/** Ordered most-specific first — Android UAs also contain "Linux". */
const PLATFORMS = [
  [/\bwindows nt\b/i, "Windows"],
  [/\b(?:iphone|ipad|ipod|ios)\b/i, "iOS"],
  [/\bmac os x\b/i, "macOS"],
  [/\bandroid\b/i, "Android"],
  [/\bcros\b/i, "ChromeOS"],
  [/\b(?:web0s|webos)\b/i, "webOS"],
  [/\btizen\b/i, "Tizen"],
  [/\broku\b/i, "Roku"],
  [/\blinux\b/i, "Linux"],
];

function matchFirst(table, ua) {
  for (const [pattern, label] of table) {
    if (pattern.test(ua)) return label;
  }
  return "unknown";
}

/**
 * TV before mobile: living-room devices routinely embed "Android" or a mobile
 * Safari token, and bucketing a television as a phone quietly ruins the device
 * mix on every dashboard that reads it.
 */
function classifyDevice(ua) {
  if (!ua) return "unknown";
  if (TV_HINTS.test(ua)) return "tv";
  if (TABLET_HINTS.test(ua)) return "tablet";
  // Android tablets omit "Mobile"; Android phones always carry it.
  if (/\bandroid\b/i.test(ua) && !/\bmobile\b/i.test(ua)) return "tablet";
  if (MOBILE_HINTS.test(ua)) return "mobile";
  return "desktop";
}

/**
 * @param {string} userAgent raw User-Agent header
 * @returns {{type: string, os: string, browser: string, userAgent: string}}
 */
function parseUserAgent(userAgent) {
  const ua = typeof userAgent === "string" ? userAgent : "";
  return {
    type: classifyDevice(ua),
    os: matchFirst(PLATFORMS, ua),
    browser: matchFirst(BROWSERS, ua),
    // Capped: the full string is only ever read for debugging a mis-bucketed
    // device, and it is stored on every session row.
    userAgent: ua.slice(0, 300),
  };
}

/** Short human label for the login history list, e.g. "Chrome on Windows". */
function describeDevice(device) {
  if (!device) return "Unknown device";
  const { browser, os } = device;
  if (browser === "unknown" && os === "unknown") return "Unknown device";
  if (browser === "unknown") return os;
  if (os === "unknown") return browser;
  return `${browser} on ${os}`;
}

module.exports = { parseUserAgent, describeDevice, classifyDevice };
