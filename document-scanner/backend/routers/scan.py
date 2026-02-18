import base64

from fastapi import APIRouter, HTTPException

from models.request_models import ScanRequest
from models.response_models import ScanResponse
from services.image_pipeline import process_base64_image
from services.ocr_service import run_ocr
from services.pdf_service import generate_pdf

router = APIRouter(tags=["scan"])


@router.post("/scan", response_model=ScanResponse)
def scan_document(payload: ScanRequest):
  try:
    enhanced = process_base64_image(payload.image_base64)
    text, words, fields = run_ocr(enhanced)
    pdf_bytes = generate_pdf(enhanced, text, fields)
    pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")
    return ScanResponse(
      text=text,
      words=words,
      fields=fields,
      pdf_base64=pdf_b64,
    )
  except ValueError as exc:
    raise HTTPException(status_code=400, detail=str(exc)) from exc
  except Exception:
    raise HTTPException(status_code=500, detail="Internal error")
