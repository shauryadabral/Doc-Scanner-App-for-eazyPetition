from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.scan import router as scan_router

app = FastAPI()

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

app.include_router(scan_router, prefix="/api")


@app.get("/health")
def health():
  return {"status": "ok"}
