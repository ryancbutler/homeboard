ARG NODE_VERSION=24.21.0

FROM node:${NODE_VERSION}-alpine AS base
RUN npm install --global npm@12.0.2 && npm --version

FROM base AS dependencies
WORKDIR /app
COPY package.json package-lock.json* .npmrc ./
RUN npm ci

FROM base AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM build AS tools-build
RUN npm run build:tools

FROM base AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json* .npmrc ./
RUN npm ci --omit=dev && npm cache clean --force

FROM base AS runtime-web
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
RUN addgroup -S homeboard && adduser -S homeboard -G homeboard
RUN mkdir /data && chown homeboard:homeboard /data
COPY --from=build --chown=homeboard:homeboard /app/public ./public
COPY --from=build --chown=homeboard:homeboard /app/.next/standalone ./
COPY --from=build --chown=homeboard:homeboard /app/.next/static ./.next/static
USER homeboard
EXPOSE 3000
CMD ["node", "server.js"]

FROM base AS runtime-tools
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S homeboard && adduser -S homeboard -G homeboard
RUN mkdir /data && chown homeboard:homeboard /data
COPY --from=production-dependencies --chown=homeboard:homeboard /app/node_modules ./node_modules
COPY --from=tools-build --chown=homeboard:homeboard /app/dist ./dist
COPY --from=build --chown=homeboard:homeboard /app/db ./db
USER homeboard
CMD ["node", "dist/src/worker.js"]
