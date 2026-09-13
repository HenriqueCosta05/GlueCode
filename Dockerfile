# syntax=docker/dockerfile:1

ARG NODE_VERSION=22-alpine

# ---- deps: install once, reused by build and (via cache) never shipped ----
# --ignore-scripts: package.json's "prepare" script runs husky, which expects
# a .git directory that doesn't exist in the build context (and shouldn't).
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---- build: compile TypeScript to dist/ ----
FROM node:${NODE_VERSION} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runtime: production deps only + compiled output ----
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main"]
