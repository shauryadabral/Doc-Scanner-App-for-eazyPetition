import re
from typing import List, Tuple


noise_pattern = re.compile(r"[^0-9A-Za-z@.,:/\-+\s]")


def clean_token(text: str) -> str:
  t = noise_pattern.sub("", text)
  t = re.sub(r"\s+", " ", t)
  return t.strip()


def merge_lines(lines: List[str]) -> List[str]:
  merged = []
  for line in lines:
    s = line.strip()
    if not s:
      continue
    if merged and not merged[-1].endswith((".", "!", "?", ":")):
      merged[-1] = merged[-1] + " " + s
    else:
      merged.append(s)
  return merged


def clean_ocr_lines(
  lines: List[Tuple[str, float]],
  min_conf: float,
) -> str:
  filtered = [t for t, c in lines if c >= min_conf]
  cleaned = [clean_token(t) for t in filtered if clean_token(t)]
  merged = merge_lines(cleaned)
  dedup = []
  seen = set()
  for line in merged:
    key = line.lower()
    if key in seen:
      continue
    seen.add(key)
    dedup.append(line)
  return "\n".join(dedup)
