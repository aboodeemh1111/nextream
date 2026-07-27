const test = require("node:test");
const assert = require("node:assert");

// Deterministic, throwaway config — no live service is contacted by this file.
process.env.S3_ENDPOINT = "http://localhost:9000";
process.env.S3_REGION = "us-east-1";
process.env.S3_BUCKET = "nextream-media";
process.env.S3_ACCESS_KEY_ID = "minioadmin";
process.env.S3_SECRET_ACCESS_KEY = "minioadmin";
process.env.S3_FORCE_PATH_STYLE = "true";

const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const sign = require("./sign");

const FIXED_DATE = new Date("2026-07-28T10:30:00Z");

function sdkClient() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
}

// The signer is hand-rolled so the read middleware can stay synchronous.
// These cases pin it against the reference implementation, including the
// signature itself — a canonical-request or encoding bug shows up here.
test("signGetUrl is byte-identical to @aws-sdk/s3-request-presigner", async () => {
  const cases = [
    ["videos/2026/07/uuid-plain.mp4", 21600],
    ["images/2026/07/uuid-poster.jpg", 86400],
    ["subs/2026/07/uuid-en.vtt", 21600],
    // Characters that expose URI-encoding mistakes.
    ["videos/2026/07/uuid-a b+c.mp4", 21600],
    ["videos/2026/07/uuid-a(1)*'!.mp4", 21600],
    ["videos/2026/07/uuid-100%25-café.mp4", 21600],
    ["videos/2026/07/uuid-tilde~dash-dot.name.mp4", 21600],
    ["shows/seasons/2026/07/uuid-deep/nested/path.jpg", 3600],
  ];

  for (const [key, ttl] of cases) {
    const expected = await getSignedUrl(
      sdkClient(),
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
      { expiresIn: ttl, signingDate: FIXED_DATE }
    );
    const actual = sign.signGetUrl(key, ttl, { date: FIXED_DATE });
    assert.strictEqual(actual, expected, `mismatch for key: ${key}`);
  }
});

test("signGetUrl matches the SDK for content-disposition downloads", async () => {
  const key = "videos/2026/07/uuid-film.mp4";
  const expected = await getSignedUrl(
    sdkClient(),
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ResponseContentDisposition: 'attachment; filename="film.mp4"',
    }),
    { expiresIn: 21600, signingDate: FIXED_DATE }
  );
  const actual = sign.signGetUrl(key, 21600, {
    date: FIXED_DATE,
    download: "film.mp4",
  });
  assert.strictEqual(actual, expected);
});

test("signed URLs carry the expected SigV4 query parameters", () => {
  const url = new URL(
    sign.signGetUrl("videos/2026/07/uuid-x.mp4", 21600, { date: FIXED_DATE })
  );
  assert.strictEqual(url.origin, "http://localhost:9000");
  assert.strictEqual(url.pathname, "/nextream-media/videos/2026/07/uuid-x.mp4");
  assert.strictEqual(
    url.searchParams.get("X-Amz-Algorithm"),
    "AWS4-HMAC-SHA256"
  );
  assert.strictEqual(url.searchParams.get("X-Amz-Expires"), "21600");
  assert.strictEqual(url.searchParams.get("X-Amz-SignedHeaders"), "host");
  assert.match(url.searchParams.get("X-Amz-Signature"), /^[0-9a-f]{64}$/);
  assert.match(
    url.searchParams.get("X-Amz-Credential"),
    /^minioadmin\/20260728\/us-east-1\/s3\/aws4_request$/
  );
});

test("a different key or ttl produces a different signature", () => {
  const a = sign.signGetUrl("videos/2026/07/a.mp4", 21600, { date: FIXED_DATE });
  const b = sign.signGetUrl("videos/2026/07/b.mp4", 21600, { date: FIXED_DATE });
  const c = sign.signGetUrl("videos/2026/07/a.mp4", 3600, { date: FIXED_DATE });
  const sig = (u) => new URL(u).searchParams.get("X-Amz-Signature");
  assert.notStrictEqual(sig(a), sig(b));
  assert.notStrictEqual(sig(a), sig(c));
});

// --- TTL policy -------------------------------------------------------------

test("video TTL is at least 6h even if the env var says otherwise", () => {
  const original = process.env.MEDIA_URL_TTL_VIDEO;
  try {
    // A 15-minute signature expires mid-movie: progressive MP4 keeps
    // re-requesting byte ranges on the same URL for the whole session.
    process.env.MEDIA_URL_TTL_VIDEO = "900";
    assert.strictEqual(sign.ttlPolicy().video, sign.MIN_VIDEO_TTL);
    assert.ok(sign.ttlPolicy().video >= 6 * 3600);

    process.env.MEDIA_URL_TTL_VIDEO = "43200";
    assert.strictEqual(sign.ttlPolicy().video, 43200);

    // SigV4 refuses anything past 7 days.
    process.env.MEDIA_URL_TTL_VIDEO = "99999999";
    assert.strictEqual(sign.ttlPolicy().video, sign.MAX_TTL);

    delete process.env.MEDIA_URL_TTL_VIDEO;
    assert.strictEqual(sign.ttlPolicy().video, 6 * 3600);
  } finally {
    if (original === undefined) delete process.env.MEDIA_URL_TTL_VIDEO;
    else process.env.MEDIA_URL_TTL_VIDEO = original;
  }
});

test("ttlFor picks the policy from the media type", () => {
  assert.strictEqual(sign.ttlFor("videos/2026/07/uuid-x.mp4"), 6 * 3600);
  assert.strictEqual(sign.ttlFor("episodes/2026/07/uuid-x.mp4"), 6 * 3600);
  assert.strictEqual(sign.ttlFor("images/2026/07/uuid-x.jpg"), 24 * 3600);
  assert.strictEqual(sign.ttlFor("episodes/2026/07/uuid-still.jpg"), 24 * 3600);
  assert.strictEqual(sign.ttlFor("subs/2026/07/uuid-en.vtt"), 6 * 3600);
});

// --- Memoisation ------------------------------------------------------------

test("presignGet memoises and defaults the ttl from the key", () => {
  sign.clearCache();
  const key = "videos/2026/07/uuid-memo.mp4";
  const first = sign.presignGet(key);
  const second = sign.presignGet(key);
  assert.strictEqual(first, second);
  assert.strictEqual(
    new URL(first).searchParams.get("X-Amz-Expires"),
    String(6 * 3600)
  );

  // Different download disposition must not collide in the cache.
  const download = sign.presignGet(key, null, { download: "film.mp4" });
  assert.notStrictEqual(download, first);
  sign.clearCache();
});
