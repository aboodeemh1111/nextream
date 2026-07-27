# Implementation prompt — paste into a new session

---

I'm migrating the Nextream streaming platform off Firebase Storage onto a self-hosted,
S3-compatible bucket (MinIO) that I own. A full implementation plan already exists in the repo.

**Read `STORAGE_MIGRATION.md` in the repo root first — it is the spec. Follow it.**

## Repo layout

Monorepo at `C:\Users\Abdalla\Documents\GitHub\nextream`:

- `onstream/api` — Express 4 + Mongoose 5.13 backend, deployed on Render. **This is where most of the work is.**
- `nextream-admin` — Next.js admin dashboard (Vercel). Contains all upload UI.
- `nextream-client` — Next.js viewer app (Vercel). Should need no logic changes.
- `nextream_mobile` — Flutter app. Should need no changes beyond a caching fix.

## Scope for this session

Implement **Phases 1–6** of the plan (all the code). Skip Phase 0 — I'm provisioning the VPS
myself; assume MinIO will exist at `https://storage.nextream.app`.

1. **Phase 1** — `onstream/api/storage/`: driver seam, `s3Driver.js`, `keys.js`, `sign.js`
2. **Phase 2** — `onstream/api/routes/uploads.js`: presign, multipart, complete, delete
3. **Phase 3** — `onstream/api/middleware/mediaUrls.js`: the `res.json` wrapper that signs keys on read
4. **Phase 4** — `nextream-admin`: `uploadClient.ts`, `useUpload.ts`, rewrite the 3 uploader components, update all 17 call sites
5. **Phase 5** — blob deletion in the delete routes + `scripts/reapOrphans.js`
6. **Phase 6** — write `scripts/migrateFirebaseToBucket.js` but **do not run it**

Work in that order. Phases 1–3 are independently shippable (dead code / no-ops until keys exist),
so commit at each phase boundary.

## Local dev setup — do this first so you can actually verify

Don't wait on my VPS. Stand up MinIO locally and test against it:

```yaml
# docker-compose.dev.yml at repo root
services:
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ["9000:9000", "9001:9001"]
    volumes: ["./.minio-data:/data"]
```

Point `S3_ENDPOINT=http://localhost:9000` in `onstream/api/.env.development`, create the
`nextream-media` bucket, set the CORS rule for `http://localhost:3001`, and prove the full
round-trip works before touching the admin app. Add `.minio-data/` to `.gitignore`.

## Non-negotiable constraints

These are the things that will silently break production if missed. The plan explains each:

1. **Signed URL TTL for video must be ≥6h.** A short TTL expires mid-movie — progressive MP4 keeps
   re-requesting byte ranges on the same URL for the whole session.
2. **Keys are generated server-side from a UUID.** Never accept a client-supplied path. The
   existing `storagePathBuilder` prop on `VideoUploader`/`SubtitleUploader` must be **deleted**,
   not adapted — it's an arbitrary-bucket-write hole. Callers pass `prefix` instead.
3. **Preserve pause/resume/cancel/ETA in `VideoUploader.tsx`.** It has that UX today on 2 GB files.
   A single presigned PUT can't resume, so use multipart. Requires `ExposeHeaders: ETag` in bucket CORS.
4. **Dual-read is mandatory.** Legacy `https://firebasestorage.googleapis.com/...` strings must pass
   through the middleware untouched so existing content keeps playing. There is no flag-day cutover.
5. **Don't break non-storage URLs.** `movies.js:129` and `:281` return Unsplash demo URLs; TMDB
   URLs appear elsewhere. The middleware must only transform values matching the storage-key pattern.
6. **Every upload route is behind `verify` + an explicit `req.user.isAdmin` check** — match the
   guard style already used at `routes/movies.js:10`.

## Do NOT touch

- **`firebase-admin` in the backend.** It's FCM-only (`onstream/api/firebase.js`,
  `routes/notifications.js`). Leave it entirely alone.
- **`firebaseApp` export in `nextream-admin/src/lib/firebase.ts`.** `src/lib/fcm.ts:17` imports it.
  Remove *only* the `getStorage` import and the default `storage` export.
- **`public/firebase-messaging-sw.js`** in both frontends.
- Anything in `nextream-client` beyond adding the storage host to `next.config.js` image domains.

## Environment / compatibility notes

- `onstream/api/package.json` declares `engines: node >=14`. Recent `@aws-sdk/client-s3` requires
  Node 18+. Check what Render is actually running and pin an SDK version that matches, or bump
  `engines` — flag it to me either way, don't guess silently.
- `nextream-admin/next.config.js` has `ignoreBuildErrors: true` and `ignoreDuringBuilds: true`.
  Type and lint errors will NOT fail the build, so run `npx tsc --noEmit` manually before
  claiming the admin work is done.
- The api package has no test framework. Use built-in `node:test` (zero new deps) for the
  `keys.js` / `sign.js` unit tests — don't introduce Jest.
- New env vars go in `onstream/api/.env` and `.env.development`. **Never commit real credentials.**
  Add placeholder values and tell me what to set in the Render dashboard.

## Verification before you call it done

- Unit tests: `buildKey` rejects `../`, absolute paths, and null bytes; `isStorageKey` and
  `isLegacyFirebaseUrl` discriminate correctly.
- Live round-trip against local MinIO: presign → PUT → `headObject` → signed GET.
- `curl -r 0-1023` on an uploaded video returns **`206 Partial Content`** with `Accept-Ranges: bytes`.
  This one is critical — without it, seeking breaks and iOS Safari refuses to play at all.
- Multipart: upload a >100 MB file, pause mid-way, resume, complete. Then upload another and cancel,
  and confirm the multipart upload is aborted rather than left dangling.
- Middleware: a Mongo doc with a legacy Firebase URL comes back **verbatim**; a doc with a storage
  key comes back as a signed URL. Both in the same response payload.
- Non-admin JWT gets 403 from every `/api/uploads/*` route.
- `npx tsc --noEmit` clean in `nextream-admin`.

## How I want you to work

- Read `STORAGE_MIGRATION.md` fully before writing code. Don't re-plan — implement what's there.
  If you disagree with something in the plan, say so before implementing it, not after.
- Match the existing code style: CommonJS `require` in the backend, the existing route/error-handling
  patterns, no TypeScript in `onstream/api`.
- Commit per phase with a clear message. Don't push.
- Tell me explicitly what's left, what you couldn't verify without the real VPS, and anything in
  the plan that turned out to be wrong once you were in the code.

One more thing, unrelated to storage but flagged during planning: `deploy.sh:31` has my live Mongo
Atlas password and `SECRET_KEY=zoom` committed in the repo. Don't fix it as part of this work —
just remind me at the end so I rotate them.
