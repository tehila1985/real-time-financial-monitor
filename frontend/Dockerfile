# See docs/DESIGN.md §18: Vite build served by nginx-unprivileged (non-root by
# default), reverse-proxying /api and /hubs to the backend (nginx.conf).

# ---- Build ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime ----
FROM nginxinc/nginx-unprivileged:alpine AS final
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
