from io import BytesIO
from datetime import datetime

import cv2
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
import numpy as np

from models.ocr_models import StructuredFields


def generate_pdf(
  enhanced_image: np.ndarray,
  text: str,
  fields: StructuredFields,
) -> bytes:
  buffer = BytesIO()
  c = canvas.Canvas(buffer, pagesize=A4)
  page_width, page_height = A4

  ok, encoded = cv2.imencode(".jpg", enhanced_image)
  if not ok:
    raise ValueError("Failed to encode image for PDF")
  img_bytes = encoded.tobytes()
  img_reader = ImageReader(BytesIO(img_bytes))

  img_width, img_height = img_reader.getSize()
  scale = min(
    page_width * 0.9 / img_width,
    page_height * 0.45 / img_height,
  )
  draw_width = img_width * scale
  draw_height = img_height * scale
  x = (page_width - draw_width) / 2
  y = page_height - draw_height - 40
  c.drawImage(img_reader, x, y, draw_width, draw_height)

  c.setFont("Helvetica-Bold", 12)
  c.drawString(40, y - 20, "Structured Fields")
  c.setFont("Helvetica", 9)
  t = c.beginText(40, y - 36)
  if fields.person_name:
    t.textLine(f"Name: {fields.person_name}")
  if fields.date_of_birth:
    t.textLine(f"DOB: {fields.date_of_birth}")
  if fields.id_numbers:
    t.textLine(f"ID: {', '.join(fields.id_numbers)}")
  if fields.phone_numbers:
    t.textLine(f"Phone: {', '.join(fields.phone_numbers)}")
  if fields.emails:
    t.textLine(f"Email: {', '.join(fields.emails)}")
  if fields.address:
    t.textLine(f"Address: {fields.address}")
  c.drawText(t)

  c.setFont("Helvetica-Bold", 12)
  c.drawString(40, 180, "Raw OCR Text")
  c.setFont("Helvetica", 9)
  text_obj = c.beginText(40, 164)
  for line in text.splitlines():
    text_obj.textLine(line)
  c.drawText(text_obj)

  c.setFont("Helvetica", 8)
  ts = datetime.utcnow().isoformat() + "Z"
  c.drawString(40, 40, f"Scanned at: {ts}")

  c.showPage()
  c.save()
  return buffer.getvalue()
