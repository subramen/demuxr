FROM ubuntu:latest

RUN apt-get update -y && apt-get install -y python3-pip python3-dev
ARG DEBIAN_FRONTEND=noninteractive
ENV TZ=America/New_York
RUN apt-get install -y ffmpeg

COPY requirements.txt /app/requirements.txt
WORKDIR /app
RUN pip3 install -r requirements.txt
COPY . /app

ENTRYPOINT [ "python3" ]
CMD ["app.py"]
