from fastapi import APIRouter, HTTPException
from database import get_supabase
from models.schemas import EmployeeRegistrationPublic
from services.pdf_generator import EMPLOYER
from datetime import datetime, date

router = APIRouter()

# Only these fields can be read/written through the public link.
PUBLIC_FIELDS = [
    "name", "cpf", "pix_key", "date_of_birth", "residencia", "local_nascimento",
    "pais_nacionalidade", "estado_civil", "filiacao_pai", "filiacao_mae",
    "orgao_emissor", "grau_instrucao", "sexo", "cor", "deficiencia",
    "telefone_residencial", "telefone_celular",
]


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
    }


@router.put("/{token}")
def submit_registration(token: str, data: EmployeeRegistrationPublic):
    db = get_supabase()
    emp = _find_by_token(db, token)

    update = data.model_dump(exclude_none=True)
    # Serialize date
    if isinstance(update.get("date_of_birth"), date):
        update["date_of_birth"] = update["date_of_birth"].isoformat()
    # Guard: only public fields
    update = {k: v for k, v in update.items() if k in PUBLIC_FIELDS}
    update["registration_submitted_at"] = datetime.utcnow().isoformat()

    db.table("employees").update(update).eq("id", emp["id"]).execute()
    return {"ok": True}
