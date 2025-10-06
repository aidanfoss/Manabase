# ---- Build Frontend ----
FROM node:22-alpine AS build
WORKDIR /app
COPY frontend ./frontend
WORKDIR /app/frontend
RUN npm install && npm run build

# ---- Backend Runtime ----
FROM node:22-alpine
WORKDIR /app
COPY backend ./backend
COPY --from=build /app/frontend/dist ./frontend/dist
RUN npm install express cors
EXPOSE 8080
CMD ["node", "backend/server.js"]
