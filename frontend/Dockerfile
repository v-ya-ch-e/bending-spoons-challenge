FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder

WORKDIR /app

ARG DB_API_BASE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1 \
    DB_API_BASE_URL=${DB_API_BASE_URL}

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ARG DB_API_BASE_URL

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DB_API_BASE_URL=${DB_API_BASE_URL}

COPY package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0"]
