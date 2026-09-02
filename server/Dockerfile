FROM node:22-alpine AS dependencies
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=dependencies /workspace/node_modules ./node_modules
COPY --chown=app:app server/package.json ./server/package.json
COPY --chown=app:app server/src ./server/src
RUN mkdir -p /app/server/uploads && chown -R app:app /app/server/uploads
USER app
EXPOSE 4000
CMD ["node", "server/src/index.js"]
