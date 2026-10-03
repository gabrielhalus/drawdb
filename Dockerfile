# Stage 1: Build the app
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Stage 2: Run the Node server, which serves the built frontend, the diagram API
# backed by file storage, and the accounts guarding it.
#
# Node 24 is required: the account database runs on the built-in `node:sqlite`
# module, which is what keeps this image free of any native build step.
FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server

# Runtime configuration for the optional hosted backend, served at /config.js
# exactly as the previous nginx image did.
COPY <<'ENTRYPOINT' /app/entrypoint.sh
#!/bin/sh
set -e
cat > /app/dist/config.js <<CONFIG
window.__DRAWDB_CONFIG__ = { backendUrl: "${VITE_BACKEND_URL}", gistBackendUrl: "${VITE_GIST_BACKEND_URL}" };
CONFIG
exec node server/index.js
ENTRYPOINT
RUN chmod +x /app/entrypoint.sh

ENV VITE_BACKEND_URL="" \
    VITE_GIST_BACKEND_URL="" \
    PORT=3000 \
    DIAGRAM_STORE_PATH=/data/diagrams \
    AUTH_DB_PATH=/data/auth.db

EXPOSE 3000
CMD ["/app/entrypoint.sh"]
