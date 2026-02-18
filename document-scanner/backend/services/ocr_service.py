from typing import List, Tuple

import numpy as np
from paddleocr import PaddleOCR

from core.config import settings
from models.ocr_models import WordBox
from . import text_cleaner, field_extractor


ocr_engine = PaddleOCR(
  use_angle_cls=True,
  lang="en",
)


def run_ocr(image: np.ndarray):
  result = ocr_engine.ocr(image, cls=True)
  lines: List[Tuple[str, float]] = []
  words: List[WordBox] = []
  for block in result:
    for line in block:
      box = line[0]
      text, conf = line[1]
      lines.append((text, float(conf)))
      words.append(
        WordBox(
          text=text,
          confidence=float(conf),
          box=[(float(x), float(y)) for x, y in box],
        )
      )
  cleaned_text = text_cleaner.clean_ocr_lines(
    lines,
    min_conf=settings.ocr_min_confidence,
  )
  fields = field_extractor.extract_fields(lines)
  return cleaned_text, words, fields
