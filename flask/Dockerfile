FROM python:slim-buster

ARG DEBIAN_FRONTEND=noninteractive
ENV TZ=America/New_York
RUN apt update

COPY requirements.txt /app/requirements.txt
WORKDIR /app
RUN pip3 install -r requirements.txt
COPY . /app

ENTRYPOINT [ "python3" ]
CMD ["app.py"]
