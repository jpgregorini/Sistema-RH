from fastapi import APIRouter
from database import get_supabase
from models.schemas import TripCreate, TripUpdate

router = APIRouter()


@router.get("")
def list_trips(driver_id: str | None = None, month: str | None = None):
    db = get_supabase()
    query = db.table("trips").select("*, trip_cargo(*), drivers(name, cpf)")
    if driver_id:
        query = query.eq("driver_id", driver_id)
    if month:
        # month format: YYYY-MM
        start = f"{month}-01"
        # get last day of month
        year, m = month.split("-")
        m = int(m)
        if m == 12:
            end = f"{int(year)+1}-01-01"
        else:
            end = f"{year}-{m+1:02d}-01"
        query = query.gte("trip_date", start).lt("trip_date", end)
    result = query.order("trip_date", desc=True).execute()
    return result.data


@router.get("/{trip_id}")
def get_trip(trip_id: str):
    db = get_supabase()
    result = (
        db.table("trips")
        .select("*, trip_cargo(*), drivers(name, cpf)")
        .eq("id", trip_id)
        .single()
        .execute()
    )
    return result.data


@router.post("")
def create_trip(data: TripCreate):
    db = get_supabase()
    total_weight = sum(c.weight_kg for c in data.cargo)
    total_value = sum(c.value_brl for c in data.cargo)

    trip_data = {
        "driver_id": data.driver_id,
        "trip_date": data.trip_date.isoformat(),
        "origin": data.origin,
        "destination": data.destination,
        "notes": data.notes,
        "total_weight_kg": total_weight,
        "total_value_brl": total_value,
    }
    result = db.table("trips").insert(trip_data).execute()
    trip = result.data[0]

    if data.cargo:
        cargo_rows = [
            {
                "trip_id": trip["id"],
                "company": c.company.value,
                "weight_kg": c.weight_kg,
                "value_brl": c.value_brl,
            }
            for c in data.cargo
        ]
        db.table("trip_cargo").insert(cargo_rows).execute()

    return get_trip(trip["id"])


@router.put("/{trip_id}")
def update_trip(trip_id: str, data: TripUpdate):
    db = get_supabase()
    trip_data = {}
    if data.driver_id:
        trip_data["driver_id"] = data.driver_id
    if data.trip_date:
        trip_data["trip_date"] = data.trip_date.isoformat()
    if data.origin is not None:
        trip_data["origin"] = data.origin
    if data.destination is not None:
        trip_data["destination"] = data.destination
    if data.notes is not None:
        trip_data["notes"] = data.notes

    if data.cargo is not None:
        total_weight = sum(c.weight_kg for c in data.cargo)
        total_value = sum(c.value_brl for c in data.cargo)
        trip_data["total_weight_kg"] = total_weight
        trip_data["total_value_brl"] = total_value

    if trip_data:
        db.table("trips").update(trip_data).eq("id", trip_id).execute()

    if data.cargo is not None:
        db.table("trip_cargo").delete().eq("trip_id", trip_id).execute()
        if data.cargo:
            cargo_rows = [
                {
                    "trip_id": trip_id,
                    "company": c.company.value,
                    "weight_kg": c.weight_kg,
                    "value_brl": c.value_brl,
                }
                for c in data.cargo
            ]
            db.table("trip_cargo").insert(cargo_rows).execute()

    return get_trip(trip_id)


@router.delete("/{trip_id}")
def delete_trip(trip_id: str):
    db = get_supabase()
    db.table("trips").delete().eq("id", trip_id).execute()
    return {"ok": True}
