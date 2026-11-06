"""Demo photo intake endpoint. Validates image files but does not run visual AI."""
from io import BytesIO
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from PIL import Image, UnidentifiedImageError

router = APIRouter(tags=["Photo intake - DEMO"])
MAX_BYTES = 10 * 1024 * 1024

@router.post("/imagem/analisar")
async def analisar_imagem(foto: UploadFile = File(...), produto_declarado: str = Form(...)):
    """Accept a photo and report basic format and resolution checks only."""
    content = await foto.read()
    if not content or len(content) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Image is empty or exceeds 10 MB.")
    try:
        image = Image.open(BytesIO(content))
        image.verify()
        image = Image.open(BytesIO(content))
        width, height = image.size
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid image file.")
    if image.format not in ("JPEG", "PNG", "WEBP"):
        raise HTTPException(status_code=400, detail="Unsupported image format.")
    product = produto_declarado.strip()
    if not product:
        raise HTTPException(status_code=422, detail="Declare a product name.")
    quality = "resolucao_baixa" if min(width, height) < 300 else "resolucao_adequada"
    return {
        "ambiente": "DEMONSTRACAO", "modo": "simulado_sem_ia",
        "status": "compatibilidade_simulada", "produto_declarado": product,
        "produto_aparentemente_compativel": None, "qualidade_imagem": quality,
        "dimensoes": {"largura": width, "altura": height},
        "autenticidade_verificada": False, "gps_verificado_pela_imagem": False,
        "pode_emitir_token": False,
        "motivo": "Image received successfully. Product compatibility was not assessed by AI.",
        "recomendacao": "Continue the demonstration flow; do not treat this result as a real validation."
    }
