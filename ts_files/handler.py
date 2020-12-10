import logging
from pathlib import Path
import uuid
import json

# From https://github.com/facebookresearch/demucs/
from audio import AudioFile, encode_mp3
from utils import apply_model, load_model
from model import Demucs

import torch
from ts.torch_handler.base_handler import BaseHandler

logger = logging.getLogger(__name__)


class DemucsHandler(BaseHandler):

    def __init__(self):
        self.model = None
        self.initialized = False
        self.tempdir = Path("tmp")
        self.tempdir.mkdir(exist_ok=True)


    def initialize(self, ctx):
        """
        Initialize model. This will be called during model loading time
        :param context: Initial context contains model server system properties.
        :return:
        """
        self.manifest = ctx.manifest
        properties = ctx.system_properties
        model_dir = Path(properties.get("model_dir"))
        model_name = properties.get("model_name")
        serialized_file = Path(self.manifest['model']['serializedFile'])
        model_sd_path = model_dir / serialized_file

        kwargs = {'audio_channels': 2,\
         'channels': 100, \
         'context': 3, \
         'depth': 6, \
         'glu': True, \
         'growth': 2.0, \
         'kernel_size': 8, \
         'lstm_layers': 2, \
         'rescale': 0.1, \
         'rewrite': True, \
         'sources': 4, \
         'stride': 4, \
         'upsample': False}

        self.model = Demucs(**kwargs)
        self.model.load_state_dict(torch.load(model_sd_path, 'cpu'))
        self.model.eval()

        self.initialized = True
        print("[SURAJ] Model initialized!")

    # From https://github.com/facebookresearch/demucs/blob/dd7a77a0b2600d24168bbe7a40ef67f195586b62/demucs/separate.py#L199
    def preprocess(self, data):
        """
        Transform raw input into model input data.
        track: audio file
        :return: tensor of normalized audio
        """
        inp = data[0]
        audio = inp.get('file')
        track_id = inp.get('id').decode()

        print(f"[SURAJ] ID: {track_id}, file[:10]: {audio[:10]}")
        print(f"[SURAJ] audio[:10]: {audio[:10]}")
        print(f"[SURAJ] audio[10:]: {audio[10:]}")
        print(f"[SURAJ] len(audio): {len(audio)}")

        track_path = self.tempdir / (track_id + '.mp3')
        with open(track_path, 'wb') as f:
            print(f"[SURAJ] saving to track_path: {track_path}")
            f.write(audio)

        wav = AudioFile(track_path).read(streams=0, samplerate=44100, channels=2)
        # Round to nearest short integer for compatibility with how MusDB load audio with stempeg.
        wav = (wav * 2**15).round() / 2**15
        ref = wav.mean(0)
        wav = (wav - ref.mean()) / ref.std()
        print(f"[SURAJ] Audio track preprocessed. Shape of tensor: {wav.size()}")
        return track_id, wav


    def inference(self, wav: torch.Tensor) -> torch.Tensor:
        if self.model is None:
            raise RuntimeError("Model not initialized")
        print("[SURAJ] Running Inference")
        stem_tensor = apply_model(self.model, wav, split=True, progress=True)
        print(f"[SURAJ] Inference complete. Shape of sources: {stem_tensor.size()}")
        return stem_tensor


    # From https://github.com/facebookresearch/demucs/blob/dd7a77a0b2600d24168bbe7a40ef67f195586b62/demucs/separate.py#L207
    def postprocess(self, inference_output: torch.Tensor, track_id:str) -> Path:
        print("[SURAJ] starting postprocess")
        track_folder = self.tempdir / Path("separated") / track_id
        track_folder.mkdir(parents=True, exist_ok=True)

        out_msg = bytearray()
        source_names = ["drums", "bass", "other", "vocals"]
        for source, name in zip(inference_output, source_names):
            source = (source * 2**15).clamp_(-2**15, 2**15 - 1).short()
            source = source.transpose(0,1).numpy()
            out_msg += encode_mp3(source, str(track_folder / name) + ".mp3")

        print(f"[SURAJ] Bytearray length: {len(out_msg)}")
        return [out_msg]

    def handle(self, data, context):
        track_id, wav = self.preprocess(data)
        stems = self.inference(wav)
        return self.postprocess(stems, track_id)






# option 1: save to disk, return path
# option 2: return multiple bytearrays instead of only 1 per example
    # isinstance(val, tuple):
        # loop
