from fastapi import APIRouter
from database import get_supabase
from models.schemas import EmployeeCreate, EmployeeUpdate

router = APIRouter()


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
    emp_data = data.model_dump(exclude_none=True)
    if data.date_of_birth:
        emp_data["date_of_birth"] = data.date_of_birth.isoformat()
    emp_data["contract_type"] = data.contract_type.value

    result = db.table("employees").insert(emp_data).execute()
    return result.data[0]


@router.put("/{employee_id}")
def update_employee(employee_id: str, data: EmployeeUpdate):
    db = get_supabase()
    emp_data = data.model_dump(exclude_none=True)
    if data.date_of_birth:
        emp_data["date_of_birth"] = data.date_of_birth.isoformat()
    if data.contract_type:
        emp_data["contract_type"] = data.contract_type.value

    db.table("employees").update(emp_data).eq("id", employee_id).execute()
    return get_employee(employee_id)


@router.delete("/{employee_id}")
def delete_employee(employee_id: str):
    db = get_supabase()
    db.table("employees").update({"active": False}).eq("id", employee_id).execute()
    return {"ok": True}
