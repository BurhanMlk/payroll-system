# Base image for the API server
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# ---- Dependencies ---------------------------------------------------------
FROM base AS deps
COPY server/package.json server/package-lock.json* ./
RUN npm install --legacy-peer-deps

# ---- Prisma generate ------------------------------------------------------
FROM deps AS prisma
COPY server/prisma ./prisma
RUN npx prisma generate

# ---- Build -----------------------------------------------------------------
FROM prisma AS build
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

# ---- Runtime ----------------------------------------------------------------
FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY server/package.json ./
COPY server/prisma ./prisma

EXPOSE 4000
CMD ["node", "dist/server.js"]
