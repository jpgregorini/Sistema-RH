from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from database import get_supabase
from models.schemas import PayrollCalculateRequest, PayrollUpdate
from services.payroll_calc import calculate_payroll
from services.excel_export import generate_payroll_excel
from services.pdf_generator import generate_benefit_receipt_pdf
from datetime import date as date_type
import io

router = APIRouter()


def _enrich(db, payroll_rows: list[dict]) -> list[dict]:
    """Enrich payroll rows with person details, falling back to snapshot when person no longer exists."""
    driver_ids = list({p["person_id"] for p in payroll_rows if p["person_type"] == "driver"})
    employee_ids = list({p["person_id"] for p in payroll_rows if p["person_type"] == "employee"})

    drivers_by_id: dict[str, dict] = {}
    if driver_ids:
        res = (
            db.table("drivers")
            .select("id, name, cpf, pix_key, beneficio_alimentacao, beneficio_transporte, beneficio_refeicao")
            .in_("id", driver_ids)
            .execute()
        )
        drivers_by_id = {d["id"]: d for d in (res.data or [])}

    employees_by_id: dict[str, dict] = {}
    if employee_ids:
        res = (
            db.table("employees")
            .select("id, name, cpf, pix_key, beneficio_alimentacao, beneficio_transporte, beneficio_refeicao")
            .in_("id", employee_ids)
            .execute()
        )
        employees_by_id = {e["id"]: e for e in (res.data or [])}

    enriched = []
    for p in payroll_rows:
        lookup = drivers_by_id if p["person_type"] == "driver" else employees_by_id
        person = lookup.get(p["person_id"])
        if person:
            p["person_name"] = person.get("name") or p.get("person_name_snapshot") or ""
            p["person_cpf"] = person.get("cpf") or p.get("person_cpf_snapshot") or ""
            p["pix_key"] = person.get("pix_key")
            p["beneficio_alimentacao"] = float(person.get("beneficio_alimentacao") or 0)
            p["beneficio_transporte"] = float(person.get("beneficio_transporte") or 0)
            p["beneficio_refeicao"] = float(person.get("beneficio_refeicao") or 0)
        else:
            p["person_name"] = p.get("person_name_snapshot") or ""
            p["person_cpf"] = p.get("person_cpf_snapshot") or ""
            p["pix_key"] = (p.get("breakdown") or {}).get("pix_key")
            benefit = (p.get("breakdown") or {}).get("benefit") or {}
            p["beneficio_alimentacao"] = float(benefit.get("alimentacao_valor") or 0)
            p["beneficio_transporte"] = float(benefit.get("transporte_valor") or 0)
            p["beneficio_refeicao"] = float(benefit.get("refeicao_valor") or 0)
        enriched.append(p)
    return enriched


@router.post("/calculate")
def calculate(data: PayrollCalculateRequest):
    return calculate_payroll(data.person_type.value, data.person_id, data.month)


@router.post("/generate")
def generate(data: PayrollCalculateRequest):
    """Generate or update a payroll record.

    scope='all'      → write everything (gross_pay, inss, advances, breakdown including benefit)
    scope='salary'   → write only salary-related fields; preserve breakdown.benefit if present
    scope='benefits' → write only the benefit slice; preserve gross_pay/inss/advances if present
    """
    db = get_supabase()
    scope = (data.scope or "all").lower()
    if scope not in ("all", "salary", "benefits"):
        raise HTTPException(status_code=400, detail="scope inválido")

    calc = calculate_payroll(data.person_type.value, data.person_id, data.month)

    table = "drivers" if data.person_type.value == "driver" else "employees"
    person = (
        db.table(table)
        .select("name, cpf")
        .eq("id", data.person_id)
        .single()
        .execute()
    ).data

    # Try to load existing row so partial updates can preserve the other slice
    existing = (
        db.table("payroll")
        .select("*")
        .eq("person_type", data.person_type.value)
        .eq("person_id", data.person_id)
        .eq("month", data.month)
        .limit(1)
        .execute()
    ).data
    existing_row = existing[0] if existing else None
    existing_breakdown = (existing_row or {}).get("breakdown") or {}

    # Always-fresh fields for any scope
    payroll_data: dict = {
        "person_type": data.person_type.value,
        "person_id": data.person_id,
        "month": data.month,
        "person_name_snapshot": person.get("name") if person else None,
        "person_cpf_snapshot": person.get("cpf") if person else None,
    }

    new_breakdown = dict(calc["breakdown"])

    if scope == "salary":
        # Preserve existing benefit slice if present
        if "benefit" in existing_breakdown:
            new_breakdown["benefit"] = existing_breakdown["benefit"]
        payroll_data.update({
            "gross_pay": calc["gross_pay"],
            "inss": calc["inss"],
            "total_deductions": calc["total_deductions"],
            "total_advances": calc["total_advances"],
            "net_pay": calc["net_pay"],
            "breakdown": new_breakdown,
        })
        # Defaults for required NOT NULL columns when inserting a brand-new row
        if not existing_row:
            payroll_data.setdefault("gross_pay", calc["gross_pay"])

    elif scope == "benefits":
        # Preserve everything else from existing row; only update the benefit breakdown
        if existing_row:
            preserved = dict(existing_breakdown)
            preserved["benefit"] = calc["breakdown"].get("benefit")
            payroll_data.update({
                "gross_pay": existing_row["gross_pay"],
                "inss": existing_row.get("inss", 0),
                "total_deductions": existing_row.get("total_deductions", 0),
                "total_advances": existing_row.get("total_advances", 0),
                "net_pay": existing_row.get("net_pay", 0),
                "breakdown": preserved,
            })
        else:
            # No prior row — store benefit slice and zeros for salary fields
            empty_with_benefit = {"benefit": calc["breakdown"].get("benefit")}
            payroll_data.update({
                "gross_pay": 0,
                "inss": 0,
                "total_deductions": 0,
                "total_advances": 0,
                "net_pay": 0,
                "breakdown": empty_with_benefit,
            })

    else:  # all
        payroll_data.update({
            "gross_pay": calc["gross_pay"],
            "inss": calc["inss"],
            "total_deductions": calc["total_deductions"],
            "total_advances": calc["total_advances"],
            "net_pay": calc["net_pay"],
            "breakdown": new_breakdown,
        })

    # Upsert. `included_salary` and `included_benefits` are intentionally not in
    # the payload so existing toggles persist on recalc.
    result = db.table("payroll").upsert(
        payroll_data,
        on_conflict="person_type,person_id,month",
    ).execute()
    return result.data[0]


@router.patch("/{payroll_id}")
def update_payroll(payroll_id: str, data: PayrollUpdate):
    db = get_supabase()
    update: dict = {}
    if data.included_salary is not None:
        update["included_salary"] = data.included_salary
    if data.included_benefits is not None:
        update["included_benefits"] = data.included_benefits
    if not update:
        raise HTTPException(status_code=400, detail="Nada para atualizar.")
    result = (
        db.table("payroll")
        .update(update)
        .eq("id", payroll_id)
        .execute()
    )
    return result.data[0] if result.data else {"ok": True}


@router.get("")
def list_payroll(month: str | None = None):
    db = get_supabase()
    query = db.table("payroll").select("*")
    if month:
        query = query.eq("month", month)
    result = query.order("person_type").execute()
    return _enrich(db, result.data)


BENEFIT_CATEGORIES = {"alimentacao", "transporte", "refeicao"}


@router.get("/{payroll_id}/benefit-receipt")
def benefit_receipt(payroll_id: str, category: str):
    """Generate a PDF receipt for a single benefit category of a payroll row."""
    if category not in BENEFIT_CATEGORIES:
        raise HTTPException(status_code=400, detail="Categoria inválida.")

    db = get_supabase()
    row = (
        db.table("payroll")
        .select("*")
        .eq("id", payroll_id)
        .single()
        .execute()
    ).data
    if not row:
        raise HTTPException(status_code=404, detail="Folha não encontrada.")

    enriched = _enrich(db, [row])[0]
    breakdown = enriched.get("breakdown") or {}
    benefit = breakdown.get("benefit") or {}
    value = float(benefit.get(f"{category}_valor") or enriched.get(f"beneficio_{category}") or 0)
    if value <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"Colaborador não possui valor de {category} cadastrado.",
        )

    pdf_bytes = generate_benefit_receipt_pdf(
        name=enriched.get("person_name") or "—",
        cpf=enriched.get("person_cpf") or "—",
        pix_key=enriched.get("pix_key"),
        category=category,
        amount=value,
        payment_date=date_type.today(),
        payroll_month=enriched["month"],
    )
    fname_cpf = (enriched.get("person_cpf") or "").replace(".", "").replace("-", "") or payroll_id
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f"inline; filename=comprovante_{category}_{fname_cpf}_{enriched['month']}.pdf"
            )
        },
    )


@router.get("/export")
def export_excel(month: str, type: str = "all"):
    """Export payroll. type: 'salary', 'benefits', or 'all'."""
    db = get_supabase()
    query = db.table("payroll").select("*").eq("month", month)
    if type == "salary":
        query = query.eq("included_salary", True)
    elif type == "benefits":
        query = query.eq("included_benefits", True)
    rows = query.execute().data

    payroll_data = _enrich(db, rows)

    excel_bytes = generate_payroll_excel(payroll_data, month, sheet_type=type)
    suffix = "" if type == "all" else f"_{type}"
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=folha{suffix}_{month}.xlsx"},
    )
