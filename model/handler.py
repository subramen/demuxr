import torch
import torchaudio as ta
from ts.torch_handler.base_handler import BaseHandler
from pathlib import Path
import uuid
from loguru import logger
from diffq import DiffQuantizer
import io
import json
import boto3

# From https://github.com/facebookresearch/demucs/
from utils import apply_model, set_state
from model import Demucs


class DemucsHandler(BaseHandler):
    def __init__(self):
        self.model = None
        self.filedir = Path("filedir")
        self.filedir.mkdir(exist_ok=True)
        self.s3_client = boto3.client('s3')
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

    def initialize(self, ctx):
        """
        Initialize model. This will be called during model loading time
        :param context: Initial context contains model server system properties.
        :return:
        """
        self.manifest = ctx.manifest
        properties = ctx.system_properties
        model_weights_path = Path(properties.get("model_dir")) / Path(self.manifest['model']['serializedFile'])
        
        state = torch.load(model_weights_path)
        self.model = Demucs([1,1,1,1]).to(self.device)
        quantizer = DiffQuantizer(self.model, group_size=8, min_size=1)
        set_state(self.model, quantizer, state)
        quantizer.detach() 
        self.model.eval()
        logger.info("loaded model")
    

    def preprocess(self, inp):
        """
        Transform raw input into model input data.
        track: audio file
        :return: tensor of normalized audio
        """
        if isinstance(inp, (bytes, bytearray)):
            audio_obj = io.BytesIO(inp)
        elif isinstance(inp, dict):
            audio_obj = self.s3_client.get_object(Bucket=inp['Bucket'], Key=inp['Key'])['Body']
        else:
            raise RuntimeError(f"Expected input of type bytes or dict, received {type(inp)}")
        
        wav, _ = ta.load(audio_obj, format='mp3')
        wav = wav.to(self.device)
        ref = wav.mean(0)
        wav = (wav - ref.mean()) / ref.std()
        return wav, ref


    def inference(self, wav, ref):
        if self.model is None:
            raise RuntimeError("Model not initialized")
        stem_tensor = apply_model(self.model, wav, 8)
        stem_tensor = stem_tensor * ref.std() + ref.mean()
        return stem_tensor

   
    # From https://github.com/facebookresearch/demucs/blob/dd7a77a0b2600d24168bbe7a40ef67f195586b62/demucs/separate.py#L207
    def postprocess(self, inference_output) -> Path:
        logger.info("Encoding stems...")
        out_msg = bytearray()
        for source in inference_output:
            source = source / max(1.01 * source.abs().max(), 1)  # source.max(dim=1).values.max(dim=-1)
            source = (source * 2**15).clamp_(-2**15, 2**15 - 1).short()
            source = source.cpu()
            mp3_buf = io.BytesIO()
            ta.save(mp3_buf, source, 44100, compression=128.3, format='mp3')
            out_msg += mp3_buf.getvalue()
        logger.info(f"Stems encoded to bytearray of length: {len(out_msg)}")
        return [out_msg]


    def handle(self, data, context):
        inp = data[0].get('data') or data[0].get('body') 
        wav, ref = self.preprocess(inp)
        stems = self.inference(wav, ref)
        out = self.postprocess(stems)        
        return out
