from typing import List
from pydantic import BaseModel
from .ocr_models import WordBox, StructuredFields


class ScanResponse(BaseModel):
  text: str
  words: List[WordBox]
  fields: StructuredFields
  pdf_base64: str
