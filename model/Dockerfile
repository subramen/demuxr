FROM pytorch/torchserve:0.3.0-cpu

RUN pip3 install --upgrade pip && \
    pip3 --no-cache-dir install --upgrade awscli 

USER root
RUN apt-get update -y && apt-get install -y ffmpeg

USER model-server
COPY . /home/model-server/
WORKDIR /home/model-server/

RUN aws s3 cp s3://demucs-app-modelstore/demucs_scripted.pt ./

RUN torch-model-archiver \
--model-name demucs \
--version 1 \
--handler handler.py \
--serialized-file demucs_scripted.pt \
--export-path ./model-store \
-r requirements.txt \
--extra-files audio.py,utils.py

CMD ["torchserve", \
"--start", \
"--ncs", \
"--ts-config=config.properties", \
"--model-store=model-store", \
"--models=demucs.mar"]
