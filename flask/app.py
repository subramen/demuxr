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
    def __init__(self, folder=None):
        self.BUCKET = 'demucs-app-cache'
        self.folder = folder

    # ls
    def _ls(self):
        s3_client = boto3.client('s3')
        contents = s3_client.list_objects_v2(Bucket=self.BUCKET, Delimiter='/vocals.mp3')
        return contents


    # grep s3
    def _grep(self, object_name):
        s3_client = boto3.client('s3')
        try:
            r = s3_client.head_object(Bucket=self.BUCKET, Key=object_name)
        except ClientError:
            logger.debug(f"{object_name} doesn't exist in S3 cache")
            return False
        return True

    # upload to s3
    def upload_file(self, bytes_like, name):
        object_name = self.folder + '/' + name + '.mp3'
        s3_client = boto3.client('s3')
        logger.debug(f'Uploading {object_name}')
        s3_client.upload_fileobj(
            io.BytesIO(bytes_like),
            self.BUCKET,
            object_name,
            ExtraArgs={'ACL':'public-read'})
        return True

    def cache_available(self):
        return self._grep(self.folder + '/' + 'vocals.mp3')

    def get_filelist(self):
        contents = self._ls()['CommonPrefixes']
        ids = [d['Prefix'].split('/vocals.mp3')[0] for d in contents]
        return ids
    
    def get_access_point(self):
        if self.folder:
            return f'http://{self.BUCKET}.s3.amazonaws.com/{self.folder}'

    @logger.catch
    def upload_stems(self, stem_bytes):
        if not self.folder:
            raise ValueError('video id not initialized')
        for name, byt in stem_bytes.items():
            if name == 'original': continue  # original is already uploaded
            self.upload_file(byt, name)


   
# get ETA + other things
def get_video_info(url):
    info_dict = youtubedl(url, True)
    response = {
        'url': url,
        'title': info_dict['title'],
        'id': info_dict['id'],
        'folder': S3Helper(info_dict['id']).get_access_point()
    }
    logger.info(response)
    return response


# get the youtube info_dict
def youtubedl(url, download=True):
    logger.debug(f"Running youtube-dl for {url}")
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
        info_dict = ydl.extract_info(url, download=download)
        if download:
            out_file = Path(temp.name) / info_dict['id'] / 'original.mp3'
            info_dict['mp3_bytes'] = open(out_file, 'rb').read()
            if not info_dict['id'] in S3Helper().get_filelist():
                logger.info("New track! Uploading original to S3")
                S3Helper(info_dict['id']).upload_file(info_dict['mp3_bytes'], 'original')
    
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
@logger.catch
def run_inference(mp3_bytes):
    logger.info(f"Initializing inference for mp3 of {len(mp3_bytes)}")
    pred_url = torchserve_url + pred_endpoint

    # check if server ping is healthy
    if not torchserve_healthy():
        raise RuntimeError("Model server not healthy!")

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


# def validate_url(url):
#     info = get_video_info(url)
#     if info['eta'] > MAX_AUDIO_DURATION:
#         logger.error("URL Validation Failed! Video is too long")
#         return False, (413, 'Video too long')
#     return True, (200, 'OK')
    

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

    # is_valid, status = validate_url(url)
    # if not is_valid:
    #     response['status'], response['msg'] = status
    #     logger.error("Video is invalid!", response)
    #     return response

    info_dict = youtubedl(url)
    s3 = S3Helper(info_dict['id'])
    logger.info(f"Initialized S3 helper for {info_dict['id']}. Checking cache...")

    if not s3.cache_available():
        stem_bytes = run_inference(info_dict['mp3_bytes'])
        upload_success = s3.upload_stems(stem_bytes)
        if upload_success:
            logger.info(f"Upload to cache success!")
        else:
            logger.error("Upload to cache failed!")
            return response

    response['status'] = 200
    response['msg'] = s3.get_access_point()
    return response


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
