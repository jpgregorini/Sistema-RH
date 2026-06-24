from fastapi import APIRouter, HTTPException
from database import get_supabase
from models.schemas import ProductDeductionCreate
from datetime import date as date_type

router = APIRouter()


def _get_person(db, person_type: str, person_id: str):
    table = "drivers" if person_type == "driver" else "employees"
    result = (
        db.table(table)
        .select("name, cpf")
        .eq("id", person_id)
        .single()
        .execute()
    )
    return result.data


@router.get("")
def list_deductions(
    person_type: str | None = None,
    person_id: str | None = None,
    month: str | None = None,
):
    db = get_supabase()
    query = db.table("product_deductions").select("*, products(name, price)")
    if person_type:
        query = query.eq("person_type", person_type)
    if person_id:
        query = query.eq("person_id", person_id)
    if month:
        query = query.eq("payroll_month", month)
    result = query.order("deduction_date", desc=True).execute()
    return result.data


@router.post("")
def create_deduction(data: ProductDeductionCreate):
    db = get_supabase()

    product = (
        db.table("products")
        .select("name, price")
        .eq("id", data.product_id)
        .single()
        .execute()
    ).data
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")

    person = _get_person(db, data.person_type.value, data.person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Pessoa não encontrada.")

    deduction_date = data.deduction_date or date_type.today()
    payroll_month = data.payroll_month or deduction_date.strftime("%Y-%m")

    row = {
        "person_type": data.person_type.value,
        "person_id": data.person_id,
        "product_id": data.product_id,
        "quantity": max(1, int(data.quantity or 1)),
        "unit_price": float(product["price"]),
        "deduction_date": deduction_date.isoformat(),
        "payroll_month": payroll_month,
        "notes": data.notes,
        "person_name_snapshot": person.get("name"),
        "person_cpf_snapshot": person.get("cpf"),
        "product_name_snapshot": product.get("name"),
    }
    result = db.table("product_deductions").insert(row).execute()
    return result.data[0]


@router.delete("/{deduction_id}")
def delete_deduction(deduction_id: str):
    db = get_supabase()
    db.table("product_deductions").delete().eq("id", deduction_id).execute()
    return {"ok": True}
