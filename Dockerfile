FROM node:24-bookworm-slim AS build
WORKDIR /repo
RUN apt-get update && apt-get install -y openssl python3 && rm -rf /var/lib/apt/lists/*
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install
COPY . .
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build:web
RUN npm run build:api

FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update \
  && apt-get install -y openssl ffmpeg python3 pipx \
  && pipx install yt-dlp \
  && rm -rf /var/lib/apt/lists/*
ENV PATH="/root/.local/bin:${PATH}"
COPY --from=build /repo/package.json /repo/package-lock.json ./
COPY --from=build /repo/apps/api/package.json apps/api/package.json
COPY --from=build /repo/apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/generated apps/api/generated
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY --from=build /repo/apps/web/dist apps/web/dist

EXPOSE 3000
WORKDIR /app/apps/api
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
