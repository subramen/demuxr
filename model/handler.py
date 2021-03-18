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
import shutil

logger = logging.getLogger(__name__)


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
    def preprocess(self, data, track_folder):
        """
        Transform raw input into model input data.
        track: audio file
        :return: tensor of normalized audio
        """
        inp = data[0]
        audio = inp.get('data') or inp.get('body')

        print(f"[SURAJ] len(audio): {len(audio)}")
        print(f"[SURAJ]  {audio[:100]}")

        track_path = track_folder / 'input.mp3'
        with open(track_path, 'wb') as f:
            print(f"[SURAJ] saving to track_path: {track_path}")
            f.write(audio)

        wav = AudioFile(track_path).read(streams=0, samplerate=44100, channels=2)
        # Round to nearest short integer for compatibility with how MusDB load audio with stempeg.
        wav = (wav * 2**15).round() / 2**15
        ref = wav.mean(0)
        wav = (wav - ref.mean()) / ref.std()
        print(f"[SURAJ] Audio track preprocessed. Shape of tensor: {wav.size()}")
        return wav


    def inference(self, wav: torch.Tensor) -> torch.Tensor:
        if self.model is None:
            raise RuntimeError("Model not initialized")
        print("[SURAJ] Running Inference")
        stem_tensor = apply_model(self.model, wav, split=True, progress=True)
        print(f"[SURAJ] Inference complete. Shape of sources: {stem_tensor.size()}")
        return stem_tensor


    # From https://github.com/facebookresearch/demucs/blob/dd7a77a0b2600d24168bbe7a40ef67f195586b62/demucs/separate.py#L207
    def postprocess(self, inference_output) -> Path:
        print("[SURAJ] starting postprocess")

        out_msg = bytearray()
        source_names = ["drums", "bass", "other", "vocals"]
        for source, _ in zip(inference_output, source_names):
            source = (source * 2**15).clamp_(-2**15, 2**15 - 1).short()
            source = source.transpose(0,1).numpy()
            out_msg += encode_mp3(source)

        print(f"[SURAJ] Bytearray length: {len(out_msg)}")
        return [out_msg]

    def handle(self, data, context):
        track_folder = self.filedir / str(uuid.uuid4())
        track_folder.mkdir(parents=True)
        wav = self.preprocess(data, track_folder)
        shutil.rmtree(track_folder)
        stems = self.inference(wav)
        return self.postprocess(stems)


