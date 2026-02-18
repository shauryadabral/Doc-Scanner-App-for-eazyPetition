import cv2
import numpy as np

from core.config import settings
from .deskew import deskew_image


def limit_image_size(image: np.ndarray) -> np.ndarray:
  h, w = image.shape[:2]
  max_dim = settings.max_image_dimension
  scale = min(max_dim / max(h, w), 1.0)
  if scale >= 1.0:
    return image
  new_size = (int(w * scale), int(h * scale))
  return cv2.resize(image, new_size, interpolation=cv2.INTER_AREA)


def to_grayscale(image_bgr: np.ndarray) -> np.ndarray:
  return cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)


def apply_clahe(gray: np.ndarray) -> np.ndarray:
  clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
  return clahe.apply(gray)


def adaptive_threshold(gray: np.ndarray) -> np.ndarray:
  return cv2.adaptiveThreshold(
    gray,
    255,
    cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv2.THRESH_BINARY,
    35,
    10,
  )


def remove_noise(binary: np.ndarray) -> np.ndarray:
  kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
  opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
  return opened


def sharpen(image: np.ndarray) -> np.ndarray:
  kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32)
  return cv2.filter2D(image, -1, kernel)


def enhance_for_ocr(image_bgr: np.ndarray) -> np.ndarray:
  resized = limit_image_size(image_bgr)
  gray = to_grayscale(resized)
  contrasted = apply_clahe(gray)
  deskewed = deskew_image(contrasted)
  binary = adaptive_threshold(deskewed)
  denoised = remove_noise(binary)
  sharpened = sharpen(denoised)
  return sharpened
