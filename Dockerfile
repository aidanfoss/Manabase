# --- Frontend build ---
FROM node:20 AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# --- Backend build ---
FROM node:20
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/ .

# Copy built frontend into backend
COPY --from=frontend /app/frontend/dist /app/frontend/dist

# Create /data and symlink it to /app/db to prevent init errors
RUN mkdir -p /data && \
    mkdir -p /app/db && \
    ln -sf /data/manabase.db /app/db/manabase.db && \
    chmod -R 777 /data /app/db

ENV NODE_ENV=production
ENV PORT=9001
EXPOSE 9001

CMD ["node", "server.js"]
