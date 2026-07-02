from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from database import get_supabase
from models.schemas import EmployeeRegistrationPublic
from services.pdf_generator import EMPLOYER
from datetime import datetime, date

router = APIRouter()

# Only these fields can be read/written through the public link.
PUBLIC_FIELDS = [
    "name", "cpf", "email", "pix_key", "date_of_birth", "residencia",
    "local_nascimento", "pais_nacionalidade", "estado_civil", "filiacao_pai",
    "filiacao_mae", "orgao_emissor", "grau_instrucao", "sexo", "cor",
    "deficiencia", "telefone_residencial", "telefone_celular",
    # Documents (optional)
    "cedula_identidade", "rg_data_emissao", "titulo_eleitoral", "titulo_zona",
    "titulo_secao", "inscr_orgao_classe", "ctps", "ctps_serie",
    "ctps_data_expedicao", "ctps_uf", "cnh", "cnh_categoria", "doc_militar",
    "doc_militar_categoria",
    # PIS / bank (optional)
    "pis_cadastrado_em", "pis_sob_n", "pis_domicilio_bancario", "pis_n_banco",
    "pis_agencia_codigo", "pis_end_agencia",
]

# Document kinds the employee can upload -> employee column.
DOC_COLUMNS = {
    "comprovante_endereco": "doc_comprovante_endereco_url",
    "rg_cnh": "doc_rg_cnh_url",
    "foto": "photo_url",
}


def _find_by_token(db, token: str) -> dict:
    res = (
        db.table("employees")
        .select("*")
        .eq("registration_token", token)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Link inválido ou expirado.")
    return res.data[0]


@router.get("/{token}")
def get_registration(token: str):
    db = get_supabase()
    emp = _find_by_token(db, token)
    return {
        "employer": EMPLOYER,
        "submitted_at": emp.get("registration_submitted_at"),
        "fields": {k: emp.get(k) for k in PUBLIC_FIELDS},
        "documents": {kind: emp.get(col) for kind, col in DOC_COLUMNS.items()},
    }


@router.put("/{token}")
def submit_registration(token: str, data: EmployeeRegistrationPublic):
    db = get_supabase()
    emp = _find_by_token(db, token)

    update = data.model_dump(exclude_none=True)
    if isinstance(update.get("date_of_birth"), date):
        update["date_of_birth"] = update["date_of_birth"].isoformat()
    update = {k: v for k, v in update.items() if k in PUBLIC_FIELDS}
    update["registration_submitted_at"] = datetime.utcnow().isoformat()

    db.table("employees").update(update).eq("id", emp["id"]).execute()
    return {"ok": True}


@router.post("/{token}/document")
async def upload_document(
    token: str,
    kind: str = Form(...),
    file: UploadFile = File(...),
):
    if kind not in DOC_COLUMNS:
        raise HTTPException(status_code=400, detail="Tipo de documento inválido.")

    db = get_supabase()
    emp = _find_by_token(db, token)

    contents = await file.read()
    ext = (file.filename or "").split(".")[-1].lower() or "bin"
    path = f"emp_{emp['id']}/{kind}_{int(datetime.utcnow().timestamp())}.{ext}"

    db.storage.from_("documents").upload(
        path,
        contents,
        {"content-type": file.content_type or "application/octet-stream"},
    )
    public_url = db.storage.from_("documents").get_public_url(path)

    db.table("employees").update(
        {DOC_COLUMNS[kind]: public_url}
    ).eq("id", emp["id"]).execute()

    return {"kind": kind, "url": public_url}
