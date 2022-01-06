FROM pytorch/torchserve:latest-gpu

USER root
RUN pip3 install --upgrade pip
RUN pip3 install --upgrade awscli 
RUN apt-get update -y && apt-get install -y ffmpeg
USER model-server

COPY . /home/model-server/
WORKDIR /home/model-server/

RUN aws s3 cp s3://demucs-app-modelstore/demucs-e07c671f.th ./

RUN torch-model-archiver \
--model-name demucs_quantized \
--version 1 \
--handler handler.py \
--serialized-file demucs-e07c671f.th \
--export-path ./model-store \
-r requirements.txt \
--extra-files utils.py,model.py

CMD ["torchserve", \
"--start", \
"--ncs", \
"--ts-config=config.properties", \
"--model-store=model-store", \
"--models=demucs_quantized.mar"]
