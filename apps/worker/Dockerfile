FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/pipeline/package.json packages/pipeline/package.json
COPY packages/llm/package.json packages/llm/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/video/package.json packages/video/package.json
COPY packages/sources/package.json packages/sources/package.json
RUN npm ci
COPY . .
USER node
CMD ["npm", "run", "worker:once"]
