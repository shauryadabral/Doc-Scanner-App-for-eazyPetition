import numpy as np

from utils.image_io import decode_image_from_base64
from utils.enhancement import enhance_for_ocr


def process_base64_image(data: str) -> np.ndarray:
  image_bgr = decode_image_from_base64(data)
  enhanced = enhance_for_ocr(image_bgr)
  return enhanced
