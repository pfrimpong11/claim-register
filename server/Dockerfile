# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# tooling: full server dependencies + Prisma CLI + generated client.
# Used for release operations (prisma migrate deploy, prisma db seed) and as
# the source of the generated Prisma client for the runtime image.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS tooling
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache openssl && addgroup -S app && adduser -S app -G app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci --workspace=server --include=dev && npm cache clean --force
COPY --chown=app:app server/prisma ./server/prisma
RUN npx prisma generate --schema=server/prisma/schema.prisma
RUN mkdir -p /app/server/uploads && chown -R app:app /app/server/uploads
USER app
# prisma db seed resolves `node prisma/seed.js` and the seed's upload directory
# relative to the working directory, so release commands run from server/.
WORKDIR /app/server
CMD ["npx", "prisma", "migrate", "deploy"]

# ---------------------------------------------------------------------------
# runtime: production dependencies only, plus the generated Prisma client.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache openssl && addgroup -S app && adduser -S app -G app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci --workspace=server --omit=dev && npm cache clean --force
COPY --from=tooling /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=app:app server/prisma ./server/prisma
COPY --chown=app:app server/src ./server/src
RUN mkdir -p /app/server/uploads && chown -R app:app /app/server/uploads
USER app
EXPOSE 4000
CMD ["node", "server/src/index.js"]
