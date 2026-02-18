from typing import List, Tuple
from pydantic import BaseModel


class WordBox(BaseModel):
  text: str
  confidence: float
  box: List[Tuple[float, float]]


class StructuredFields(BaseModel):
  person_name: str | None = None
  person_name_confidence: float | None = None
  date_of_birth: str | None = None
  date_of_birth_confidence: float | None = None
  id_numbers: list[str] = []
  id_numbers_confidence: float | None = None
  address: str | None = None
  address_confidence: float | None = None
  phone_numbers: list[str] = []
  phone_numbers_confidence: float | None = None
  emails: list[str] = []
  emails_confidence: float | None = None
