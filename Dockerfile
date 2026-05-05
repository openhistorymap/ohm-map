FROM node:22 AS build
WORKDIR /app
COPY package*.json /app/
RUN npm install
COPY . /app
ARG configuration=production
RUN npm run build -- --output-path=./dist/out --configuration $configuration


FROM nginx:alpine

WORKDIR /usr/share/nginx/html/

COPY --from=build /app/dist/out/browser/ .

RUN chmod 777 *

COPY --from=build /app/docker-entrypoint.sh .
RUN chmod +x ./docker-entrypoint.sh

COPY /nginx.conf /etc/nginx/conf.d/default.conf

ENTRYPOINT ["./docker-entrypoint.sh"]
