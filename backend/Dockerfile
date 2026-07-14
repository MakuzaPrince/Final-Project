# ── Production image ────────────────────────────────────────────────────────────
FROM node:20-alpine

# Install dumb-init for proper signal handling (graceful shutdowns)
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy manifests first so dependency layer is cached unless they change
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Don't run as root — create a dedicated user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 5000

# dumb-init wraps the process so Node.js receives OS signals correctly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
