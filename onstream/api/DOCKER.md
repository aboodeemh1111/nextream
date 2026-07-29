# Running the API in Docker

The API image is built from [`Dockerfile`](Dockerfile) in this directory. Two
compose stacks use it:

| File | Project | What it runs |
| --- | --- | --- |
| [`docker-compose.dev.yml`](../../docker-compose.dev.yml) | `nextream` | API (hot reload) + MinIO + bucket init, optional local MongoDB |
| [`docker-compose.yml`](../../docker-compose.yml) | `nextream-prod` | API only, production settings, no bind mount |

Both live at the repo root, so run every command below from there.

## Local development

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

That is the whole setup. It reuses the credentials already in
`onstream/api/.env` and `onstream/api/.env.development`, creates the
`nextream-media` bucket if it does not exist, and serves the API on
**http://localhost:8800** — the same address the frontends already expect, so
`npm run client` and `npm run admin` need no changes.

Port 8800 has to be free: stop a host-side `npm run backend` first, or the
container will fail to bind.

```bash
docker compose -f docker-compose.dev.yml logs -f api    # follow logs
docker compose -f docker-compose.dev.yml restart api     # restart
docker compose -f docker-compose.dev.yml down            # stop (keeps bucket data)
```

`onstream/api` is bind-mounted and run under `nodemon -L`, so saving a file on
the host restarts the server inside the container. Rebuild only when
dependencies change:

```bash
docker compose -f docker-compose.dev.yml up -d --build api
```

### Running the scripts

Anything in `package.json` works inside the container, against the same
configuration the server uses:

```bash
docker compose -f docker-compose.dev.yml exec api npm test
docker compose -f docker-compose.dev.yml exec api npm run storage:smoke
docker compose -f docker-compose.dev.yml exec api npm run notify:sync-indexes
docker compose -f docker-compose.dev.yml exec api npm run seed
```

### Working without the Atlas cluster

```bash
docker compose -f docker-compose.dev.yml --profile local-db up -d
```

Then point the API at the sidecar by adding to the `api` service's
`environment:` block in `docker-compose.dev.yml`:

```yaml
      MONGO_URL: mongodb://mongo:27017
```

`index.js` hardcodes `dbName: 'streamo'`, so the URI needs no database path. The
database starts empty — `npm run seed` and `npm run seed-content` fill it.

## Production-shaped run

```bash
cp onstream/api/.env.docker.example onstream/api/.env.docker   # then fill it in
docker compose up -d --build
```

No bind mount, no nodemon, `NODE_ENV=production`, published on `127.0.0.1:8800`
so a reverse proxy can terminate TLS in front of it. Or without compose:

```bash
docker build -t nextream-api ./onstream/api
docker run -d --name nextream-api -p 8800:8800 --env-file onstream/api/.env.docker nextream-api
```

The image runs as the unprivileged `node` user, holds no configuration of its
own, and writes nothing to disk at runtime (uploads go straight to the bucket
through presigned URLs), so it needs no volumes.

### Deploying it

Any host that takes a Dockerfile works — Render, Fly.io, Railway, a plain VPS.
Point the build at `onstream/api` as the root/context. The two things to get
right are the environment (see `.env.docker.example`) and, on platforms that
assign the port, letting `PORT` come from them; `index.js` already reads it.

## The bits that are easy to get wrong

**Two storage endpoints, not one.** `S3_ENDPOINT` is where the API reaches the
bucket; `S3_PUBLIC_ENDPOINT` is where the *browser* reaches it. In the dev stack
those differ (`http://minio:9000` vs `http://localhost:9000`) because inside a
container `localhost` is the container. Presigned URLs are signed over the Host
header, so if only `S3_ENDPOINT` were set, every image and video URL the API
handed out would 403 on arrival. Set both whenever the API and the browser see
the bucket at different addresses.

**Quoting in env files differs by tool.** Compose's `env_file:` parser trims
whitespace around `=`, strips surrounding double quotes, and expands `\n` inside
them. `docker run --env-file` does none of that. Keep `FIREBASE_PRIVATE_KEY`
unquoted and write `KEY=value` with no spaces, and both parsers agree.

**Health is liveness, not readiness.** The image's `HEALTHCHECK` probes `GET /`,
which answers 200 as soon as express is listening. `index.js` logs Mongo
connection failures instead of exiting, so a container can report healthy while
the database is unreachable. Check the logs for `DB Connection Successful`.

**`dumb-init` is not decoration.** Node installs no SIGTERM handler and the
kernel skips default signal dispositions for PID 1, so `node index.js` as PID 1
ignores `docker stop` outright: measured on this image, 0.4s to stop with the
init, versus the full grace period and then SIGKILL without it.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `bind: Only one usage of each socket address` | Host `npm run backend` still on 8800, or a stale container: `docker compose -f docker-compose.dev.yml down` |
| Images and video 403 from the bucket | `S3_PUBLIC_ENDPOINT` missing or wrong — see above |
| `NoSuchBucket` | `minio-init` did not run; `docker compose -f docker-compose.dev.yml up minio-init` |
| Push sends fail, `DECODER routines::unsupported` | `FIREBASE_PRIVATE_KEY` still wrapped in double quotes |
| `variable 'SECRET_KEY ' contains whitespaces` | `docker run --env-file` on a file with spaces around `=` |
| Edits on the host do not restart the server | Editing outside `onstream/api`, which is the only mounted path |
| `MODULE_NOT_FOUND` after adding a dependency | Rebuild: `up -d --build api`. The image's `node_modules` is deliberately shielded from the host's by an anonymous volume |
