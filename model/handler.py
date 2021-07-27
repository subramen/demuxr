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
import time

# From https://github.com/facebookresearch/demucs/
from model import Demucs
from utils import load_model, apply_model

def hacky_read_ogg(s3, inp):
    """torchaudio has a bug where it cannot read an ogg file-like object, so we write it to disk and delete after reading"""
    import uuid, os
    tmp = str(uuid.uuid1())
    s3.download_file(inp['Bucket'], inp['Key'], tmp)
    wav, _ = ta.load(tmp, format='ogg')
    assert wav.size(-1) > 0
    os.remove(tmp)
    return wav

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
        model = Demucs([1,1,1,1]).to(self.device)
        self.model = load_model(model, model_weights_path, True)
        

    def preprocess(self, inp):
        """
        Transform raw input into model input data.
        track: audio file
        :return: tensor of normalized audio
        """
        s3_folder = None
        if isinstance(inp, (bytes, bytearray)):  # deprecated
            audio_obj = io.BytesIO(inp)
        elif isinstance(inp, dict):
            logger.info(f"Downloading input audio from {inp}")
            # audio_obj = self.s3_client.get_object(Bucket=inp['Bucket'], Key=inp['Key'])['Body']
            wav = hacky_read_ogg(self.s3_client, inp)
            s3_folder = (inp['Bucket'], inp['Key'].split('/')[0])
        else:
            raise RuntimeError(f"Expected input of type bytes or dict, received {type(inp)}")
        
        # wav, _ = ta.load(audio_obj, format='ogg')
        wav = wav.to(self.device)
        ref = wav.mean(0)
        wav = (wav - ref.mean()) / ref.std()
        logger.info(f"Processed audio into tensor of size {wav.size()}")
        return wav, ref, s3_folder


    def inference(self, wav, ref):
        if self.model is None:
            raise RuntimeError("Model not initialized")
        demuxed = apply_model(self.model, wav, 8)
        demuxed = demuxed * ref.std() + ref.mean()
        return demuxed


    # From https://github.com/facebookresearch/demucs/blob/dd7a77a0b2600d24168bbe7a40ef67f195586b62/demucs/separate.py#L207
    def postprocess(self, inference_output) -> Path:
        stems = []
        for source in inference_output:
            source = source / max(1.01 * source.abs().max(), 1)  # source.max(dim=1).values.max(dim=-1)
            source = (source * 2**15).clamp_(-2**15, 2**15 - 1).short()
            source = source.cpu().numpy()
            stems.append(source)
        return stems


    def cache(self, stems, s3_folder, fmt=None):
        bucket, folder = s3_folder
        key = folder + '/inferred.npz'
        source_names = ["drums", "bass", "other", "vocals"]
        stems = dict(zip(source_names, stems))
        with io.BytesIO() as buf_:
            np.savez_compressed(buf_, **stems)
            buf_.seek(0)
            self.s3_client.upload_fileobj(buf_, bucket, key, ExtraArgs={'ACL':'public-read'})
        return key



    def handle(self, data, context):
        inp = data[0].get('data') or data[0].get('body') 
        
        tic = time.time()
        wav, ref, s3_folder = self.preprocess(inp)
        logger.info(f'preprocess took  {time.time()-tic}')
        
        tic = time.time()
        out = self.inference(wav, ref)
        logger.info(f'inference took  {time.time()-tic}')
        
        tic = time.time()
        stems = self.postprocess(out)        
        logger.info(f'postprocess took {time.time()-tic}')
    
        tic = time.time()
        key = self.cache(stems, s3_folder)
        logger.info(f'caching took {time.time()-tic}')

        result = {"bucket": s3_folder[0], "folder": s3_folder[1], "object": key}

        return [result]

