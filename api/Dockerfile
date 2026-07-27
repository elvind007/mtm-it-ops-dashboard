# Runs TypeScript directly via tsx rather than emitting to dist/.
#
# The API is a handful of modules with no bundling requirements, so a build step
# would add a stage and a source-map story for no benefit. Types are still fully
# enforced -- `npm run typecheck` runs tsc --noEmit in CI and locally.

FROM node:24-alpine

WORKDIR /app

# Dependencies first, so edits to src/ don't invalidate the install layer.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm install --no-save --no-audit --no-fund tsx@^4.20.3

COPY src ./src
COPY tsconfig.json ./

ENV NODE_ENV=production
EXPOSE 8080

# Overridden per service in docker-compose.yml: `start` for the API, `worker`
# for the Notion poll loop.
CMD ["npm", "run", "start"]
