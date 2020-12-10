from flask import Flask, render_template, make_response, request
import requests
import youtube_dl
import lameenc
import time, sys
from pathlib import Path
import json
import numpy as np

app = Flask(__name__)

@app.route("/", methods=['GET', 'POST'])
def hello():
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

    mp3_file, mp3_id = download_src_audio(request.json['url'])
    http_resp = http_request(mp3_file, mp3_id)
    response_to_mp3(http_resp)


def download_src_audio(url):
    TEST = True
    start = time.time()
    print(f"Starting ydl: {start}")

    templ = '%(id)s.%(ext)s'
    ydl_opts = {
        'quiet':False,
        'outtmpl':templ,
        'format': 'bestaudio/best',
        'postprocessors': [{'key': 'FFmpegExtractAudio','preferredcodec': 'mp3','preferredquality': '192',}]
        }

    with youtube_dl.YoutubeDL(ydl_opts) as ydl:
        info_dict = ydl.extract_info(url, download=(not TEST))
        mp3_file = ydl.prepare_filename(info_dict).replace('webm', 'mp3')
        mp3_id = mp3_file.replace('.mp3', '')

    print(f"ydl took {time.time()-start}s")

    return Path('test.mp3'), 'test'
    # return Path(mp3_file), mp3_id


def http_request(mp3_file, mp3_id):
    start = time.time()
    print(f"Starting http for mp3_path: {start}")

    URL = "http://127.0.0.1:8080/predictions/demucs_state/1"
    payload = {'mp3_file': (None, open(mp3_file, 'rb'), ''), 'mp3_id':mp3_id}
    response = requests.post(URL, files=payload)

    print(f"http took {time.time()-start}s")
    print(response.status_code)
    if response.status_code == 200:
        return json.loads(response.content)
    else:
        sys.exit()


def response_to_mp3(response):
    def encode_mp3(wav, path):
        encoder = lameenc.Encoder()
        encoder.set_bit_rate(320)
        encoder.set_in_sample_rate(44100)
        encoder.set_channels(2)
        encoder.set_quality(2)  # 2-highest, 7-fastest
        if not verbose:
            encoder.silence()
        mp3_data = encoder.encode(wav.tostring())
        mp3_data += encoder.flush()
        with open(path, "wb") as f:
            f.write(mp3_data)
        return mp3_data

    savepath = Path('savepath') # TODO: change to somethign meaningful
    savepath.mkdir(parents=True, exist_ok=True)

    start = time.time()
    print(f"Starting encode: {start}")

    for stem, wav in response.items():
        stempath = savepath / (stem + '.mp3')
        wav = np.array(wav)
        encode_mp3(wav, stempath)
        save_to_cache(stempath)

    print(f"encode took {time.time()-start}s")


def save_to_cache(src_file):
    pass

def load_from_cache(id):
    pass



if __name__ == "__main__":
    app.run(debug=True)
