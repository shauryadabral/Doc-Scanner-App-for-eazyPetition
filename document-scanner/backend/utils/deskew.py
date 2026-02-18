import cv2
import numpy as np


def deskew_image(gray: np.ndarray) -> np.ndarray:
  h, w = gray.shape[:2]
  edges = cv2.Canny(gray, 50, 150, apertureSize=3)
  lines = cv2.HoughLines(edges, 1, np.pi / 180.0, 150)
  if lines is None:
    return gray
  angles = []
  for rho, theta in lines[:, 0]:
    angle = (theta - np.pi / 2) * 180.0 / np.pi
    angles.append(angle)
  if not angles:
    return gray
  median_angle = np.median(angles)
  if abs(median_angle) < 0.5:
    return gray
  center = (w // 2, h // 2)
  M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
  rotated = cv2.warpAffine(
    gray,
    M,
    (w, h),
    flags=cv2.INTER_LINEAR,
    borderMode=cv2.BORDER_REPLICATE,
  )
  return rotated
