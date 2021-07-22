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
    logger.info(f"Audio downloaded from youtube in {toc-tic}s")
    
    return audio_path


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
        metadata['video_id'] = info_dict.get('id')
        metadata['s3_url'] = s3.get_url(info_dict.get('id'))
    return metadata


def run_inference(key):
    """ship audio to model"""
    bucket = "demucs-app-cache"
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
    url = request.args.get('url')
    folder = request.args.get('folder')
    logger.info(f"Received request of url {url} and folder {folder}")

    is_cached = lambda folder: s3.grep(folder + '/original.ogg')
    is_inferred = lambda folder: s3.grep(folder + '/vocals.ogg')
    status = 404
    
    if is_inferred(folder):
        status = 200
    else:
        key = folder + '/original.ogg'
        if not is_cached(folder): 
            s3.upload_stem(get_yt_audio(url)) 
        response = run_inference(key)
        status = response.status_code
        
    return {'response': s3.get_url(folder), 'status': status}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)