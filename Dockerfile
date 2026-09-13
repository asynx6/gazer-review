FROM node:20-alpine

LABEL org.opencontainers.image.title="Gazer" \
      org.opencontainers.image.description="AI code review bot untuk GitHub, komentar PR baris-per-baris dalam Bahasa Indonesia" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/asynx6/gazer-review"

WORKDIR /app
COPY index.js package.json ./
COPY src ./src

ENV NODE_ENV=production \
    WEBHOOK_PORT=80 \
    LLM_TIMEOUT_MS=90000

EXPOSE 80
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://127.0.0.1/healthz | grep -q '"ok":true'

CMD ["node", "index.js", "serve"]
