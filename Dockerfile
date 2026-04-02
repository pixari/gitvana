FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts .
RUN mkdir -p /data
EXPOSE 3000
CMD ["bun", "run", "server.ts"]
