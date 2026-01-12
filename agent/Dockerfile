# ビルドステージ
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

# 実行用ステージ
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

# ★重要: CI/CDで生成された「dataディレクトリ（学習済みDB）」をコピーする
# 前提: `docker build` の前にホスト側で `npm run ingest` が実行されていること
COPY data ./data

USER node
ENTRYPOINT ["node", "dist/index.js"]
