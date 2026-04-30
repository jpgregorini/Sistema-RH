from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from database import get_supabase
from models.schemas import AdvanceCreate
from services.pdf_generator import generate_advance_pdf
from datetime import date as date_type
from uuid import uuid4
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


def _add_months(month: str, n: int) -> str:
    """Return YYYY-MM advanced by `n` months."""
    y, m = month.split("-")
    y_i, m_i = int(y), int(m)
    total = (y_i * 12 + (m_i - 1)) + n
    new_y, new_m = divmod(total, 12)
    return f"{new_y:04d}-{new_m + 1:02d}"


def _split_amount(total: float, n: int) -> list[float]:
    """Split `total` into `n` parts, with cents rounded; remainder lands on last."""
    if n <= 1:
        return [round(total, 2)]
    base = round(total / n, 2)
    parts = [base] * (n - 1)
    parts.append(round(total - base * (n - 1), 2))
    return parts


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
    base_payroll_month = data.payroll_month or advance_date.strftime("%Y-%m")
    person = _get_person(db, data.person_type.value, data.person_id)

    n_installments = max(1, min(int(data.installments or 1), 10))
    parts = _split_amount(float(data.amount), n_installments)
    months = [_add_months(base_payroll_month, i) for i in range(n_installments)]
    schedule = [
        {"index": i + 1, "amount": parts[i], "payroll_month": months[i]}
        for i in range(n_installments)
    ]

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

        # Validate each installment month independently against the monthly benefit limit
        for inst in schedule:
            month_advances = _get_month_advances(
                db, data.person_type.value, data.person_id, inst["payroll_month"]
            )
            used = sum(
                float(a["amount"])
                for a in month_advances
                if a["advance_type"] == "beneficio" and a.get("beneficio_category") == category
            )
            available = limit - used
            if inst["amount"] > available:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Saldo insuficiente em {category} para {inst['payroll_month']}. "
                        f"Disponível: R$ {available:.2f}"
                    ),
                )

    elif data.advance_type.value == "salario":
        base_salary = float(person.get("base_salary") or 0)
        if data.person_type.value == "employee":
            if base_salary <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="Funcionário não possui salário base cadastrado.",
                )
        if base_salary > 0:
            for inst in schedule:
                month_advances = _get_month_advances(
                    db, data.person_type.value, data.person_id, inst["payroll_month"]
                )
                used = sum(
                    float(a["amount"])
                    for a in month_advances
                    if a["advance_type"] == "salario"
                )
                available = base_salary - used
                if inst["amount"] > available:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Valor excede o saldo disponível do salário em "
                            f"{inst['payroll_month']}. Disponível: R$ {available:.2f}"
                        ),
                    )

    elif data.advance_type.value == "produtos":
        if not data.product_name or not data.product_name.strip():
            raise HTTPException(
                status_code=400,
                detail="Nome do produto é obrigatório para adiantamento do tipo produtos.",
            )

    # --- Generate PDF (single contract for the whole amount) ---
    pdf_bytes = generate_advance_pdf(
        name=person["name"],
        cpf=person["cpf"],
        amount=float(data.amount),
        advance_date=advance_date,
        payday=person["payday"],
        payroll_month=base_payroll_month,
        installments=schedule if n_installments > 1 else None,
    )

    suffix = f"_p{n_installments}" if n_installments > 1 else ""
    filename = (
        f"adiantamento_{person['cpf'].replace('.','').replace('-','')}_"
        f"{advance_date.isoformat()}{suffix}.pdf"
    )
    db.storage.from_("contracts").upload(
        filename,
        pdf_bytes,
        {"content-type": "application/pdf"},
    )
    pdf_url = db.storage.from_("contracts").get_public_url(filename)

    # --- Insert one row per installment, sharing group id and contract URL ---
    group_id = str(uuid4()) if n_installments > 1 else None
    rows = []
    for inst in schedule:
        row = {
            "person_type": data.person_type.value,
            "person_id": data.person_id,
            "advance_type": data.advance_type.value,
            "amount": inst["amount"],
            "advance_date": advance_date.isoformat(),
            "contract_pdf_url": pdf_url,
            "payroll_month": inst["payroll_month"],
            "notes": data.notes,
            "person_name_snapshot": person.get("name"),
            "person_cpf_snapshot": person.get("cpf"),
        }
        if data.beneficio_category:
            row["beneficio_category"] = data.beneficio_category.value
        if data.product_name:
            row["product_name"] = data.product_name
        if group_id:
            row["installment_group_id"] = group_id
            row["installment_index"] = inst["index"]
            row["installment_total"] = n_installments
        rows.append(row)

    result = db.table("salary_advances").insert(rows).execute()
    return result.data


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

    name = adv.get("person_name_snapshot")
    cpf = adv.get("person_cpf_snapshot")
    payday = None
    try:
        person = _get_person(db, adv["person_type"], adv["person_id"])
        name = person.get("name") or name
        cpf = person.get("cpf") or cpf
        payday = person.get("payday")
    except Exception:
        pass
    if payday is None:
        payday = 5

    from datetime import date

    # If part of an installment group, rebuild the schedule for the PDF
    schedule = None
    total_amount = float(adv["amount"])
    if adv.get("installment_group_id"):
        siblings = (
            db.table("salary_advances")
            .select("amount, payroll_month, installment_index")
            .eq("installment_group_id", adv["installment_group_id"])
            .order("installment_index")
            .execute()
        ).data
        if siblings:
            schedule = [
                {
                    "index": s["installment_index"],
                    "amount": float(s["amount"]),
                    "payroll_month": s["payroll_month"],
                }
                for s in siblings
            ]
            total_amount = sum(s["amount"] for s in schedule)

    pdf_bytes = generate_advance_pdf(
        name=name or "—",
        cpf=cpf or "—",
        amount=total_amount,
        advance_date=date.fromisoformat(adv["advance_date"]),
        payday=payday,
        payroll_month=adv["payroll_month"],
        installments=schedule if schedule and len(schedule) > 1 else None,
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
