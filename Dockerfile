# Stage 1: Build the app
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Stage 2: Run the Node server, which serves the built frontend and the
# diagram API backed by file storage.
FROM node:20-alpine AS production
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
    DIAGRAM_STORE_PATH=/data/diagrams

EXPOSE 3000
CMD ["/app/entrypoint.sh"]
