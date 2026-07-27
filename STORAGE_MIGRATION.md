# Nextream — Self-Hosted Storage Bucket: Implementation Plan

Replace Firebase Storage with a self-hosted, S3-compatible bucket (MinIO) that you own,
fronted by nginx, integrated through the Express API rather than the browser.

**Scope:** `onstream/api` (backend), `nextream-admin` (uploads), `nextream-client` + `nextream_mobile` (playback).
**FCM stays on Firebase.** Only Storage is being replaced.

---

## 0. Current state (audited)

| Concern | Today |
|---|---|
| Upload path | Browser → Firebase Storage directly. Backend never sees it. |
| Auth on upload | Firebase Storage rules only. `verifyToken.js` is not involved. |
| URL form | Permanent public `firebasestorage.googleapis.com/...?alt=media&token=…` |
| Stored in Mongo | Full URL string in `Movie.img/imgSm/imgTitle/trailer/video`, `TVShow.poster/backdrop/trailerUrl`, `Season.poster/backdrop`, `Episode.stillPath/videoSources[].url/subtitles[].url/thumbnails[]`, `User.profilePic` |
| Playback | Raw `<video src={url}>`; Flutter `video_player`/`chewie` |
| Deletion | Mongo doc deleted, blob orphaned forever |
| Backend storage code | **None** — `firebase-admin` is FCM-only |

### The one insight that shapes this plan

The client apps read `movie.img`, `movie.video`, `movie.trailer`, `episode.videoSources[].url`
**directly as URLs** in ~20 render sites across web and mobile.

If the API keeps returning **fully-usable URLs in the same field names**, the client and mobile
apps need *zero* logic changes. So: store **keys** in Mongo, sign them into URLs on the way out.

That makes this migration **backend-only for reads**, and confines frontend work to the three
admin uploader components.

---

## 1. Target architecture

```
                        ┌──────────────────────────────────┐
  Admin (Vercel)        │  Your VPS — storage.nextream.app │
      │                 │                                  │
      │ 1. POST /api/uploads/presign  (JWT + isAdmin)      │
      ├──────────────────► API (Render) ──signs──┐         │
      │ 2. { url, key }                          │         │
      │◄─────────────────────────────────────────┘         │
      │                 │                                  │
      │ 3. PUT bytes ───┼──► nginx :443 ──► MinIO :9000    │
      │    (direct)     │      TLS, CORS      /data (disk) │
                        └──────────────────────────────────┘
  Client / Mobile
      │ 4. GET /api/movies/find/:id
      ├──────────────────► API: reads key from Mongo,
      │                         signs short-lived URL,
      │ 5. { video: "https://storage…/videos/x.mp4?X-Amz-…" }
      │◄─────────────────────────
      │ 6. GET video w/ Range ──► nginx ──► MinIO (206 Partial Content)
```

**Why MinIO rather than hand-rolled:** it's still your box, your disk, your data — but you get
multipart uploads, HTTP Range, ETag integrity, and lifecycle rules without writing them. The
S3 API also means the driver seam in §3.1 lets you swap in a hand-rolled server later without
touching a single call site.

---

## 2. Phase 0 — Provision the bucket host

**Blocker being solved:** Render and Vercel both have ephemeral filesystems. Files written by the
Express process vanish on redeploy. The bucket must be its own host with a persistent disk.

### 2.1 Server

- 1 VPS, persistent disk, **1 Gbps unmetered or ≥20 TB/mo** (Hetzner / OVH / Contabo).
- Sizing: 1080p H.264 ≈ 5 Mbps per viewer → 1 Gbps ≈ 200 concurrent streams theoretical,
  plan ~120 with headroom. Disk: ~2 GB per title → 1 TB ≈ 500 titles.
- DNS: `storage.nextream.app` → VPS IP.

### 2.2 `docker-compose.yml` (on the VPS)

```yaml
services:
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - /srv/nextream/data:/data
    restart: unless-stopped
    ports:
      - "127.0.0.1:9000:9000"   # bind localhost only; nginx is the only entry
      - "127.0.0.1:9001:9001"
```

### 2.3 Bucket + scoped credentials

Do **not** ship the root key to the API. Create a dedicated user limited to one bucket:

```bash
mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc mb local/nextream-media
mc admin user add local nextream-api "$API_SECRET"
mc admin policy attach local readwrite --user nextream-api
```

Keep the bucket **private**. All access is via signed URLs — there is no public-read path.

### 2.4 nginx

```nginx
server {
  listen 443 ssl http2;
  server_name storage.nextream.app;

  ssl_certificate     /etc/letsencrypt/live/storage.nextream.app/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/storage.nextream.app/privkey.pem;

  client_max_body_size 0;          # video uploads; MinIO enforces real limits
  proxy_request_buffering off;     # stream uploads through, don't spool to disk
  proxy_buffering off;             # critical for range/seek latency

  location / {
    proxy_pass http://127.0.0.1:9000;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_connect_timeout 300;
    chunked_transfer_encoding off;
  }
}
```

`proxy_buffering off` matters: with buffering on, nginx tries to buffer whole video responses and
seeking becomes laggy.

### 2.5 CORS on the bucket

The admin browser PUTs **directly** from `nextream-admin.vercel.app` to `storage.nextream.app`.
Without CORS every upload fails at the preflight.

```bash
mc cors set local/nextream-media - <<'JSON'
{ "CORSRules": [{
  "AllowedOrigins": ["https://nextream-admin.vercel.app","http://localhost:3001"],
  "AllowedMethods": ["GET","PUT","POST","HEAD"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3000
}]}
JSON
```

`ExposeHeaders: ETag` is required for multipart uploads (§4.2) — the browser must read each
part's ETag to complete the upload.

### 2.6 Optional: Cloudflare in front

Proxy `storage.nextream.app` through Cloudflare for TLS, origin-IP hiding, and image caching.
Note their ToS restricts large-scale video through the free CDN — fine at portfolio scale, read it
before you grow. Signed URLs still work: the query string passes through.

**Exit criteria:** `mc ls local/nextream-media` works; `curl -I https://storage.nextream.app` returns
from MinIO; a manual presigned PUT + ranged GET both succeed.

---

## 3. Phase 1 — Backend storage module

New directory: `onstream/api/storage/`

### 3.1 `storage/index.js` — driver seam

```js
// Returns the active driver. One switch, so a hand-rolled backend can slot in later
// without touching any call site.
const driver = process.env.STORAGE_DRIVER || 's3';
module.exports = require(`./${driver}Driver`);
// Contract every driver implements:
//   presignPut(key, contentType, ttl)        -> Promise<string>
//   presignGet(key, ttl, { download })       -> Promise<string>
//   createMultipart(key, contentType)        -> Promise<{ uploadId }>
//   presignPart(key, uploadId, partNumber)   -> Promise<string>
//   completeMultipart(key, uploadId, parts)  -> Promise<void>
//   abortMultipart(key, uploadId)            -> Promise<void>
//   deleteObject(key)                        -> Promise<void>
//   headObject(key)                          -> Promise<{ size, contentType } | null>
```

### 3.2 `storage/s3Driver.js`

Uses `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` against MinIO:

```js
const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,        // https://storage.nextream.app
  region:   process.env.S3_REGION || 'us-east-1',
  forcePathStyle: true,                     // required for MinIO
  credentials: {
    accessKeyId:     process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});
```

### 3.3 `storage/keys.js` — key builders + validation

Mirrors the folder layout already in use, so nothing about the content model changes:

```js
const PREFIXES = ['images','trailers','videos','shows','episodes','subs','avatars'];

buildKey(prefix, originalName)  // -> "videos/2026/07/<uuid>-slugified-name.mp4"
isStorageKey(value)             // -> /^(images|trailers|videos|shows|episodes|subs|avatars)\//
isLegacyFirebaseUrl(value)      // -> startsWith('https://firebasestorage.googleapis.com/')
```

`buildKey` **must** generate the key server-side from a UUID — never accept a
client-supplied path, or an admin token becomes an arbitrary-write primitive over the bucket.
Date-shard (`YYYY/MM`) so no single prefix accumulates unbounded objects.

### 3.4 `storage/sign.js` — TTL policy

**The gotcha that breaks production:** a 15-minute signed URL expires *mid-movie*. Progressive MP4
playback re-requests byte ranges for the entire session using the same URL, so a 2-hour film on a
15-minute signature dies the first time the viewer seeks past the expiry.

```js
const TTL = {
  video: 6 * 3600,   // ≥ longest plausible watch session
  image: 24 * 3600,  // long, and CDN-cacheable
  subtitle: 6 * 3600,
};
```

Also memoize signatures per request — one movie list can hit `presignGet` 150 times otherwise.

**Exit criteria:** unit tests for `buildKey` rejecting traversal (`../`, absolute paths, null bytes),
`isStorageKey`/`isLegacyFirebaseUrl` discrimination, and a live presign round-trip against MinIO.

---

## 4. Phase 2 — Upload API

New file: `onstream/api/routes/uploads.js`, mounted at `/api/uploads` and `/uploads`
(matching the dual-mount convention in `index.js`).

Every route is behind `verify` **plus** an explicit `req.user.isAdmin` check — the same guard style
as `movies.js:10`. This is the fix for uploads currently bypassing your auth entirely.

### 4.1 Simple upload — images, subtitles, small video

```
POST /api/uploads/presign
  body: { prefix: "images", filename: "poster.jpg", contentType: "image/jpeg", size: 204800 }
  ->    { key: "images/2026/07/<uuid>-poster.jpg", uploadUrl: "...", expiresIn: 900 }
```

Server validates: `prefix` ∈ allowlist; `contentType` ∈ allowlist per prefix
(`image/*` for images/avatars, `video/*` for videos/trailers, `text/vtt` for subs);
`size` ≤ per-prefix cap. The presigned URL pins `Content-Type`, so the client must send the
identical header or the signature fails.

### 4.2 Multipart — large video

`VideoUploader.tsx` today has pause / resume / cancel / ETA. A single presigned PUT **cannot**
resume — dropping to simple PUT would be a visible UX regression on 2 GB files. Multipart preserves it:

```
POST /api/uploads/multipart/create    { prefix, filename, contentType }  -> { key, uploadId }
POST /api/uploads/multipart/part      { key, uploadId, partNumber }      -> { url }
POST /api/uploads/multipart/complete  { key, uploadId, parts:[{PartNumber,ETag}] } -> { key }
POST /api/uploads/multipart/abort     { key, uploadId }                  -> 204
```

Part size 8–16 MB. The client keeps `{ partNumber, ETag }` per completed part, so pause/resume
is just "stop requesting new part URLs" and cancel maps to `abort`.

Add a MinIO lifecycle rule to expire incomplete multipart uploads after 7 days, or abandoned
2 GB uploads accumulate silently:

```bash
mc ilm rule add local/nextream-media --expire-delete-marker --noncurrent-expire-days 7
```

### 4.3 Confirm + delete

```
POST   /api/uploads/complete   { key }  -> headObject to verify it exists; returns { key, size }
DELETE /api/uploads/:key(*)             -> admin-only deleteObject
```

`/complete` is what makes the backend authoritative: a key only enters Mongo after the server has
confirmed the object actually landed.

**Exit criteria:** `/test-upload` page round-trips an image and a >100 MB video; non-admin JWT gets
403; a forged `prefix` or `filename: "../../etc/x"` is rejected.

---

## 5. Phase 3 — Read path (the zero-client-change trick)

New file: `onstream/api/middleware/mediaUrls.js`

Rather than editing every endpoint that returns media — `movies.js` has 7, `tv.js` has 14,
`users.js` populates `Movie` docs in 6 more, plus `lists.js`, `reviews.js`, `comments.js` — wrap
`res.json` **once** and deep-walk the payload:

```js
module.exports = function mediaUrls(req, res, next) {
  const orig = res.json.bind(res);
  res.json = (body) => orig(transform(body));
  next();
};

// transform: recurse arrays/objects; for every string leaf:
//   isStorageKey(v)        -> presignGet(v, ttlFor(v))     // new bucket
//   isLegacyFirebaseUrl(v) -> v                            // untouched, still works
//   otherwise              -> v                            // TMDB, Unsplash, demo data
```

Mounted in `index.js` **before** the route mounts:

```js
app.use(require("./middleware/mediaUrls"));   // after helmet/compression, before app.use("/api/...")
```

Consequences:

- Every current and future endpoint is covered automatically.
- **Dual-read is free.** Legacy Firebase URLs pass through untouched, so old content keeps playing
  throughout the migration. No flag-day.
- The seed/demo fallbacks in `movies.js:129` and `:281` (Unsplash URLs) are unaffected.
- Guard recursion depth (~8) and skip `_id`/`createdAt`; memoize per request.

### Writes

`POST /api/movies` and `PUT /api/movies/:id` now receive **keys** from the admin app.
Add validation: any media field must be either a valid storage key or a legacy Firebase URL —
reject arbitrary strings so a compromised admin session can't point `video` at a third-party host.

**Exit criteria:** `GET /api/movies/find/:id` on an unmigrated doc returns the Firebase URL verbatim;
on a migrated doc returns a signed `storage.nextream.app` URL; both play in the client.

---

## 6. Phase 4 — Admin app

### 6.1 `src/lib/uploadClient.ts` (new)

Transport, framework-free: presign → PUT with `XMLHttpRequest` (needed for real progress events;
`fetch` has no upload progress), multipart orchestration, abort handling.

### 6.2 `src/hooks/useUpload.ts` (new)

One hook exposing exactly the state the existing components already render —
`{ progress, speed, eta, status, error, key, url, start, pause, resume, cancel }` — so the JSX in
all three components stays essentially as-is.

### 6.3 Component rewrites

| File | Change |
|---|---|
| [`FileUpload.tsx`](nextream-admin/src/components/FileUpload.tsx) | Drop `firebase/storage`; `folder` prop → `prefix`. `onFileUpload(url)` → `onFileUpload(key)`. |
| [`VideoUploader.tsx`](nextream-admin/src/components/VideoUploader.tsx) | Drop `getStorage`; multipart path. `storagePathBuilder` prop is **removed** — the server owns key generation now. Callers pass `prefix` instead. |
| [`SubtitleUploader.tsx`](nextream-admin/src/components/SubtitleUploader.tsx) | Same; `prefix="subs"`, `contentType: "text/vtt"`. |

Call sites to update — `storagePathBuilder={…}` → `prefix="…"`:

- `app/tv/new/page.tsx` lines 291, 303, 421, 430, 530
- `app/tv/[id]/edit/page.tsx` lines 338, 355
- `app/tv/[id]/seasons/[seasonId]/episodes/new/page.tsx` lines 128, 138, 151, 173
- `app/tv/[id]/seasons/[seasonId]/episodes/[episodeId]/page.tsx` lines 162, 181
- `components/MovieForm.tsx` lines 325, 333, 341, 349, 357
- `app/test-upload/page.tsx` lines 34, 54

**Preview caveat:** these forms currently preview the uploaded file from the returned URL. Now
they hold a *key*. Have `/complete` return `{ key, previewUrl }` — a short signed GET purely for
the form preview — and submit only `key` to the API.

### 6.4 `src/lib/firebase.ts`

Keep the app init — `fcm.ts:17` depends on `firebaseApp`. Remove only the storage export:

```diff
-import { getStorage } from 'firebase/storage';
 export const firebaseApp = getApps().length ? getApp() : initializeApp(config);
-const storage = getStorage(firebaseApp);
-export default storage;
```

While here: move the hardcoded `storageBucket` and the committed `apiKey` fallback
([`firebase.ts:7-10`](nextream-admin/src/lib/firebase.ts:7)) into env vars.

### 6.5 `next.config.js` (both apps)

Add `storage.nextream.app` to `images.domains`. Keep `firebasestorage.googleapis.com` until the
backfill is done, then drop it.

**Exit criteria:** create a movie with poster + trailer + video end-to-end; edit an existing
Firebase-backed movie without its media breaking; TV show → season → episode with subtitles.

---

## 7. Phase 5 — Deletion & orphan cleanup

Today nothing ever deletes a blob.

1. **`movies.js:51`** — before `findByIdAndDelete`, collect `img/imgSm/imgTitle/trailer/video`,
   delete each that `isStorageKey()`. Legacy Firebase URLs: log to an orphan-report collection
   (the backend has no Firebase Storage credentials and shouldn't get them).
2. **`tv.js:393` / `tv.js:416`** — same for `stillPath`, `videoSources[].url`, `subtitles[].url`,
   `thumbnails[]`; cascade season → episodes.
3. **`scripts/reapOrphans.js`** — list all bucket keys, diff against every media field in Mongo,
   report (`--dry-run` default) then delete with `--commit`. Run monthly.

Delete blobs **after** the Mongo delete succeeds. Reversed, a failed DB delete leaves a live
document pointing at a destroyed object.

---

## 8. Phase 6 — Data migration

`onstream/api/scripts/migrateFirebaseToBucket.js`

```
for each collection/field in the media manifest:
  find docs where field matches ^https://firebasestorage\.googleapis\.com/
  stream download (URL token still valid) -> stream PUT to MinIO -> verify size via headObject
  update the doc field to the new key
  append to migration-log.jsonl  { collection, _id, field, oldUrl, newKey, bytes }
```

Rules:

- **Streaming, never buffered** — a 2 GB movie through `Buffer` will OOM the process.
- **Idempotent** — skip anything already a storage key; safe to re-run after a crash.
- **Concurrency ~3**, retry with backoff. This is bounded by your VPS's *inbound* bandwidth.
- **`--dry-run` first**, and `--collection=movies` to migrate in slices.
- **Do not delete from Firebase.** Keep the bucket for at least one billing cycle as rollback.

Order: `User.profilePic` (small) → images/posters → trailers → episode subtitles → videos (largest last).
Because of dual-read (§5), each field flips independently with no downtime and no coordinated cutover.

**Rollback:** `migration-log.jsonl` has `oldUrl` per record — a reverse script restores any slice.

---

## 9. Phase 7 — Client & mobile

Mostly verification, by design:

- **`nextream-client`** — no logic change. `movie.img`, `movie.video`, `movie.trailer`,
  `episode.videoSources[].url` still arrive as working URLs. Add the storage host to
  `next.config.js` image domains.
- **`nextream_mobile`** — no change. `movie.dart:46-50` maps the same JSON fields;
  `cached_network_image` and `video_player` both take URLs.
  ⚠️ `cached_network_image` keys its cache on the **full URL including the signature**, so a
  re-signed URL is a cache miss and re-downloads the image. Fix by using a stable
  `cacheKey` derived from the path minus query string.
- **Range requests** — verify `curl -r 0-1023` returns `206 Partial Content` with
  `Accept-Ranges: bytes`. Without it, seeking breaks and iOS Safari refuses to play at all.
  This is the single most common self-hosted-video failure.
- **Cache headers** — set `Cache-Control: public, max-age=31536000, immutable` on images at upload
  (keys are UUID-unique, so they're safe to cache forever).

---

## 10. Environment variables

**`onstream/api/.env`** (and Render dashboard):

```
STORAGE_DRIVER=s3
S3_ENDPOINT=https://storage.nextream.app
S3_REGION=us-east-1
S3_BUCKET=nextream-media
S3_ACCESS_KEY_ID=<scoped nextream-api user>
S3_SECRET_ACCESS_KEY=<...>
S3_FORCE_PATH_STYLE=true
MEDIA_URL_TTL_VIDEO=21600
MEDIA_URL_TTL_IMAGE=86400
MEDIA_MAX_UPLOAD_MB=4096
```

**`nextream-admin/.env.local`** — no storage secrets. The admin app only ever talks to your API.
Remove `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`; keep the FCM vars.

> **Unrelated but urgent:** [`deploy.sh:31`](deploy.sh:31) has the live Mongo Atlas password and
> `SECRET_KEY=zoom` committed in the repo. Rotate both and scrub the file — an attacker with that
> connection string doesn't need the storage layer at all.

---

## 11. Sequencing

| # | Phase | Depends on | Ships independently? |
|---|---|---|---|
| 0 | VPS + MinIO + nginx + CORS | — | yes (infra only) |
| 1 | `storage/` module | 0 | yes (dead code) |
| 2 | `routes/uploads.js` | 1 | yes (unused endpoint) |
| 3 | `mediaUrls` middleware | 1 | **yes — no-op until keys exist** |
| 4 | Admin uploaders | 2, 3 | yes — new uploads go to your bucket |
| 5 | Delete + orphan reaper | 1 | yes |
| 6 | Backfill script | 3, 4 | run in slices |
| 7 | Client/mobile verification | 6 | yes |

Phases 0–4 are the meaningful chunk and get **new** uploads onto your bucket before a single
legacy file moves. Phase 6 can then run at whatever pace your bandwidth allows.

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| **Signed URL expires mid-movie** | 6 h video TTL (§3.4). Test with a full-length title, seeking near the end. |
| **CORS missing → every upload fails** | §2.5, incl. `ExposeHeaders: ETag` for multipart. Verify preflight before Phase 4. |
| **No Range support → no seeking, no iOS** | `proxy_buffering off`; assert `206` in the smoke test. |
| **VPS is a single point of failure** | Firebase stays warm one billing cycle. Snapshot the disk. Beyond that: second node + `mc mirror`. |
| **Bandwidth saturation** | Monitor egress from day one; still serving single-bitrate MP4, so every viewer pulls full 1080p. |
| **Client-supplied keys** | Keys generated server-side only; write-side validation in §5. |
| **Backfill OOM / partial state** | Streaming copies, idempotent, `migration-log.jsonl`, slice by collection. |

---

## 13. Explicitly out of scope

Worth doing, deliberately not bundled here:

- **HLS transcoding.** You still serve one MP4 per title — a phone on mobile data pulls full 1080p.
  Once the storage box exists, an `ffmpeg` worker producing HLS renditions is the natural next
  project, and it's the single biggest bandwidth win available to you.
- DRM / packaging.
- Per-user entitlement on playback URLs (signature currently proves *a* valid session, not *which* user).
- Image derivative generation (thumbnails, WebP).
