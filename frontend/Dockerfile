# ── Stage 1: Build ─────────────────────────────────────────────────────────────
# Use Node 20 LTS (alpine = minimal image size)
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer-cached unless package.json changes)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Vite bakes env vars at BUILD time — pass them as build args
ARG VITE_API_URL=http://localhost:5000
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_MEASUREMENT_ID

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_MEASUREMENT_ID=$VITE_FIREBASE_MEASUREMENT_ID

RUN npm run build

# ── Stage 2: Serve ─────────────────────────────────────────────────────────────
# nginx:alpine is ~25 MB — perfect for serving static React builds
FROM nginx:1.25-alpine AS production

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config with SPA routing and caching
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
