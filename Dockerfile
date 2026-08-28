# Build the Astro application.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Run the standalone Node output produced by @astrojs/node.
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

COPY --chown=node:node --from=build /app/dist ./dist

EXPOSE 4321

USER node

CMD ["node", "./dist/server/entry.mjs"]
