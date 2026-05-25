# Baladi Next.js web dashboard — build from repo root:
#   docker build -f web-dashboard/Dockerfile -t baladi-web .
FROM node:20-alpine AS deps
WORKDIR /app/web-dashboard
COPY web-dashboard/package.json web-dashboard/package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=https://api.lb-baladiyati.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY shared ./shared
COPY web-dashboard ./web-dashboard
COPY --from=deps /app/web-dashboard/node_modules ./web-dashboard/node_modules
WORKDIR /app/web-dashboard
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app/web-dashboard
ENV NODE_ENV=production
COPY --from=build /app/web-dashboard/.next ./.next
COPY --from=build /app/web-dashboard/node_modules ./node_modules
COPY --from=build /app/web-dashboard/package.json ./package.json
COPY --from=build /app/web-dashboard/public ./public
EXPOSE 3001
CMD ["npm", "run", "start"]
