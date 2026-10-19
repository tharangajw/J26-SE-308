FROM node:22-alpine

WORKDIR /app

COPY src ./src

ENV PORT=3010
EXPOSE 3010

CMD ["node", "--experimental-strip-types", "src/server.ts"]
