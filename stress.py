# start the model service
import aiohttp
from aiohttp import ClientSession
import asyncio
import time

url = "http://localhost:8080/predictions/demucs_quantized/1"
data = {"Bucket": 'demucs-app-cache', "Key":'0UHwkfhwjsk/original.mp3'}

async def get_prediction(session):
    tic = time.time()
    print("get_prediction start ", tic)
    async with session.post(url=url, json=data) as resp:
        print(resp.status)
        result = await resp.text()
    print("Result: ", result)
    print("get_prediction time taken ", time.time()-tic)
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


