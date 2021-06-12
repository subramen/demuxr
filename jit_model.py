import torch
from model.model import Demucs
from model.utils import apply_model
from model.separate import load_track
model = Demucs([1,1,1,1])
model.load_state_dict(torch.load('demucs_quantized.pt'))
model.eval()

wav = load_track('test.mp3', 'cpu', 2, 44100)
ref = wav.mean(0)
wav = (wav - ref.mean()) / ref.std()
wav = wav.unsqueeze(0)
scripted = torch.jit.script(model)

out = scripted(wav)[0]
print(out.shape)

scripted.save('demucs_quantized_jit.pt')