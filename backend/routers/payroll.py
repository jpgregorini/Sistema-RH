from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from database import get_supabase
from models.schemas import PayrollCalculateRequest
from services.payroll_calc import calculate_payroll
from services.excel_export import generate_payroll_excel
import io

router = APIRouter()


@router.post("/calculate")
def calculate(data: PayrollCalculateRequest):
    result = calculate_payroll(data.person_type.value, data.person_id, data.month)
    return result


@router.post("/generate")
def generate(data: PayrollCalculateRequest):
    db = get_supabase()
    calc = calculate_payroll(data.person_type.value, data.person_id, data.month)

    payroll_data = {
        "person_type": data.person_type.value,
        "person_id": data.person_id,
        "month": data.month,
        "gross_pay": calc["gross_pay"],
        "inss": calc["inss"],
        "total_deductions": calc["total_deductions"],
        "total_advances": calc["total_advances"],
        "net_pay": calc["net_pay"],
        "breakdown": calc["breakdown"],
    }

    # Upsert: update if already exists for this person+month
    result = db.table("payroll").upsert(
        payroll_data,
        on_conflict="person_type,person_id,month",
    ).execute()
    return result.data[0]


@router.get("")
def list_payroll(month: str | None = None):
    db = get_supabase()
    query = db.table("payroll").select("*")
    if month:
        query = query.eq("month", month)
    result = query.order("person_type").execute()

    # Enrich with person details
    enriched = []
    for p in result.data:
        table = "drivers" if p["person_type"] == "driver" else "employees"
        person = (
            db.table(table)
            .select("name, cpf, pix_key, beneficio_alimentacao, beneficio_transporte, beneficio_refeicao")
            .eq("id", p["person_id"])
            .single()
            .execute()
        )
        p["person_name"] = person.data["name"]
        p["person_cpf"] = person.data["cpf"]
        p["pix_key"] = person.data.get("pix_key")
        p["beneficio_alimentacao"] = float(person.data.get("beneficio_alimentacao") or 0)
        p["beneficio_transporte"] = float(person.data.get("beneficio_transporte") or 0)
        p["beneficio_refeicao"] = float(person.data.get("beneficio_refeicao") or 0)
        enriched.append(p)

    return enriched


@router.get("/export")
def export_excel(month: str):
    db = get_supabase()
    payroll_data = (
        db.table("payroll").select("*").eq("month", month).execute()
    ).data

    # Enrich with person details
    for p in payroll_data:
        table = "drivers" if p["person_type"] == "driver" else "employees"
        person = (
            db.table(table)
            .select("name, cpf, pix_key, beneficio_alimentacao, beneficio_transporte, beneficio_refeicao")
            .eq("id", p["person_id"])
            .single()
            .execute()
        )
        p["person_name"] = person.data["name"]
        p["person_cpf"] = person.data["cpf"]
        p["pix_key"] = person.data.get("pix_key")
        p["beneficio_alimentacao"] = float(person.data.get("beneficio_alimentacao") or 0)
        p["beneficio_transporte"] = float(person.data.get("beneficio_transporte") or 0)
        p["beneficio_refeicao"] = float(person.data.get("beneficio_refeicao") or 0)

    excel_bytes = generate_payroll_excel(payroll_data, month)
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=folha_{month}.xlsx"},
    )
