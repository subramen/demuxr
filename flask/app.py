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
pred_endpoint = "predictions/demucs/1"
MAX_AUDIO_DURATION = 6500


@app.route("/api/info")
@cross_origin()
def info():
    url = request.args.get('url')
    logger.info(f'Pinging /api/info with param = {url}')
    return get_video_info(url)

@app.route("/api/demux")
@cross_origin()
def demux():
    response = {'msg': '', 'status': 0}
    url = request.args.get('url')
    logger.info(f'Pinging /api/demux with param = {url}')

    folder = youtubedl(url, download=False)['id']

    # Check if demuxed stems in cache
    if not s3.grep(folder, 'vocals'):
        stem_bytes = run_demuxr(folder)
        for stem, bytes in stem_bytes.items():
            s3.upload_stem(bytes, folder, stem)

    response['status'] = 200
    response['msg'] = s3.get_url(folder)
    logger.info(f"Response = {response}")
    return response

  
# get ETA + other things
def get_video_info(url):
    info_dict = youtubedl(url)
    response = {
        'url': url,
        'title': info_dict['title'],
        'id': info_dict['id'],
        'folder': s3.get_url(info_dict['id']),
        'status': 200
    }
    logger.info(response)
    return response


# get the youtube info_dict
def youtubedl(url, download=True):
    temp = tempfile.TemporaryDirectory() # TODO: Use as context manager 
    ydl_opts = {
        'quiet':True,
        'outtmpl':f'{temp.name}/%(id)s/original.%(ext)s',
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',}]
        }

    with youtube_dl.YoutubeDL(ydl_opts) as ydl:
        # get video info like id, title
        info_dict = ydl.extract_info(url, download=download)

        if download:
            # store the audio bytes in return dict
            out_file = Path(temp.name) / info_dict['id'] / 'original.mp3'
            info_dict['mp3_bytes'] = open(out_file, 'rb').read()
            # upload original.mp3 to S3 if it doesn't exist
            s3.upload_stem(info_dict['mp3_bytes'], info_dict['id'], 'original', force=False)
    
    return info_dict


# check if torchserve is up
def torchserve_healthy():
    logger.info("Checking torchserve health... ")
    status = json.loads(requests.get(torchserve_url+'ping').text)['status']
    if status != "Healthy":
        logger.error(f"Torchserve status: {status}")
        return False
    logger.debug("Torchserve is healthy")
    return True


# get the stems in bytes
def run_demuxr(folder):
    pred_url = torchserve_url + pred_endpoint

    # check if server ping is healthy
    if not torchserve_healthy():
        raise RuntimeError("Model server not healthy!")
    
    mp3_bytes = io.BytesIO()
    s3.download_stem(folder, 'original', mp3_bytes)

    response = requests.post(url=pred_url, data=mp3_bytes.getvalue(), headers={'Content-Type': 'audio/mpeg'})
    if response.status_code != 200:
        logger.error(f"Inference request failed with {response.status_code} | {response.text}")
        raise RuntimeError("Torchserve inference failed!")

    logger.info("Inference done!")
    bytebuf = response.content
    n = len(bytebuf)//4
    stems = [bytebuf[i:i+n] for i in range(0, len(bytebuf), n)]
    source_names = ["drums", "bass", "other", "vocals"]
    stem_bytes = dict(zip(source_names, stems))
    stem_bytes['original'] = mp3_bytes
    
    return stem_bytes
        


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
