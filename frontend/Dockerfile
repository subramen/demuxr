FROM node:alpine as build
RUN mkdir /app
COPY . /app
WORKDIR /app

RUN apk add --no-cache ca-certificates
RUN npm install
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]


