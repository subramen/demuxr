import torch
from ts.torch_handler.base_handler import BaseHandler
from pathlib import Path
import uuid
import json
import shutil
from loguru import logger

# From https://github.com/facebookresearch/demucs/
from audio import AudioFile, encode_mp3
from utils import apply_model, load_model


class DemucsHandler(BaseHandler):

    def __init__(self):
        self.model = None
        self.initialized = False
        self.filedir = Path("filedir")
        self.filedir.mkdir(exist_ok=True)

    def initialize(self, ctx):
        """
        Initialize model. This will be called during model loading time
        :param context: Initial context contains model server system properties.
        :return:
        """
        self.manifest = ctx.manifest
        properties = ctx.system_properties
        model_dir = Path(properties.get("model_dir"))
        serialized_file = Path(self.manifest['model']['serializedFile'])
        model_sd_path = model_dir / serialized_file

        self.model = torch.jit.load(str(model_sd_path), map_location='cuda')
        self.model.eval()
        self.initialized = True
        logger.info("Model initialized!")


    # From https://github.com/facebookresearch/demucs/blob/dd7a77a0b2600d24168bbe7a40ef67f195586b62/demucs/separate.py#L199
    def preprocess(self, data, track_folder):
        """
        Transform raw input into model input data.
        track: audio file
        :return: tensor of normalized audio
        """
        inp = data[0]
        audio = inp.get('data') or inp.get('body')
        logger.info(f"Received audio of length: {len(audio)}")

        track_path = track_folder / 'input.mp3'
        with open(track_path, 'wb') as f:
            f.write(audio)

        wav = AudioFile(track_path).read(streams=0, samplerate=44100, channels=2)
        wav = (wav * 2**15).round() / 2**15
        ref = wav.mean(0)
        wav = (wav - ref.mean()) / ref.std()
        wav = wav.to(device='cuda')
        logger.info(f"Encoded audio to tensor of shape: {wav.size()}")
        return wav


    def inference(self, wav: torch.Tensor) -> torch.Tensor:
        if self.model is None:
            raise RuntimeError("Model not initialized")
        logger.info("Starting inference...")
        stem_tensor = apply_model(self.model, wav, split=True, progress=True)
        logger.info(f"Inference complete. Shape of sources: {stem_tensor.size()}")
        return stem_tensor


    # From https://github.com/facebookresearch/demucs/blob/dd7a77a0b2600d24168bbe7a40ef67f195586b62/demucs/separate.py#L207
    def postprocess(self, inference_output) -> Path:
        logger.info("Encoding stems...")
        out_msg = bytearray()
        for source in inference_output:
            source = (source * 2**15).clamp_(-2**15, 2**15 - 1).short()
            source = source.transpose(0,1).numpy()
            out_msg += encode_mp3(source)

        logger.info(f"Stems encoded to bytearray of length: {len(out_msg)}")
        return [out_msg]


    def handle(self, data, context):
        track_folder = self.filedir / str(uuid.uuid4())
        track_folder.mkdir(parents=True)
        wav = self.preprocess(data, track_folder)
        shutil.rmtree(track_folder)
        stems = self.inference(wav)
        return self.postprocess(stems)


