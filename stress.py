# start the model service
import aiohttp
from aiohttp import ClientSession
import asyncio
import time
import torch, torchaudio
import boto3, io

url = "http://localhost:8080/predictions/demucs_quantized/1"
data = {"Bucket": 'demucs-app-cache', "Key":'test.ogg'}




async def encode():
    """can we do this with lambda??"""
    print('starting encode...')
    s3 = boto3.client('s3')
    blob_url = "https://demucs-app-cache.s3.amazonaws.com/test.ogg.bin"
    
    print('downloading blob')
    # download the blob
    blob = io.BytesIO()
    s3.download_fileobj("demucs-app-cache", "test.ogg.bin", blob)

    print('load blob')
    # load blob as tensor
    blob.seek(0)
    x = torch.load(blob)

    print('encode to ogg') ## LONG RUNNING
    # encode tensor to ogg torchaudio.save()
    # upload files to s3
    for c, y in enumerate(x):
        with io.BytesIO() as buf:
            key = f"test{c}.ogg"
            torchaudio.save(buf, y, 44100, format='ogg')
            s3.upload_fileobj(buf, "demucs-app-cache", key, ExtraArgs={'ACL':'public-read'})

    # return s3 location
        
        
        
async def get_prediction(session):
    tic = time.time()
    print("get_prediction start ", tic)
    async with session.post(url=url, json=data) as resp:
        print(resp.status)
        result = await resp.text()
    print("get_prediction time taken ", time.time()-tic)
    tic = time.time()
    task = asyncio.create_task(encode())
    await task
    print("Encoding time taken ", time.time()-tic)
    return result

async def predict_concurrent(n):
    async with ClientSession() as session:
        tasks = []

        tic = time.time()
        for _ in range(n):
            tasks.append(get_prediction(session))
        print("Tasks appended: ", time.time()-tic)
        
        print("Gathering tasks...")
        preds = await asyncio.gather(*tasks)
        print("Returning preds...")
        return preds

if __name__ == "__main__":
    tic = time.time()
    print("Start time = ", tic)
    preds = asyncio.run(predict_concurrent(3))
    print("Total Duration: ", time.time() - tic)


