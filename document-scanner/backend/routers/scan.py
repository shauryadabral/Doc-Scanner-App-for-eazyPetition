import base64
import logging

from fastapi import APIRouter, HTTPException

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
