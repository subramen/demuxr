from flask import Flask, render_template, make_response, request
import requests
import youtube_dl
import time
import sys
from pathlib import Path
import json
import numpy as np

from loguru import logger

app = Flask(__name__)


@app.route("/", methods=['GET', 'POST'])
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
    if not request.json or not 'url' in request.json:
        abort(400)

    # check if url has already been processed. return from cache

    mp3_id = download_input_audio(request.json['url'])
    run_inference(Path(mp3_id))


def download_input_audio(url):
    logger.debug(f"Downloading mp3 from {url}")

    ydl_opts = {
        'quiet':False,
        'outtmpl':'%(id)s/input.%(ext)s',
        'format': 'bestaudio/best',
        'postprocessors': [{'key': 'FFmpegExtractAudio','preferredcodec': 'mp3','preferredquality': '192',}]
        }
    with youtube_dl.YoutubeDL(ydl_opts) as ydl:
        info_dict = ydl.extract_info(url, download=True)
        logger.debug(f"mp3 saved at {info_dict['id']}/input.mp3" )

    return info_dict['id']


def run_inference(mp3_id):
    logger.debug(f"Starting inference for {mp3_id}")
    URL = "http://127.0.0.1:8080/predictions/demucs_state/1"
    response = requests.post(url=URL, data=open(mp3_id/"input.mp3", 'rb').read(), headers={'Content-Type': 'audio/mpeg'})

    if response.status_code != 200:
        logger.error(f"HTTP failed for {mp3_id} with {response.status_code} | {response.text}")
        sys.exit()

    logger.debug("Inference done! Saving...")

    bytebuf = response.content
    n = len(bytebuf)//4
    stems = [bytebuf[i:i+n] for i in range(0, len(bytebuf), n)]
    source_names = ["drums", "bass", "other", "vocals"]
    for stem, name in zip(stems, source_names):
        save = mp3_id / (name + '.mp3')
        with open(save, 'wb') as f:
            f.write(stem)


def save_to_cache(src_file):
    pass

def load_from_cache(id):
    pass



if __name__ == "__main__":
    app.run(debug=True)
