FROM oven/bun:1 AS base

WORKDIR /app

FROM base AS install

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS release

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3333

COPY --from=install --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun package.json bun.lock ./
COPY --chown=bun:bun src ./src
COPY --chown=bun:bun public ./public

USER bun

EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e 'fetch("http://127.0.0.1:3333/api/health").then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))'

ENTRYPOINT ["bun", "run", "start"]
