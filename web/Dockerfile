# Build from the repository root: docker build -f web/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@10.34.3
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/tokens/package.json packages/tokens/package.json
COPY web/package.json web/package.json
RUN pnpm install --frozen-lockfile --prod=false
COPY packages/tokens packages/tokens
COPY web web
# Only public configuration belongs in VITE_* variables. Same-origin by default.
ARG VITE_BACKEND_URL=""
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
RUN pnpm build

FROM caddy:2.10.2-alpine
ENV PORT=8080
COPY web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/web/build /srv
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
