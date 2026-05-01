from __future__ import annotations

import json
import struct
from typing import Tuple


_HEADER_LEN_FMT = "<I"
_HEADER_LEN_SIZE = struct.calcsize(_HEADER_LEN_FMT)


def pack(header: dict, payload: bytes) -> bytes:
    if payload is None:
        payload = b""
    header_bytes = json.dumps(header, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    out = bytearray()
    out.extend(struct.pack(_HEADER_LEN_FMT, len(header_bytes)))
    out.extend(header_bytes)
    out.extend(bytes(payload))
    return bytes(out)


def unpack(blob: bytes) -> Tuple[dict, bytes]:
    blob = bytes(blob)
    if len(blob) < _HEADER_LEN_SIZE:
        raise ValueError(f"blob too short for header length prefix: {len(blob)} bytes")

    (header_len,) = struct.unpack(_HEADER_LEN_FMT, blob[:_HEADER_LEN_SIZE])
    if len(blob) < _HEADER_LEN_SIZE + header_len:
        raise ValueError(
            f"blob shorter than declared header length: have {len(blob)}, "
            f"need {_HEADER_LEN_SIZE + header_len}"
        )

    header_bytes = blob[_HEADER_LEN_SIZE : _HEADER_LEN_SIZE + header_len]
    payload = blob[_HEADER_LEN_SIZE + header_len :]

    try:
        header = json.loads(header_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise ValueError(f"invalid header JSON: {e}") from e

    if not isinstance(header, dict):
        raise ValueError("header JSON must decode to an object")

    return header, payload


def _torch_dtype_to_str(torch_module, dtype) -> str:
    if dtype == torch_module.bfloat16: return "bfloat16"
    if dtype == torch_module.float32: return "float32"
    if dtype == torch_module.int64: return "int64"
    raise ValueError(f"unsupported dtype: {dtype}")


def _str_to_torch_dtype(torch_module, s: str):
    if s == "bfloat16": return torch_module.bfloat16
    if s == "float32": return torch_module.float32
    if s == "int64": return torch_module.int64
    raise ValueError(f"unsupported dtype string: {s}")


def pack_tensor(tensor, header_extra: dict, torch_module=None) -> bytes:
    if torch_module is None:
        import torch as torch_module  # type: ignore

    t = tensor.detach().cpu().contiguous()
    dtype_str = _torch_dtype_to_str(torch_module, t.dtype)

    if t.dtype == torch_module.bfloat16:
        # numpy lacks bfloat16; round-trip via uint8 view
        raw = t.view(torch_module.uint8).numpy().tobytes()
    else:
        raw = t.numpy().tobytes()

    return pack({**header_extra, "dtype": dtype_str, "shape": list(t.shape)}, raw)


def unpack_tensor(blob: bytes, torch_module=None):
    if torch_module is None:
        import torch as torch_module  # type: ignore

    header, payload = unpack(blob)
    dtype_str = header.get("dtype")
    shape = tuple(header.get("shape", []))

    if dtype_str is None or dtype_str == "control":
        raise ValueError("unpack_tensor called on non-tensor message")

    dtype = _str_to_torch_dtype(torch_module, dtype_str)

    if dtype == torch_module.bfloat16:
        flat = torch_module.frombuffer(bytearray(payload), dtype=torch_module.uint8)
        tensor = flat.view(torch_module.bfloat16).reshape(shape)
    else:
        import numpy as np  # type: ignore
        np_dtype = np.float32 if dtype == torch_module.float32 else np.int64
        arr = np.frombuffer(payload, dtype=np_dtype).reshape(shape).copy()
        tensor = torch_module.from_numpy(arr)

    return header, tensor


def pack_token(token_id: int, request_id: str, seq: int) -> bytes:
    header = {
        "request_id": request_id,
        "kind": "token",
        "dtype": "int64",
        "shape": [1],
        "seq": int(seq),
    }
    payload = int(token_id).to_bytes(8, byteorder="little", signed=True)
    return pack(header, payload)


def unpack_token(blob: bytes) -> Tuple[dict, int]:
    header, payload = unpack(blob)
    if header.get("kind") != "token":
        raise ValueError(f"expected kind=token, got {header.get('kind')}")
    if len(payload) != 8:
        raise ValueError(f"expected 8 bytes for int64 token, got {len(payload)}")
    token_id = int.from_bytes(payload, byteorder="little", signed=True)
    return header, token_id


def pack_control(control_obj: dict, request_id: str, seq: int = 0) -> bytes:
    header = {
        "request_id": request_id,
        "kind": "control",
        "dtype": "control",
        "shape": [],
        "seq": int(seq),
    }
    payload = json.dumps(control_obj, separators=(",", ":")).encode("utf-8")
    return pack(header, payload)


def unpack_control(blob: bytes) -> Tuple[dict, dict]:
    header, payload = unpack(blob)
    if header.get("kind") != "control":
        raise ValueError(f"expected kind=control, got {header.get('kind')}")
    try:
        obj = json.loads(payload.decode("utf-8")) if payload else {}
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise ValueError(f"invalid control payload JSON: {e}") from e
    if not isinstance(obj, dict):
        raise ValueError("control payload must decode to an object")
    return header, obj


__all__ = [
    "pack",
    "unpack",
    "pack_tensor",
    "unpack_tensor",
    "pack_token",
    "unpack_token",
    "pack_control",
    "unpack_control",
]
