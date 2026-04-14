from fastapi import APIRouter
from database import get_supabase
from models.schemas import DeductionCreate

router = APIRouter()


@router.get("")
def list_deductions(
    person_type: str | None = None,
    person_id: str | None = None,
    month: str | None = None,
):
    db = get_supabase()
    query = db.table("product_deductions").select("*, products(name)")
    if person_type:
        query = query.eq("person_type", person_type)
    if person_id:
        query = query.eq("person_id", person_id)
    if month:
        query = query.eq("payroll_month", month)
    result = query.order("deduction_date", desc=True).execute()
    return result.data


@router.post("")
def create_deduction(data: DeductionCreate):
    db = get_supabase()

    # Snapshot current product price
    product = (
        db.table("products").select("price").eq("id", data.product_id).single().execute()
    )
    unit_price = product.data["price"]

    # Auto-fill payroll_month from deduction date if not provided
    from datetime import date as date_type

    payroll_month = data.payroll_month
    if not payroll_month:
        today = date_type.today()
        payroll_month = today.strftime("%Y-%m")

    deduction_data = {
        "person_type": data.person_type.value,
        "person_id": data.person_id,
        "product_id": data.product_id,
        "quantity": data.quantity,
        "unit_price": unit_price,
        "payroll_month": payroll_month,
        "notes": data.notes,
    }
    result = db.table("product_deductions").insert(deduction_data).execute()
    return result.data[0]


@router.delete("/{deduction_id}")
def delete_deduction(deduction_id: str):
    db = get_supabase()
    db.table("product_deductions").delete().eq("id", deduction_id).execute()
    return {"ok": True}
