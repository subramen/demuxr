from flask import Flask, request
import requests
from flask_cors import CORS, cross_origin
import youtube_dl
from pathlib import Path
import tempfile
from loguru import logger
import s3_helper as s3
import io
import json
import time

app = Flask(__name__)
cors = CORS(app)
torchserve_url = "http://model:8080/"
pred_endpoint = "predictions/demucs_quantized/1"
MAX_AUDIO_DURATION = 6500



def get_yt_audio(url):
    """
    downloads the url
    returns (id, path) of the audio
    """
    with tempfile.TemporaryDirectory() as temp:
        ydl_opts = {
            'quiet':True,
            'outtmpl':f'{temp}/%(id)s/original.%(ext)s',
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'vorbis',
                'preferredquality': '128',}],
                'postprocessor_args': ['-ar', '44100'],
        }
    tic = time.time()
    with youtube_dl.YoutubeDL(ydl_opts) as ydl:
        info_dict = ydl.extract_info(url, download=True)
    audio_path = Path(temp) / info_dict['id'] / 'original.ogg'
    toc = time.time()
    logger.info("Audio downloaded from youtube in ", toc-tic, " s")
    
    return audio_path, info_dict['id']


def get_yt_metadata(url):
    """
        response = {
        'url': url,
        'title': info_dict['title'],
        'id': info_dict['id'],
        # 'folder': s3.get_url(info_dict['id']),
        # 'status': 200
    }"""
    metadata = {}
    with youtube_dl.YoutubeDL({}) as ydl:
        info_dict = ydl.extract_info(url, download=False)
        metadata['url'] = url
        metadata['title'] = info_dict.get('title', '')
        metadata['s3_folder'] = s3.get_url(info_dict.get('id', ''))
    return metadata


def run_inference(bucket, key):
    """ship audio to model"""
    resp = requests.post(url="http://model:8080/predictions/demucs_quantized/1", json={'Bucket': bucket, 'Key': key})
    if resp.status_code != 200:
        raise RuntimeError(f"Torchserve inference failed with HTTP {resp.status_code} | {resp.text}")
    return resp


@app.route("/api/info")
@cross_origin()
def info():
    url = request.args.get('url')
    return get_yt_metadata(url)

@app.route("/api/demux")
@cross_origin()
def demux():
    is_cached = lambda folder: s3.grep(folder + '/vocals.ogg')
    url = request.args.get('url')
    audio_path, folder = get_yt_audio(url)

    if not is_cached(folder):
        bucket, key = s3.upload_stem(audio_path) 
        response = run_inference(bucket, key)

    return {'response': s3.get_url(folder), 'status': 200}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)