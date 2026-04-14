from fastapi import APIRouter, HTTPException
from database import get_supabase
from models.schemas import DriverCreate, DriverUpdate

router = APIRouter()


@router.get("")
def list_drivers(active_only: bool = True):
    db = get_supabase()
    query = db.table("drivers").select("*, driver_company_commissions(*)")
    if active_only:
        query = query.eq("active", True)
    result = query.order("name").execute()
    return result.data


@router.get("/{driver_id}")
def get_driver(driver_id: str):
    db = get_supabase()
    result = (
        db.table("drivers")
        .select("*, driver_company_commissions(*)")
        .eq("id", driver_id)
        .single()
        .execute()
    )
    return result.data


@router.post("")
def create_driver(data: DriverCreate):
    db = get_supabase()
    driver_data = data.model_dump(exclude={"commissions"}, exclude_none=True)
    if data.date_of_birth:
        driver_data["date_of_birth"] = data.date_of_birth.isoformat()

    result = db.table("drivers").insert(driver_data).execute()
    driver = result.data[0]

    if data.commissions:
        comms = [
            {
                "driver_id": driver["id"],
                "company": c.company.value,
                "commission_pct": c.commission_pct,
            }
            for c in data.commissions
        ]
        db.table("driver_company_commissions").insert(comms).execute()

    return get_driver(driver["id"])


@router.put("/{driver_id}")
def update_driver(driver_id: str, data: DriverUpdate):
    db = get_supabase()
    driver_data = data.model_dump(exclude={"commissions"}, exclude_none=True)
    if data.date_of_birth:
        driver_data["date_of_birth"] = data.date_of_birth.isoformat()

    if driver_data:
        db.table("drivers").update(driver_data).eq("id", driver_id).execute()

    if data.commissions is not None:
        db.table("driver_company_commissions").delete().eq("driver_id", driver_id).execute()
        if data.commissions:
            comms = [
                {
                    "driver_id": driver_id,
                    "company": c.company.value,
                    "commission_pct": c.commission_pct,
                }
                for c in data.commissions
            ]
            db.table("driver_company_commissions").insert(comms).execute()

    return get_driver(driver_id)


@router.delete("/{driver_id}")
def delete_driver(driver_id: str):
    db = get_supabase()
    db.table("drivers").update({"active": False}).eq("id", driver_id).execute()
    return {"ok": True}
