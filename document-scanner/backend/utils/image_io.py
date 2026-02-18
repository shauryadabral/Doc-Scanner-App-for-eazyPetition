import io
from typing import Tuple

import cv2
import numpy as np

from .security import validate_base64_image


def decode_image_from_base64(data: str) -> np.ndarray:
  raw = validate_base64_image(data)
  arr = np.frombuffer(raw, dtype=np.uint8)
  image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
  if image is None:
    raise ValueError("Could not decode image")
  return image


def encode_jpeg(image: np.ndarray) -> bytes:
  ok, buf = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
  if not ok:
    raise ValueError("Failed to encode image")
  return buf.tobytes()


def strip_exif(jpeg_bytes: bytes) -> bytes:
  bio = io.BytesIO(jpeg_bytes)
  data = bio.read()
  return data
