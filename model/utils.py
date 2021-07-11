# Copyright (c) Facebook, Inc. and its affiliates.
# All rights reserved.
#
# This source code is licensed under the license found in the
# LICENSE file in the root directory of this source tree.

import errno
import functools
import hashlib
import inspect
import io
import os
import random
import socket
import tempfile
import warnings
import zlib
from contextlib import contextmanager

from diffq import UniformQuantizer, DiffQuantizer
import torch as th
import tqdm
from torch import distributed
from torch.nn import functional as F


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


def average_metric(metric, count=1.):
    """
    Average `metric` which should be a float across all hosts. `count` should be
    the weight for this particular host (i.e. number of examples).
    """
    metric = th.tensor([count, count * metric], dtype=th.float32, device='cuda')
    distributed.all_reduce(metric, op=distributed.ReduceOp.SUM)
    return metric[1].item() / metric[0].item()


def free_port(host='', low=20000, high=40000):
    """
    Return a port number that is most likely free.
    This could suffer from a race condition although
    it should be quite rare.
    """
    sock = socket.socket()
    while True:
        port = random.randint(low, high)
        try:
            sock.bind((host, port))
        except OSError as error:
            if error.errno == errno.EADDRINUSE:
                continue
            raise
        return port


def sizeof_fmt(num, suffix='B'):
    """
    Given `num` bytes, return human readable size.
    Taken from https://stackoverflow.com/a/1094933
    """
    for unit in ['', 'Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei', 'Zi']:
        if abs(num) < 1024.0:
            return "%3.1f%s%s" % (num, unit, suffix)
        num /= 1024.0
    return "%.1f%s%s" % (num, 'Yi', suffix)


def human_seconds(seconds, display='.2f'):
    """
    Given `seconds` seconds, return human readable duration.
    """
    value = seconds * 1e6
    ratios = [1e3, 1e3, 60, 60, 24]
    names = ['us', 'ms', 's', 'min', 'hrs', 'days']
    last = names.pop(0)
    for name, ratio in zip(names, ratios):
        if value / ratio < 0.3:
            break
        value /= ratio
        last = name
    return f"{format(value, display)} {last}"


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

        out = F.pad(self.tensor[..., correct_start:correct_end], (pad_left, pad_right))
        assert out.shape[-1] == target_length
        return out


def tensor_chunk(tensor_or_chunk):
    if isinstance(tensor_or_chunk, TensorChunk):
        return tensor_or_chunk
    else:
        assert isinstance(tensor_or_chunk, th.Tensor)
        return TensorChunk(tensor_or_chunk)



def apply_model(model, mix, max_batch_sz=None, overlap=0.25, transition_power=1.):
    SEG_LEN = model.segment_length // 4
    channels, total_length = mix.size()
    device = mix.device
    mix.unsqueeze_(0)

    def merge_segments(out_segments, offsets):
        out = th.zeros(4, channels, total_length, device=device)
        weight = th.cat([th.arange(1, SEG_LEN // 2 + 1), \
            th.arange(SEG_LEN - SEG_LEN // 2, 0, -1)]).to(device)
        weight = (weight / weight.max())**transition_power
        sum_weight = th.zeros(total_length, device=device)
        for i, out_seg in enumerate(out_segments):
            offset = offsets[i]
            end_ix = min(SEG_LEN, total_length - offset)
            out[..., offset:offset + SEG_LEN] += (out_seg * weight)[..., :end_ix]
            sum_weight[offset:offset + SEG_LEN] += weight[:end_ix]
        out /= sum_weight
        return out
    

    def batch_infer(model, seg_list, out_length=None, batch_sz=None):
        def infer(inp, length):
            print('model input size ', inp.size())
            with th.no_grad():
                x = model(inp)
                x.detach()
                if length:
                    print('trimming')
                    x = center_trim(x, length)
            print('model output size ', x.size())
            return x

        chunked_input = th.vstack(seg_list)
        batched_input = th.split(chunked_input, batch_sz) if batch_sz else (chunked_input, )
        chunked_output = th.vstack([infer(inp, out_length) for inp in batched_input])
        return chunked_output

    seg_list = []
    stride = int((1 - overlap) * SEG_LEN) 
    offsets = range(0, total_length, stride)
    valid_seg_len = model.valid_length(SEG_LEN)
    for offset in offsets:
        seg =  TensorChunk(mix, offset, SEG_LEN).padded(valid_seg_len)
        seg_list.append(seg)
    
    model_out = batch_infer(model, seg_list, SEG_LEN, max_batch_sz)
    stems = merge_segments(model_out, offsets)
    return stems


@contextmanager
def temp_filenames(count, delete=True):
    names = []
    try:
        for _ in range(count):
            names.append(tempfile.NamedTemporaryFile(delete=False).name)
        yield names
    finally:
        if delete:
            for name in names:
                os.unlink(name)


def get_quantizer(model, args, optimizer=None):
    quantizer = None
    if args.diffq:
        quantizer = DiffQuantizer(
            model, min_size=args.q_min_size, group_size=8)
        if optimizer is not None:
            quantizer.setup_optimizer(optimizer)
    elif args.qat:
        quantizer = UniformQuantizer(
                model, bits=args.qat, min_size=args.q_min_size)
    return quantizer


def load_model(path, strict=False):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        load_from = path
        package = th.load(load_from, 'cpu')

    klass = package["klass"]
    args = package["args"]
    kwargs = package["kwargs"]

    if strict:
        model = klass(*args, **kwargs)
    else:
        sig = inspect.signature(klass)
        for key in list(kwargs):
            if key not in sig.parameters:
                warnings.warn("Dropping inexistant parameter " + key)
                del kwargs[key]
        model = klass(*args, **kwargs)

    state = package["state"]
    training_args = package["training_args"]
    quantizer = get_quantizer(model, training_args)

    set_state(model, quantizer, state)
    return model


def get_state(model, quantizer):
    if quantizer is None:
        state = {k: p.data.to('cpu') for k, p in model.state_dict().items()}
    else:
        state = quantizer.get_quantized_state()
        buf = io.BytesIO()
        th.save(state, buf)
        state = {'compressed': zlib.compress(buf.getvalue())}
    return state


def set_state(model, quantizer, state):
    if quantizer is None:
        model.load_state_dict(state)
    else:
        buf = io.BytesIO(zlib.decompress(state["compressed"]))
        state = th.load(buf, "cpu")
        quantizer.restore_quantized_state(state)

    return state


def save_state(state, path):
    buf = io.BytesIO()
    th.save(state, buf)
    sig = hashlib.sha256(buf.getvalue()).hexdigest()[:8]

    path = path.parent / (path.stem + "-" + sig + path.suffix)
    path.write_bytes(buf.getvalue())


def save_model(model, quantizer, training_args, path):
    args, kwargs = model._init_args_kwargs
    klass = model.__class__

    state = get_state(model, quantizer)

    save_to = path
    package = {
        'klass': klass,
        'args': args,
        'kwargs': kwargs,
        'state': state,
        'training_args': training_args,
    }
    th.save(package, save_to)


def capture_init(init):
    @functools.wraps(init)
    def __init__(self, *args, **kwargs):
        self._init_args_kwargs = (args, kwargs)
        init(self, *args, **kwargs)

    return __init__
