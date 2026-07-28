# Runs TypeScript directly via tsx rather than emitting to dist/.
#
# The API is a handful of modules with no bundling requirements, so a build step
# would add a stage and a source-map story for no benefit. Types are still fully
# enforced -- `npm run typecheck` runs tsc --noEmit in CI and locally.
#
# Debian slim (glibc) rather than Alpine (musl): the optional `local` embedding
# provider pulls in onnxruntime-node, whose prebuilt native binary is glibc-linked
# and fails to load on Alpine (missing ld-linux-x86-64.so.2). slim is a bit larger
# but is the reliable base for the ONNX runtime.

FROM node:24-slim

WORKDIR /app

# Dependencies first, so edits to src/ don't invalidate the install layer.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm install --no-save --no-audit --no-fund tsx@^4.20.3

COPY src ./src
COPY tsconfig.json ./
# The zero-config (blank .env) path serves Notion from these bundled fixtures at
# runtime; without them a keyless `docker compose up` boots to an empty dashboard.
COPY fixtures ./fixtures

ENV NODE_ENV=production
EXPOSE 8080

# Overridden per service in docker-compose.yml: `start` for the API, `worker`
# for the Notion poll loop.
CMD ["npm", "run", "start"]
