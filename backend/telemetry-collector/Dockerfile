FROM node:22-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
ENV PORT=8787
EXPOSE 8787
CMD ["node", "dist/server.js"]