from flask import Flask, request
import requests
from flask_cors import CORS
from loguru import logger
import logging
import json
import hashlib
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

app = Flask(__name__)
CORS(app)
logging.getLogger('flask_cors').level = logging.DEBUG

BUCKET = "demucs-app-cache"
lambda_client = boto3.client('lambda', region_name='us-east-1', config=Config(read_timeout=180))
s3_client = boto3.client('s3')


@app.route("/file_upload", methods=['POST'])
def file_upload():
    # Receive audio file
    file = request.files['file']
    file_hash = hashlib.md5(file.read()).hexdigest()
    
    # Check cache 
    if not s3_exists(file_hash + '/vocals.ogg'):
        # Upload audio file to S3 cache
        file.seek(0)
        s3_client.upload_fileobj(file, BUCKET, file_hash + '/original.ogg')
        # Run inference on uploaded audio
        run_inference(file_hash + '/original.ogg')
        # Encode inferenced npz output
        encode_resp = run_encode(BUCKET, file_hash + '/model_output.npz')
        
    return {'stem_urls': s3_presigned_urls(file_hash), 'status': encode_resp['StatusCode']}



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
    logger.info("Running inference on ", key)
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
    app.run(host="0.0.0.0", port=6786)