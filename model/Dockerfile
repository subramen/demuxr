FROM pytorch/torchserve:0.3.0-cpu

RUN pip3 install --upgrade pip && \
    pip3 --no-cache-dir install --upgrade awscli 

USER root
RUN apt-get update -y && apt-get install -y ffmpeg
USER model-server

ARG AWS_DEFAULT_REGION
ARG AWS_ACCESS_KEY_ID
ARG AWS_SECRET_ACCESS_KEY

COPY . /home/model-server/
WORKDIR /home/model-server/

RUN aws s3 cp s3://demucs-app-modelstore/demucs_state_dict.pt ./

RUN torch-model-archiver \
--model-name demucs \
--version 1 \
--handler handler.py \
--serialized-file demucs_state_dict.pt \
--export-path ./model-store \
--model-file model.py \
-r requirements.txt \
--extra-files audio.py,utils.py,model.py

CMD ["torchserve", \
"--start", \
"--ncs", \
"--ts-config=config.properties", \
"--model-store=model-store", \
"--models=demucs.mar"]
