from flask import Flask, request
import requests
from flask_cors import CORS, cross_origin
import youtube_dl
from pathlib import Path
import tempfile
from loguru import logger
from botocore.exceptions import ClientError
import boto3
import io
import json

app = Flask(__name__)
cors = CORS(app)
torchserve_url = "http://model:8080/"
pred_endpoint = "predictions/demucs/1"
MAX_AUDIO_DURATION = 6500


class S3Helper:
    def __init__(self, folder):
        self.bucket = 'demucs-app-cache'
        self.folder = folder
        bucket_url = f'http://{self.bucket}.s3.amazonaws.com/'
        self.access_point = bucket_url + folder

    # ls grep s3
    def _file_in_cache(self, object_name):
        s3_client = boto3.client('s3')
        try:
            r = s3_client.head_object(
                Bucket=self.bucket,
                Key=object_name)
        except ClientError:
            logger.debug(f"{object_name} doesn't exist in S3 cache")
            return False
        return True

    # upload to s3
    def _upload_file(self, bytes_like, object_name):
        s3_client = boto3.client('s3')
        logger.debug(f'Uploading {object_name}')
        s3_client.upload_fileobj(
            io.BytesIO(bytes_like),
            self.bucket,
            object_name,
            ExtraArgs={'ACL':'public-read'})
        return True

    def cache_available(self):
        return self._file_in_cache(self.folder + '/' + 'vocals.mp3')

    @logger.catch
    def upload_stems(self, stem_bytes):
        for name, byt in stem_bytes.items():
            obj_name = self.folder + '/' + name + '.mp3'
            self._upload_file(byt, obj_name)
        return True

   
# get ETA + other things
def get_video_info(url):
    info_dict = youtubedl(url, False)
    response = {
        'url': url,
        'id': info_dict['id'],
        'eta': info_dict['duration'],
        'too_long': int(info_dict['duration'] > MAX_AUDIO_DURATION)
    }
    return response


# get the youtube audio in bytes
def youtubedl(url, download=True):
    logger.debug(f"Running youtube-dl for {url}")
    temp = tempfile.TemporaryDirectory()
    ydl_opts = {
        'quiet':True,
        'outtmpl':f'{temp.name}/%(id)s/original.%(ext)s',
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',}]
        }
    mp3_bytes = None
    with youtube_dl.YoutubeDL(ydl_opts) as ydl:
        info_dict = ydl.extract_info(url, download=download)
        if download:
            out_file = Path(temp.name) / info_dict['id'] / 'original.mp3'
            info_dict['mp3_bytes'] = open(out_file, 'rb').read()
    return info_dict


# check if torchserve is up
def ping_torchserve():
    response = requests.get(torchserve_url+'ping')
    if response['health']=='healthy!':
        return True
    return False


# get the stems in bytes
@logger.catch
def run_inference(mp3_bytes):
    logger.info(f"Initializing inference for mp3 of {len(mp3_bytes)}")
    pred_url = torchserve_url + pred_endpoint

    # check if server ping is healthy
    logger.info("Checking torchserve health... ")
    status = json.loads(requests.get(torchserve_url+'ping').text)['status']
    if status != "Healthy":
        logger.error(f"Torchserve status: {status}")
        raise RuntimeError("Torchserve model is not healthy")
    logger.debug("Torchserve is healthy")

    response = requests.post(url=pred_url, data=mp3_bytes, headers={'Content-Type': 'audio/mpeg'})

    if response.status_code == 200:
        logger.debug("Inference done! Saving...")
        bytebuf = response.content
        n = len(bytebuf)//4
        stems = [bytebuf[i:i+n] for i in range(0, len(bytebuf), n)]
        source_names = ["drums", "bass", "other", "vocals"]
        stem_bytes = dict(zip(source_names, stems))
        stem_bytes['original'] = mp3_bytes
        return stem_bytes
    else:
        logger.error(f"HTTP failed with {response.status_code} | {response.text}")
        raise RuntimeError("Torchserve inference failed!")


def validate_url(url):
    info = get_video_info(url)
    if info['too_long']:
        logger.error("URL Validation Failed! Video is too long")
        return False, (413, 'Video too long')
    return True, (200, 'OK')


@app.route("/api/info")
@cross_origin()
def info():
    url = request.args.get('url')
    logger.info(f'Pinging /api/info with param = {url}')
    return get_video_info(url)


@app.route("/api/demux")
@cross_origin()
def main():
    response = {'msg': '', 'status': 0}
    url = request.args.get('url')
    logger.info(f'Pinging /api/demux with param = {url}')

    is_valid, status = validate_url(url)
    if not is_valid:
        response['status'], response['msg'] = status
        logger.error("Video is invalid!", response)
        return response

    info_dict = youtubedl(url)
    s3 = S3Helper(info_dict['id'])
    logger.info(f"Initialized S3 helper for {info_dict['id']}. Checking cache...")
    if not s3.cache_available():
        logger.info("Not in cache. Running inference...")
        stem_bytes = run_inference(info_dict['mp3_bytes'])
        logger.info("Inference done. Caching results...")
        upload_success = s3.upload_stems(stem_bytes)
        if upload_success:
            logger.info(f"Upload to cache success!")
        else:
            logger.error("Upload to cache failed!")
            return response

    logger.info(f'Returning stems at {s3.access_point}')
    response['status'] = 200
    response['msg'] = s3.access_point

    return response


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
