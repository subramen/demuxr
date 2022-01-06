from flask import Flask, request
from werkzeug.utils import secure_filename
import requests
from flask_cors import CORS
from loguru import logger
import subprocess, io
import json
import hashlib
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

app = Flask(__name__)
CORS(app)

BUCKET = "demucs-app-cache"
lambda_client = boto3.client('lambda', region_name='us-east-1', config=Config(read_timeout=180))
s3_client = boto3.client('s3')


@app.route("/")
def index():
    return "Demuxr is running"
    

@app.route("/file_upload", methods=['POST'])
def file_upload():
    # Receive audio file
    file = request.files['file']
    filetype = file.filename.split('.')[-1]
    input_hash = hashlib.md5(file.read()).hexdigest()
    if filetype != 'ogg':
        file = convert_to_ogg(file)
        file.seek(0)
    demuxed_urls = main(file, input_hash)        
    return demuxed_urls


def convert_to_ogg(file):
    logger.info("converting to OGG...")
    file.seek(0)
    command = ['ffmpeg', '-y', '-i', '-', '-c:a', 'libvorbis', '-f', 'ogg', '-']
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    ogg, err = process.communicate(file.read())
    return io.BytesIO(ogg)
    
    
def rip_from_youtube(url):
    # happy easter
    import youtube_dl
    import os
    import tempfile

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

    with youtube_dl.YoutubeDL(ydl_opts) as ydl:
        info_dict = ydl.extract_info(url, download=True)
    audio_path = os.path.join(temp, info_dict['id'], 'original.ogg')
    file = io.BytesIO(open(audio_path, 'rb'))
    file_hash = hashlib.md5(file.read()).hexdigest()
    file.seek(0)
    demuxed_urls = main(file, file_hash)
    return demuxed_urls


def main(file, file_hash):
    status = 200
    if not s3_exists(file_hash + '/vocals.ogg'):
        logger.info("Uploading audio file to S3 cache...")
        s3_client.upload_fileobj(file, BUCKET, file_hash + '/original.ogg')
        logger.info("Running inference on uploaded audio...")
        run_inference(file_hash + '/original.ogg')
        logger.info("Encoding inferenced npz output...")
        encode_resp = run_encode(BUCKET, file_hash + '/model_output.npz')
        logger.info("Returning demuxed urls...")
        status = encode_resp['StatusCode']
    return {'stem_urls': s3_presigned_urls(file_hash), 'status': status}
    


def s3_exists(obj):
    try:
        s3_client.head_object(Bucket=BUCKET, Key=obj)
    except ClientError:
        logger.info(f"{obj} not found in cache")
        return False
    logger.info(f"{obj} found in cache")
    return True


def s3_presigned_urls(folder):
    out_dict = {}
    for obj in ['bass', 'drums', 'vocals', 'other', 'original']:
        out_dict[obj] = s3_client.generate_presigned_url(
            ClientMethod='get_object', 
            Params={
                'Bucket': BUCKET, 
                'Key': folder + '/' + obj + '.ogg'}, 
            ExpiresIn=60)
    return out_dict


def run_inference(key):
    """ship audio to model"""
    logger.info(f"Running inference on {key}")
    resp = requests.post(url="http://model:8080/predictions/demucs_quantized/1", json={'Bucket': BUCKET, 'Key': key})
    if resp.status_code != 200:
        raise RuntimeError(f"Torchserve inference failed with HTTP {resp.status_code} | {resp.text}")


def run_encode(bucket, obj):
    """
    aws --debug --cli-read-timeout 0  lambda invoke --function-name test --payload '{"bucket": "demucs-app-cache", "object": "test/inferred.npz"}' out.json
    """
    payload = json.dumps({"bucket": bucket, "object": obj})
    logger.info("Invoking encode function on Lambda")
    ret  = lambda_client.invoke(FunctionName='audio-encode', InvocationType='RequestResponse', Payload=payload)
    return ret


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)