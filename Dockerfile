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

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
RUN addgroup -S homeboard && adduser -S homeboard -G homeboard
COPY --from=build --chown=homeboard:homeboard /app/public ./public
COPY --from=build --chown=homeboard:homeboard /app/.next/standalone ./
COPY --from=build --chown=homeboard:homeboard /app/.next/static ./.next/static
COPY --from=build --chown=homeboard:homeboard /app/db ./db
COPY --from=build --chown=homeboard:homeboard /app/scripts ./scripts
COPY --from=build --chown=homeboard:homeboard /app/src ./src
COPY --from=build --chown=homeboard:homeboard /app/tsconfig.json ./tsconfig.json
COPY --from=build --chown=homeboard:homeboard /app/node_modules ./node_modules
USER homeboard
EXPOSE 3000
CMD ["node", "server.js"]
