import torch
from diffq import DiffQuantizer
import io
import zlib
import functools
    
class TensorChunk:
    def __init__(self, tensor, offset=0, length=None):
        total_length = tensor.shape[-1]
        assert offset >= 0
        assert offset < total_length

        if length is None:
            length = total_length - offset
        else:
            length = min(total_length - offset, length)

        self.tensor = tensor
        self.offset = offset
        self.length = length
        self.device = tensor.device

    @property
    def shape(self):
        shape = list(self.tensor.shape)
        shape[-1] = self.length
        return shape

    def padded(self, target_length):
        delta = target_length - self.length
        total_length = self.tensor.shape[-1]
        assert delta >= 0

        start = self.offset - delta // 2
        end = start + target_length

        correct_start = max(0, start)
        correct_end = min(total_length, end)

        pad_left = correct_start - start
        pad_right = end - correct_end

        out = torch.nn.functional.pad(self.tensor[..., correct_start:correct_end], (pad_left, pad_right))
        assert out.shape[-1] == target_length
        return out


def center_trim(tensor, reference):
    """
    Center trim `tensor` with respect to `reference`, along the last dimension.
    `reference` can also be a number, representing the length to trim to.
    If the size difference != 0 mod 2, the extra sample is removed on the right side.
    """
    if hasattr(reference, "size"):
        reference = reference.size(-1)
    delta = tensor.size(-1) - reference
    if delta < 0:
        raise ValueError("tensor must be larger than reference. " f"Delta is {delta}.")
    if delta:
        tensor = tensor[..., delta // 2:-(delta - delta // 2)]
    return tensor

def capture_init(init):
    @functools.wraps(init)
    def __init__(self, *args, **kwargs):
        self._init_args_kwargs = (args, kwargs)
        init(self, *args, **kwargs)

    return __init__



def load_model(model, model_weights_path, is_quantized):
    state = torch.load(model_weights_path)
    if is_quantized:
        quantizer = DiffQuantizer(model, group_size=8, min_size=1)
        buf = io.BytesIO(zlib.decompress(state["compressed"]))
        state = torch.load(buf, "cpu")
        quantizer.restore_quantized_state(state)
        quantizer.detach() 
    else:
        model.load_state_dict(state)
    model.eval()
    return model


def apply_model(model, mix, max_batch_sz=None, overlap=0.25, transition_power=1.):
    SEG_LEN = model.segment_length // 4
    channels, total_length = mix.size()
    device = mix.device
    mix.unsqueeze_(0)
    print("Mix size ", mix.size())

    def merge_segments(out_segments, offsets):
        out = torch.zeros(4, channels, total_length, device=device)
        weight = torch.cat([torch.arange(1, SEG_LEN // 2 + 1), \
            torch.arange(SEG_LEN - SEG_LEN // 2, 0, -1)]).to(device)
        weight = (weight / weight.max())**transition_power
        sum_weight = torch.zeros(total_length, device=device)
        for i, out_seg in enumerate(out_segments):
            offset = offsets[i]
            end_ix = min(SEG_LEN, total_length - offset)
            out[..., offset:offset + SEG_LEN] += (out_seg * weight)[..., :end_ix]
            sum_weight[offset:offset + SEG_LEN] += weight[:end_ix]
        out /= sum_weight
        return out
    

    def infer(inp, length):
        with torch.no_grad():
            with torch.cuda.amp.autocast():
                x = model(inp)
                x.detach()
                if length:
                    x = center_trim(x, length)
        return x


    def batch_infer(model, seg_list, out_length=None, batch_sz=None):
        chunked_input = torch.vstack(seg_list)
        batched_input = torch.split(chunked_input, batch_sz) if batch_sz else (chunked_input, )
        chunked_output = torch.vstack([infer(inp, out_length) for inp in batched_input])
        return chunked_output


    seg_list = []
    stride = int((1 - overlap) * SEG_LEN) 
    offsets = range(0, total_length, stride)
    valid_seg_len = model.valid_length(SEG_LEN)
    
    print('no. of offsets ', len(offsets))
    for offset in offsets:
        seg =  TensorChunk(mix, offset, SEG_LEN).padded(valid_seg_len)
        seg_list.append(seg)
    
    print('len of seg_list ', len(seg_list))
    model_out = batch_infer(model, seg_list, SEG_LEN, max_batch_sz)
    stems = merge_segments(model_out, offsets)
    return stems
    