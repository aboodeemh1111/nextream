const path = require("path");
const dotenv = require("dotenv");

// index.js historically called dotenv.config(), which reads .env only — so
// .env.development was never actually loaded. Outside production we now also
// read .env.development, but *without* override: dotenv never replaces a value
// that already exists, so real Render/shell env vars and everything already set
// in .env keep winning. .env.development only fills genuine gaps (the S3_* keys
// for the local MinIO container).
function loadEnv() {
  dotenv.config();
  if (process.env.NODE_ENV !== "production") {
    dotenv.config({ path: path.join(__dirname, ".env.development") });
  }
}

module.exports = loadEnv;
