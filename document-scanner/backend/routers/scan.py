import base64
import logging
import urllib.request

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException, UploadFile, File

from models.request_models import ScanRequest
from models.response_models import ScanResponse
from models.ocr_models import StructuredFields
from services.image_pipeline import process_base64_image
from services.ocr_service import run_ocr
from services.pdf_service import generate_pdf

router = APIRouter(tags=["scan"])
logger = logging.getLogger("scan_router")


@router.post("/scan", response_model=ScanResponse)
def scan_document(payload: ScanRequest):
  try:
    enhanced = process_base64_image(payload.image_base64)
  except ValueError as exc:
    raise HTTPException(status_code=400, detail=str(exc)) from exc
  except Exception as exc:
    logger.exception("Unexpected error during image processing")
    raise HTTPException(
      status_code=500,
      detail=f"Image processing failed: {exc}",
    ) from exc

  try:
    text, words, fields = run_ocr(enhanced)
  except Exception as exc:
    logger.exception("OCR failed")
    text = ""
    words = []
    fields = StructuredFields()

  try:
    pdf_bytes = generate_pdf(enhanced, text, fields)
  except Exception as exc:
    logger.exception("PDF generation failed")
    pdf_bytes = b""

  try:
    pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")
  except Exception as exc:
    logger.exception("Encoding PDF bytes failed")
    raise HTTPException(
      status_code=500,
      detail=f"Encoding failed: {exc}",
    ) from exc

  return ScanResponse(
    text=text,
    words=words,
    fields=fields,
    pdf_base64=pdf_b64,
  )


@router.post("/scan-multipart", response_model=ScanResponse)
async def scan_document_multipart(file: UploadFile = File(...)):
  try:
    data = await file.read()
    arr = np.frombuffer(data, dtype=np.uint8)
    image_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image_bgr is None:
      raise ValueError("Could not decode uploaded image")
  except Exception as exc:
    raise HTTPException(status_code=400, detail=f"Invalid upload: {exc}") from exc

  try:
    from utils.enhancement import enhance_for_ocr
    enhanced = enhance_for_ocr(image_bgr)
  except Exception as exc:
    logger.exception("Image processing failed")
    raise HTTPException(status_code=500, detail=f"Image processing failed: {exc}") from exc

  try:
    text, words, fields = run_ocr(enhanced)
  except Exception as exc:
    logger.exception("OCR failed")
    text = ""
    words = []
    fields = StructuredFields()

  try:
    pdf_bytes = generate_pdf(enhanced, text, fields)
    pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")
  except Exception as exc:
    logger.exception("PDF generation failed")
    pdf_b64 = ""

  return ScanResponse(text=text, words=words, fields=fields, pdf_base64=pdf_b64)


@router.post("/scan-url", response_model=ScanResponse)
def scan_document_url(payload: dict):
  url = payload.get("url")
  if not url or not isinstance(url, str):
    raise HTTPException(status_code=400, detail="Missing 'url' in request body")
  try:
    with urllib.request.urlopen(url, timeout=15) as resp:
      content_type = resp.headers.get("Content-Type", "")
      if "image" not in content_type:
        raise ValueError(f"URL does not point to an image (Content-Type: {content_type})")
      data = resp.read()
    arr = np.frombuffer(data, dtype=np.uint8)
    image_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image_bgr is None:
      raise ValueError("Could not decode image from URL")
  except Exception as exc:
    raise HTTPException(status_code=400, detail=f"Failed to download image: {exc}") from exc

  try:
    from utils.enhancement import enhance_for_ocr
    enhanced = enhance_for_ocr(image_bgr)
  except Exception as exc:
    logger.exception("Image processing failed")
    raise HTTPException(status_code=500, detail=f"Image processing failed: {exc}") from exc

  try:
    text, words, fields = run_ocr(enhanced)
  except Exception as exc:
    logger.exception("OCR failed")
    text = ""
    words = []
    fields = StructuredFields()

  try:
    pdf_bytes = generate_pdf(enhanced, text, fields)
    pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")
  except Exception as exc:
    logger.exception("PDF generation failed")
    pdf_b64 = ""

  return ScanResponse(text=text, words=words, fields=fields, pdf_base64=pdf_b64)
