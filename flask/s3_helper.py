from loguru import logger
from botocore.exceptions import ClientError
import boto3
import io

BUCKET = 'demucs-app-cache'
S3_CLIENT = boto3.client('s3')

# ls
def ls():
    """
    return cached demuxed IDs
    """
    contents = [d['Prefix'].split('/vocals.mp3')[0] for d in S3_CLIENT.list_objects_v2(Bucket=BUCKET, Delimiter='/vocals.mp3')['CommonPrefixes']]
    return contents


def grep(folder, stem=None):
    """
    returns true if folder (or folder/stem.mp3) exists
    """
    if stem == None:
        return folder in ls()
    if stem[-4:] != '.mp3': 
        stem += '.mp3'
    try:
        S3_CLIENT.head_object(Bucket=BUCKET, Key=f"{folder}/{stem}")
    except ClientError:
        return False
    return True

# upload to s3
def upload_stem(mp3_bytes, folder, stem, force=False):
    if grep(folder, stem) and not force:
        logger.info("File exists! Not overwriting")    
        return 

    object_name = f"{folder}/{stem}.mp3"
    logger.info(f'Uploading {object_name}')
    S3_CLIENT.upload_fileobj(io.BytesIO(mp3_bytes), BUCKET, object_name, ExtraArgs={'ACL':'public-read'})

def download_stem(folder, stem, fileobj):
    object_name = f"{folder}/{stem}.mp3"

    if not grep(folder, stem):
        logger.info(f"File {object_name} not found in S3!")    
        return 

    logger.info(f'Downloading {object_name}')
    S3_CLIENT.download_fileobj(BUCKET, object_name, fileobj)
    

def get_url(folder):
    return f'http://{BUCKET}.s3.amazonaws.com/{folder}'
