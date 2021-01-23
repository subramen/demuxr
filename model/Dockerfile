FROM pytorch/torchserve:0.3.0-cpu
COPY . /home/model-server/
WORKDIR /home/model-server/

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