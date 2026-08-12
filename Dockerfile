FROM node:26 AS frontend-build
WORKDIR /frontend

COPY ./Frontend/package*.json ./
RUN npm ci

COPY ./Frontend/ ./
RUN npm run build

# Run the Express backend and serve the compiled React application from /app/dist.
FROM node:26-alpine AS app
WORKDIR /app

COPY ./Backend/package*.json ./
RUN npm ci --omit=dev

COPY ./Backend/ ./
COPY --from=frontend-build /frontend/dist ./dist

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "./src/server.js"]
