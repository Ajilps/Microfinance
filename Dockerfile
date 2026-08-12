FROM node:26 AS build
WORKDIR /app
COPY ./Frontend/package*.json .
RUN npm ci

COPY ./Frontend/ .

RUN npm run build


# for running the server
FROM node:26-alpine AS server
WORKDIR /app

COPY ./Backend/package*.json .

RUN npm ci --omit=dev


COPY ./Backend .
COPY --from=build /app/dist /app/dist

CMD [ "node","./src/server.js"]
