from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from database import get_supabase
from models.schemas import AdvanceCreate
from services.pdf_generator import generate_advance_pdf
from datetime import date as date_type
import io

router = APIRouter()


def _get_person(db, person_type: str, person_id: str):
    table = "drivers" if person_type == "driver" else "employees"
    result = (
        db.table(table)
        .select("name, cpf, payday, base_salary, beneficio_alimentacao, beneficio_transporte, beneficio_refeicao")
        .eq("id", person_id)
        .single()
        .execute()
    )
    return result.data


def _get_month_advances(db, person_type: str, person_id: str, payroll_month: str):
    """Get all advances for a person in a given month."""
    result = (
        db.table("salary_advances")
        .select("*")
        .eq("person_type", person_type)
        .eq("person_id", person_id)
        .eq("payroll_month", payroll_month)
        .execute()
    )
    return result.data


BENEFICIO_COLUMN_MAP = {
    "alimentacao": "beneficio_alimentacao",
    "transporte": "beneficio_transporte",
    "refeicao": "beneficio_refeicao",
}


@router.get("")
def list_advances(
    person_type: str | None = None,
    person_id: str | None = None,
    month: str | None = None,
    advance_type: str | None = None,
):
    db = get_supabase()
    query = db.table("salary_advances").select("*")
    if person_type:
        query = query.eq("person_type", person_type)
    if person_id:
        query = query.eq("person_id", person_id)
    if month:
        query = query.eq("payroll_month", month)
    if advance_type:
        query = query.eq("advance_type", advance_type)
    result = query.order("advance_date", desc=True).execute()
    return result.data


@router.post("")
def create_advance(data: AdvanceCreate):
    db = get_supabase()

    advance_date = data.advance_date or date_type.today()
    payroll_month = data.payroll_month or advance_date.strftime("%Y-%m")
    person = _get_person(db, data.person_type.value, data.person_id)

    # --- Validation per advance type ---

    if data.advance_type.value == "beneficio":
        if not data.beneficio_category:
            raise HTTPException(
                status_code=400,
                detail="beneficio_category é obrigatório para adiantamento do tipo benefício.",
            )
        category = data.beneficio_category.value
        column = BENEFICIO_COLUMN_MAP[category]
        limit = float(person.get(column) or 0)

        # Sum existing beneficio advances in this category for the month
        month_advances = _get_month_advances(
            db, data.person_type.value, data.person_id, payroll_month
        )
        used = sum(
            float(a["amount"])
            for a in month_advances
            if a["advance_type"] == "beneficio" and a.get("beneficio_category") == category
        )
        available = limit - used
        if data.amount > available:
            raise HTTPException(
                status_code=400,
                detail=f"Saldo insuficiente em {category}. Disponível: R$ {available:.2f}",
            )

    elif data.advance_type.value == "salario":
        if data.person_type.value == "employee":
            base_salary = float(person.get("base_salary") or 0)
            if base_salary <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="Funcionário não possui salário base cadastrado.",
                )
            month_advances = _get_month_advances(
                db, data.person_type.value, data.person_id, payroll_month
            )
            used = sum(
                float(a["amount"])
                for a in month_advances
                if a["advance_type"] == "salario"
            )
            available = base_salary - used
            if data.amount > available:
                raise HTTPException(
                    status_code=400,
                    detail=f"Valor excede o saldo disponível do salário. Disponível: R$ {available:.2f}",
                )

    elif data.advance_type.value == "produtos":
        if not data.product_name or not data.product_name.strip():
            raise HTTPException(
                status_code=400,
                detail="Nome do produto é obrigatório para adiantamento do tipo produtos.",
            )

    # --- Generate PDF ---
    pdf_bytes = generate_advance_pdf(
        name=person["name"],
        cpf=person["cpf"],
        amount=data.amount,
        advance_date=advance_date,
        payday=person["payday"],
        payroll_month=payroll_month,
    )

    filename = f"adiantamento_{person['cpf'].replace('.','').replace('-','')}_{advance_date.isoformat()}.pdf"
    db.storage.from_("contracts").upload(
        filename,
        pdf_bytes,
        {"content-type": "application/pdf"},
    )
    pdf_url = db.storage.from_("contracts").get_public_url(filename)

    # --- Insert ---
    advance_data = {
        "person_type": data.person_type.value,
        "person_id": data.person_id,
        "advance_type": data.advance_type.value,
        "amount": data.amount,
        "advance_date": advance_date.isoformat(),
        "contract_pdf_url": pdf_url,
        "payroll_month": payroll_month,
        "notes": data.notes,
    }
    if data.beneficio_category:
        advance_data["beneficio_category"] = data.beneficio_category.value
    if data.product_name:
        advance_data["product_name"] = data.product_name

    result = db.table("salary_advances").insert(advance_data).execute()
    return result.data[0]


@router.get("/{advance_id}/pdf")
def download_advance_pdf(advance_id: str):
    db = get_supabase()
    advance = (
        db.table("salary_advances")
        .select("*")
        .eq("id", advance_id)
        .single()
        .execute()
    )
    adv = advance.data
    person = _get_person(db, adv["person_type"], adv["person_id"])

    from datetime import date

    pdf_bytes = generate_advance_pdf(
        name=person["name"],
        cpf=person["cpf"],
        amount=float(adv["amount"]),
        advance_date=date.fromisoformat(adv["advance_date"]),
        payday=person["payday"],
        payroll_month=adv["payroll_month"],
    )

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=adiantamento_{advance_id}.pdf"},
    )


@router.put("/{advance_id}/upload-signed")
def upload_signed_contract(advance_id: str, signed_contract_url: str):
    db = get_supabase()
    db.table("salary_advances").update(
        {"signed_contract_url": signed_contract_url}
    ).eq("id", advance_id).execute()
    return {"ok": True}


@router.delete("/{advance_id}")
def delete_advance(advance_id: str):
    db = get_supabase()
    db.table("salary_advances").delete().eq("id", advance_id).execute()
    return {"ok": True}
