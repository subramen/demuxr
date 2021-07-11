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
                'preferredcodec': 'mp3',
                'preferredquality': '128',}],
                'postprocessor_args': ['-ar', '44100'],
        }
    
    with youtube_dl.YoutubeDL(ydl_opts) as ydl:
        info_dict = ydl.extract_info(url, download=True)
    audio_path = Path(temp) / info_dict['id'] / 'original.mp3'
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
        metadata['folder'] = s3.get_url(info_dict.get('id', ''))
    return metadata


def run_inference(inp_path):
    """ship audio to model"""
    bucket, key = s3.upload_stem(inp_path) 
    resp = requests.post(url="http://model:8080/predictions/demucs_quantized/1", json={'Bucket': bucket, 'Key': key})
    if resp.status_code != 200:
        raise RuntimeError(f"Torchserve inference failed with HTTP {resp.status_code} | {resp.text}")
    return resp.content


def cache_stems(bytebuf, folder):
    source_names = ["drums", "bass", "other", "vocals"]
    n = len(bytebuf) // len(source_names)
    stems = [bytebuf[i:i+n] for i in range(0, len(bytebuf), n)]
    for name, stem in zip(source_names, stems):
        s3.upload_stemobj(stem, folder, name)
    return s3.get_url(folder)


@app.route("/api/info")
@cross_origin()
def info():
    url = request.args.get('url')
    return get_yt_metadata(url)

@app.route("/api/demux")
@cross_origin()
def demux():
    url = request.args.get('url')
    audio_path, folder = get_yt_audio(url)

    if not s3.grep(folder, 'vocals'):
        bytebuf = run_inference(audio_path)
        cache_stems(bytebuf, folder)
    return {'msg': s3.get_url(folder), 'status':200}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)