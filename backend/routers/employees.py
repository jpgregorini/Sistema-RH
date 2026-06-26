from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from database import get_supabase
from models.schemas import EmployeeCreate, EmployeeUpdate
from services.pdf_generator import (
    generate_employee_record_pdf,
    missing_registro_fields,
)
from datetime import date
from uuid import uuid4
import io

router = APIRouter()

# Date-typed columns that need ISO serialization before insert/update.
DATE_FIELDS = ("date_of_birth", "data_admissao", "fgts_opcao_em")


def _serialize_dates(data_dict: dict) -> dict:
    for f in DATE_FIELDS:
        v = data_dict.get(f)
        if isinstance(v, date):
            data_dict[f] = v.isoformat()
    return data_dict


@router.get("")
def list_employees(active_only: bool = True):
    db = get_supabase()
    query = db.table("employees").select("*")
    if active_only:
        query = query.eq("active", True)
    result = query.order("name").execute()
    return result.data


@router.get("/{employee_id}")
def get_employee(employee_id: str):
    db = get_supabase()
    result = (
        db.table("employees")
        .select("*")
        .eq("id", employee_id)
        .single()
        .execute()
    )
    return result.data


@router.post("")
def create_employee(data: EmployeeCreate):
    db = get_supabase()
    emp_data = _serialize_dates(data.model_dump(exclude_none=True))
    emp_data["contract_type"] = data.contract_type.value

    # Link mode: generate a registration token so the employee can fill
    # their personal data via the public link.
    if (data.registration_mode or "manual") == "link":
        emp_data["registration_mode"] = "link"
        emp_data["registration_token"] = uuid4().hex

    result = db.table("employees").insert(emp_data).execute()
    return result.data[0]


@router.put("/{employee_id}")
def update_employee(employee_id: str, data: EmployeeUpdate):
    db = get_supabase()
    emp_data = _serialize_dates(data.model_dump(exclude_none=True))
    if data.contract_type:
        emp_data["contract_type"] = data.contract_type.value

    db.table("employees").update(emp_data).eq("id", employee_id).execute()
    return get_employee(employee_id)


@router.post("/{employee_id}/registration-link")
def generate_registration_link(employee_id: str):
    """Create (or return existing) registration token for the public link."""
    db = get_supabase()
    emp = (
        db.table("employees")
        .select("registration_token")
        .eq("id", employee_id)
        .single()
        .execute()
    ).data
    if not emp:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado.")

    token = emp.get("registration_token")
    if not token:
        token = uuid4().hex
        db.table("employees").update(
            {"registration_token": token, "registration_mode": "link"}
        ).eq("id", employee_id).execute()
    return {"token": token}


@router.get("/{employee_id}/registro-status")
def registro_status(employee_id: str):
    """Whether the document can be generated, plus any missing fields."""
    db = get_supabase()
    emp = (
        db.table("employees").select("*").eq("id", employee_id).single().execute()
    ).data
    if not emp:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado.")
    missing = missing_registro_fields(emp)
    return {
        "can_generate": len(missing) == 0,
        "missing": missing,
        "registration_mode": emp.get("registration_mode"),
        "registration_token": emp.get("registration_token"),
        "registration_submitted_at": emp.get("registration_submitted_at"),
    }


@router.get("/{employee_id}/registro-pdf")
def registro_pdf(employee_id: str):
    db = get_supabase()
    emp = (
        db.table("employees").select("*").eq("id", employee_id).single().execute()
    ).data
    if not emp:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado.")

    missing = missing_registro_fields(emp)
    if missing:
        raise HTTPException(
            status_code=400,
            detail="Campos obrigatórios faltando: " + ", ".join(missing),
        )

    pdf_bytes = generate_employee_record_pdf(emp)
    fname_cpf = (emp.get("cpf") or "").replace(".", "").replace("-", "") or employee_id
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=registro_empregado_{fname_cpf}.pdf"
        },
    )


@router.delete("/{employee_id}")
def delete_employee(employee_id: str):
    db = get_supabase()
    db.table("employees").update({"active": False}).eq("id", employee_id).execute()
    return {"ok": True}
