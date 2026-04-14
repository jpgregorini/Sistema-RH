from fastapi import APIRouter, UploadFile, File
from services.document_ai import extract_driver_info

router = APIRouter()


@router.post("/extract-driver-info")
async def extract_info(file: UploadFile = File(...)):
    contents = await file.read()
    content_type = file.content_type or "image/jpeg"
    result = extract_driver_info(contents, content_type)
    return result
