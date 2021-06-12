import torch
from ts.torch_handler.base_handler import BaseHandler
from pathlib import Path
import uuid
import json
import shutil
from loguru import logger

# From https://github.com/facebookresearch/demucs/
from .audio import AudioFile, convert_audio_channels
from .separate import load_track, encode_mp3
from .utils import apply_model


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
    def preprocess(self, data, tmp_folder):
        """
        Transform raw input into model input data.
        track: audio file
        :return: tensor of normalized audio
        """
        inp = data[0]
        audio = inp.get('data') or inp.get('body')
        logger.info(f"Received audio of length: {len(audio)}")

        track_path = tmp_folder / 'input.mp3'
        with open(track_path, 'wb') as f:
            f.write(audio)

        wav = load_track(track_path, device='cuda', audio_channels=2, samplerate=44100)
        ref = wav.mean(0)
        wav = (wav - ref.mean()) / ref.std()
        logger.info(f"Encoded audio to tensor of shape: {wav.size()}")
        return wav, ref


    def inference(self, wav: torch.Tensor, ref: torch.Tensor) -> torch.Tensor:
        if self.model is None:
            raise RuntimeError("Model not initialized")
        stem_tensor = apply_model(self.model, wav, split=False)
        stem_tensor = stem_tensor * ref.std() + ref.mean()
        logger.info(f"Inference complete. Shape of sources: {stem_tensor.size()}")
        return stem_tensor


    # From https://github.com/facebookresearch/demucs/blob/dd7a77a0b2600d24168bbe7a40ef67f195586b62/demucs/separate.py#L207
    def postprocess(self, inference_output) -> Path:
        logger.info("Encoding stems...")
        out_msg = bytearray()
        for source in inference_output:
            source = source / max(1.01 * source.abs().max(), 1)
            source = (source * 2**15).clamp_(-2**15, 2**15 - 1).short()
            source = source.cpu()
            out_msg += encode_mp3(source, path=None, bitrate=128)
        torch.cuda.empty_cache()
        logger.info(f"Stems encoded to bytearray of length: {len(out_msg)}")
        return [out_msg]


    def handle(self, data, context):
        tmp_folder = self.filedir / str(uuid.uuid4())
        tmp_folder.mkdir(parents=True)
        
        wav, ref = self.preprocess(data, tmp_folder)
        shutil.rmtree(tmp_folder)
        
        stems = self.inference(wav, ref)
        
        out = self.postprocess(stems)
        
        return out


