import json
import os
import io, boto3, subprocess, numpy as np
import time

s3 = boto3.client("s3")

def encode(bucket, object_name, out_fmt='ogg'):
    blob = io.BytesIO()
    tic = time.time()
    s3.download_fileobj(bucket, object_name, blob)
    blob.seek(0)
    print("Blob download: ", time.time()-tic)
    
    tic = time.time()
    npz = np.load(blob)
    del blob
    print("Blob load: ", time.time()-tic)

    samplerate = int(npz['samplerate'])
    cmd = f"/opt/bin/sox --multi-threaded -t s16 -r {samplerate} -c 2 - -t {out_fmt} -r 44100 -b 16 -c 2 -"
    cmd_a = cmd.split(' ')
    source_names = ["drums", "bass", "other", "vocals"]
    folder = object_name.split("/")[0]
    
    for name in source_names:
        key = folder + '/' + name + '.' + out_fmt
        array = npz[name]
        tic = time.time()
        handle = subprocess.Popen(cmd_a, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        out, err = handle.communicate(array.tobytes(order='F'))
        buf = io.BytesIO(out)
        print(name, " encode: ", time.time()-tic)
        
        print("Uploading ", name, " to ", bucket, "/", key)
        tic = time.time()
        s3.upload_fileobj(buf, bucket, key)
        print(name, " upload: ", time.time()-tic)
    
    return True
        
        
        
def lambda_handler(event, context):
    is_done = False
    is_done = encode(event['bucket'], event['object'])
    
    return {
        'statusCode': 200,
        'isDone': is_done
    }
