import base64


def validate_base64_image(data: str) -> bytes:
  if len(data) > 15000000:
    raise ValueError("Image too large")
  try:
    return base64.b64decode(data, validate=True)
  except Exception as exc:
    raise ValueError("Invalid base64 image") from exc
