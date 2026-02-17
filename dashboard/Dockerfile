FROM node:22-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_OPEN_API_URL=http://localhost:8080
ARG NEXT_PUBLIC_LITE_API_URL=http://localhost:8081
ARG NEXT_PUBLIC_NETWORK_MODE=testnet
ARG NEXT_PUBLIC_ETHERSCAN_API_KEY=
ENV NEXT_PUBLIC_OPEN_API_URL=$NEXT_PUBLIC_OPEN_API_URL
ENV NEXT_PUBLIC_LITE_API_URL=$NEXT_PUBLIC_LITE_API_URL
ENV NEXT_PUBLIC_NETWORK_MODE=$NEXT_PUBLIC_NETWORK_MODE
ENV NEXT_PUBLIC_ETHERSCAN_API_KEY=$NEXT_PUBLIC_ETHERSCAN_API_KEY
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN adduser -D -u 1000 appuser && chown -R appuser /app
COPY --from=builder --chown=appuser /app/.next ./.next
COPY --from=builder --chown=appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser /app/package.json ./
USER appuser
EXPOSE 3000
CMD ["npm", "start"]
