FROM node:lts-alpine3.11 as build
RUN mkdir /app
COPY . /app
WORKDIR /app

RUN apk add --no-cache ca-certificates
RUN npm install --legacy-peer-deps
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]


