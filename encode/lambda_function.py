import json
import os
import io, boto3, subprocess, numpy as np


def encode(bucket, folder, object_name, fmt='ogg'):
    s3 = boto3.client("s3")
    blob = io.BytesIO()
    s3.download_fileobj(bucket, folder + "/" + object_name, blob)
    blob.seek(0)
    npz = np.load(blob)
    del blob

    cmd = f"./sox --multi-threaded -t s16 -r 44100 -c 2 - -t {fmt} -r 44100 -b 16 -c 2 -"
    cmd_a = cmd.split(' ')
    
    source_names = ["drums", "bass", "other", "vocals"]
    for name in source_names:
        array = npz[name]
        handle = subprocess.Popen(cmd_a, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        out, err = handle.communicate(array.tobytes(order='F'))
        buf = io.BytesIO(out)
        key = folder + '/' + name + '.' + fmt
        s3.upload_fileobj(buf, bucket, key)


def lambda_handler(event, context):
    encode(event['bucket'], event['folder'], event['object'])
    
    return {
        'statusCode': 200,
        'body': json.dumps('Track encoded to OGG!')
    }


if __name__ == "__main__":
    encode('demucs-app-cache', 'test', 'inferred_tensor.bin')