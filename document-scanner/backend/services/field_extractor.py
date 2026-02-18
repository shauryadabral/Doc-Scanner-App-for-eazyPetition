import re
from typing import List, Tuple

from models.ocr_models import StructuredFields


name_pattern = re.compile(r"\b([A-Z][a-z]+(?: [A-Z][a-z]+)+)\b")
dob_pattern = re.compile(
  r"\b(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2})\b"
)
id_pattern = re.compile(r"\b([A-Z0-9]{6,})\b")
phone_pattern = re.compile(r"\b(\+?\d{10,13})\b")
email_pattern = re.compile(r"\b[a-zA-Z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")


def average_confidence(matches: List[Tuple[str, float]]) -> float | None:
  if not matches:
    return None
  return sum(c for _, c in matches) / len(matches)


def extract_fields(lines: List[Tuple[str, float]]) -> StructuredFields:
  text = "\n".join(t for t, _ in lines)
  name_matches = []
  dob_matches = []
  id_matches = []
  phone_matches = []
  email_matches = []
  for t, c in lines:
    for m in name_pattern.findall(t):
      name_matches.append((m, c))
    for m in dob_pattern.findall(t):
      dob_matches.append((m, c))
    for m in id_pattern.findall(t):
      id_matches.append((m, c))
    for m in phone_pattern.findall(t):
      phone_matches.append((m, c))
    for m in email_pattern.findall(t):
      email_matches.append((m, c))

  person_name = name_matches[0][0] if name_matches else None
  date_of_birth = dob_matches[0][0] if dob_matches else None
  id_numbers = [m for m, _ in id_matches]
  phone_numbers = [m for m, _ in phone_matches]
  emails = [m for m, _ in email_matches]

  address = None
  address_conf = None
  if "address" in text.lower():
    lines_list = text.splitlines()
    for i, line in enumerate(lines_list):
      if "address" in line.lower() and i + 1 < len(lines_list):
        addr_line = lines_list[i + 1].strip()
        if addr_line:
          address = addr_line
          address_conf = 0.7
          break

  return StructuredFields(
    person_name=person_name,
    person_name_confidence=average_confidence(name_matches),
    date_of_birth=date_of_birth,
    date_of_birth_confidence=average_confidence(dob_matches),
    id_numbers=id_numbers,
    id_numbers_confidence=average_confidence(id_matches),
    address=address,
    address_confidence=address_conf,
    phone_numbers=phone_numbers,
    phone_numbers_confidence=average_confidence(phone_matches),
    emails=emails,
    emails_confidence=average_confidence(email_matches),
  )
