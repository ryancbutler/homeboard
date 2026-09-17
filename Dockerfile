FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
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
