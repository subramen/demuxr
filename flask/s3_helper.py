from loguru import logger
from botocore.exceptions import ClientError
import boto3
import io

BUCKET = 'demucs-app-cache'
S3_CLIENT = boto3.client('s3')


def grep(obj):
    try:
        S3_CLIENT.head_object(Bucket=BUCKET, Key=obj)
    except ClientError:
        logger.info(f"{obj} not found in cache")
        return False
    logger.info(f"{obj} found in cache")
    return True


def upload_stem(path, force=False):
    logger.info(f"Received request to upload {path}")
    folder, stem = path.parts[-2:]
    key = f"{folder}/{stem}"
    if grep(key) and not force:
        logger.info("File exists! Not overwriting")    
    else:
        logger.info(f'Uploading {key}')
        S3_CLIENT.upload_file(str(path), BUCKET, key, ExtraArgs={'ACL':'public-read'})
    
    return (BUCKET, key)


def get_url(folder):
    return f'http://{BUCKET}.s3.amazonaws.com/{folder}'
