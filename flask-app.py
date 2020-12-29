from flask import Flask, render_template, make_response, request
from flask_cors import CORS, cross_origin
import requests
import youtube_dl
import time
import sys
from pathlib import Path
import json
import numpy as np

from loguru import logger

app = Flask(__name__)
cors = CORS(app)


def get_youtube_audio(url, download=True):
    logger.debug(f"Downloading mp3 from {url}")
    ydl_opts = {
        'quiet':False,
        'outtmpl':'files/%(id)s/original.%(ext)s',
        'format': 'bestaudio/best',
        'postprocessors': [{'key': 'FFmpegExtractAudio','preferredcodec': 'mp3','preferredquality': '192',}]
        }
    with youtube_dl.YoutubeDL(ydl_opts) as ydl:
        info_dict = ydl.extract_info(url, download=download)
        if download:
            logger.debug(f"audio saved at ./files/{info_dict['id']}/original.mp3" )

    return info_dict


def run_inference(savedir):
    logger.debug(f"Starting inference for {savedir}")

    model_url = "http://127.0.0.1:8080/predictions/demucs_state/1"
    model_input = open(savedir/"original.mp3", 'rb').read()
    response = requests.post(url=model_url, data=model_input, headers={'Content-Type': 'audio/mpeg'})

    if response.status_code != 200:
        logger.error(f"HTTP failed for {savedir} with {response.status_code} | {response.text}")
        sys.exit()
    else:
        logger.debug("Inference done! Saving...")
        bytebuf = response.content
        n = len(bytebuf)//4
        stems = [bytebuf[i:i+n] for i in range(0, len(bytebuf), n)]
        source_names = ["drums", "bass", "other", "vocals"]
        for stem, name in zip(stems, source_names):
            save = savedir / (name + '.mp3')
            with open(save, 'wb') as f:
                f.write(stem)


@app.route("/api/info")
@cross_origin()
def get_video_info():
    url = request.args.get('url')
    info_dict = get_youtube_audio(url, False)
    response = {
        'id': info_dict['id'],
        'url': url,
        'eta': info_dict['duration'],
        'status': 'done'
        }
    return response


@app.route("/api/demux")
@cross_origin()
def main():
    """
        check if url in cache and return

        run demucs
            run youtube-dl
            http request to ts
            encode response to mp3
            save to cache
            return to user
    """
    MAX_DURATION = 260
    resp = {'status': None, 'message': None}

    url = request.args.get('url')
    info_dict = get_youtube_audio(url)
    savedir = Path('files') / info_dict['id']
    eta = info_dict['duration']

    if eta > MAX_DURATION:
        logger.error("Video is too long!")
        resp['status'] = "Failed"
        resp['message'] = "Video is too long!"
    else:
        logger.info(f"ETA for demuxing: {eta/60} minutes")
        run_inference(savedir)
        resp['status'] = "Done!"
        resp['message'] = str(savedir)

    return resp

if __name__ == "__main__":
    app.run(debug=True)
