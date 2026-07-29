# syntax=docker/dockerfile:1

# Node 20 LTS: package.json asks for >=18, and mongoose is pinned to 5.13, which
# predates (and is not tested against) the newer majors.
ARG NODE_VERSION=20-alpine

# --- deps -------------------------------------------------------------------
# Split out so the install layer is reused on every build where dependencies
# have not changed, which is most of them.
FROM node:${NODE_VERSION} AS deps

WORKDIR /app

COPY package.json package-lock.json ./
# There is no devDependencies block in package.json (nodemon lives in
# dependencies), so --omit=dev drops nothing today. It is here so the image
# stays lean if dev-only packages are ever moved where they belong.
RUN npm ci --omit=dev && npm cache clean --force

# --- runner -----------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner

# Node installs no SIGTERM handler, and the kernel does not apply default signal
# dispositions to PID 1 — so without an init, `docker stop` waits out the full
# grace period and then SIGKILLs. dumb-init forwards signals to node instead.
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production \
    PORT=8800

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .

# index.js mkdirs public/ and public/images/ at boot; pre-creating them owned by
# `node` keeps that from throwing EACCES once we drop root.
RUN mkdir -p public/images && chown -R node:node public

USER node

EXPOSE 8800

# `/` is the API's own status route. It answers 200 as soon as express is
# listening and does not wait on mongo, so this is a liveness check, not a
# readiness one — a container can be healthy while the DB connection is still
# retrying (see index.js, which logs mongo failures rather than exiting).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "require('http').get({host:'127.0.0.1',port:process.env.PORT||8800,path:'/'},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
