FROM node:26 AS build
WORKDIR /app 
COPY ./frontend/package*.json .
RUN npm ci

COPY ./frontend/ .

RUN npm run build 


# for running the server 
FROM node:26-alpine AS server
WORKDIR /app

COPY ./backend/package*.json .

RUN npm ci --omit=dev


COPY ./backend .
COPY --from=build /app/dist /app/dist

CMD [ "node","./src/server.js"]



