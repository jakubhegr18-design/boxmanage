# syntax=docker/dockerfile:1
ARG BUILD_FROM

# ---------- Stage 1: build web frontend ----------
FROM node:24-alpine AS build-web
WORKDIR /app
COPY web/package.json web/package-lock.json ./
COPY web/scripts ./scripts
RUN npm ci
COPY web/ ./
RUN npm run build

# ---------- Stage 2: runtime ----------
FROM $BUILD_FROM
ARG TARGETARCH
ARG CADDY_VERSION=2.9.1

RUN apk add --no-cache wget tar ca-certificates \
  && wget -q -O /tmp/caddy.tar.gz "https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_linux_${TARGETARCH}.tar.gz" \
  && tar -xzf /tmp/caddy.tar.gz -C /usr/bin caddy \
  && rm /tmp/caddy.tar.gz

WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

COPY server/src ./src
COPY --from=build-web /app/dist ./web/dist
COPY addon/Caddyfile ./Caddyfile
COPY addon/run.sh ./run.sh
RUN chmod +x /app/run.sh

ENV NODE_ENV=production \
    PORT=8091 \
    DATA_DIR=/data \
    WEB_DIR=/app/web/dist

EXPOSE 8090
CMD ["/app/run.sh"]
