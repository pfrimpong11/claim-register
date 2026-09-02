FROM node:22-alpine AS dependencies
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci

FROM dependencies AS build
COPY client client
RUN npm run build --prefix client

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /workspace/client/.next/standalone ./
COPY --from=build --chown=app:app /workspace/client/.next/static ./client/.next/static
COPY --from=build --chown=app:app /workspace/client/public ./client/public
USER app
EXPOSE 3000
CMD ["node", "client/server.js"]
