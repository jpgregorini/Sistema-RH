from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from database import get_supabase
from models.schemas import TimeRecordCreate, TimeRecordTarget
from services.pdf_generator import (
    generate_time_record_pdf,
    generate_time_records_batch_pdf,
)
from datetime import datetime
from uuid import uuid4
import io

router = APIRouter()


def _resolve_people(db, target: TimeRecordTarget, people: list) -> list[dict]:
    """Return list of {person_type, person_id, name, cpf} for the given target."""
    result: list[dict] = []

    if target in (TimeRecordTarget.all_drivers, TimeRecordTarget.all):
        drivers = (
            db.table("drivers")
            .select("id, name, cpf")
            .eq("active", True)
            .order("name")
            .execute()
        ).data or []
        for d in drivers:
            result.append({
                "person_type": "driver",
                "person_id": d["id"],
                "name": d["name"],
                "cpf": d.get("cpf"),
            })

    if target in (TimeRecordTarget.all_employees, TimeRecordTarget.all):
        emps = (
            db.table("employees")
            .select("id, name, cpf")
            .eq("active", True)
            .order("name")
            .execute()
        ).data or []
        for e in emps:
            result.append({
                "person_type": "employee",
                "person_id": e["id"],
                "name": e["name"],
                "cpf": e.get("cpf"),
            })

    if target == TimeRecordTarget.custom:
        for p in people:
            table = "drivers" if p.person_type.value == "driver" else "employees"
            row = (
                db.table(table)
                .select("id, name, cpf")
                .eq("id", p.person_id)
                .single()
                .execute()
            ).data
            if row:
                result.append({
                    "person_type": p.person_type.value,
                    "person_id": row["id"],
                    "name": row["name"],
                    "cpf": row.get("cpf"),
                })

    # De-duplicate by (type, id) — useful when "all" overlaps custom lists
    seen = set()
    deduped = []
    for r in result:
        key = (r["person_type"], r["person_id"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(r)
    return deduped


def _parse_punch_at(s: str) -> datetime:
    # accept "YYYY-MM-DDTHH:MM" or with seconds, with or without timezone
    s = s.strip()
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        raise HTTPException(status_code=400, detail="punch_at inválido.")


@router.get("/batches")
def list_batches(month: str | None = None):
    """Return one row per batch: id, punch_at, count, sample names."""
    db = get_supabase()
    query = db.table("time_records").select("*")
    if month:
        query = query.gte("punch_at", f"{month}-01").lt("punch_at", _next_month(month))
    rows = query.order("punch_at", desc=True).execute().data or []

    batches: dict[str, dict] = {}
    for r in rows:
        bid = r["batch_id"]
        if bid not in batches:
            batches[bid] = {
                "batch_id": bid,
                "punch_at": r["punch_at"],
                "people": [],
                "count": 0,
                "notes": r.get("notes"),
            }
        batches[bid]["count"] += 1
        batches[bid]["people"].append({
            "id": r["id"],
            "person_type": r["person_type"],
            "person_id": r["person_id"],
            "name": r["person_name_snapshot"],
            "cpf": r.get("person_cpf_snapshot"),
        })
    return list(batches.values())


def _next_month(month: str) -> str:
    y, m = month.split("-")
    y_i, m_i = int(y), int(m)
    if m_i == 12:
        return f"{y_i+1}-01-01"
    return f"{y_i:04d}-{m_i+1:02d}-01"


@router.get("")
def list_records(
    person_type: str | None = None,
    person_id: str | None = None,
    batch_id: str | None = None,
):
    db = get_supabase()
    query = db.table("time_records").select("*")
    if person_type:
        query = query.eq("person_type", person_type)
    if person_id:
        query = query.eq("person_id", person_id)
    if batch_id:
        query = query.eq("batch_id", batch_id)
    rows = query.order("punch_at", desc=True).execute().data or []
    return rows


@router.post("")
def create_records(data: TimeRecordCreate):
    db = get_supabase()
    punch_at = _parse_punch_at(data.punch_at)

    people = _resolve_people(db, data.target, data.people)
    if not people:
        raise HTTPException(
            status_code=400,
            detail="Nenhum colaborador selecionado.",
        )

    batch_id = str(uuid4())
    rows = [
        {
            "batch_id": batch_id,
            "person_type": p["person_type"],
            "person_id": p["person_id"],
            "person_name_snapshot": p["name"],
            "person_cpf_snapshot": p.get("cpf"),
            "punch_at": punch_at.isoformat(),
            "notes": data.notes,
        }
        for p in people
    ]
    result = db.table("time_records").insert(rows).execute()
    return {"batch_id": batch_id, "count": len(result.data or []), "records": result.data}


@router.get("/batch/{batch_id}/pdf")
def batch_pdf(batch_id: str):
    db = get_supabase()
    rows = (
        db.table("time_records")
        .select("*")
        .eq("batch_id", batch_id)
        .order("person_name_snapshot")
        .execute()
    ).data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Lote não encontrado.")

    records = [
        {
            "name": r["person_name_snapshot"],
            "cpf": r.get("person_cpf_snapshot"),
            "punch_at": datetime.fromisoformat(r["punch_at"].replace("Z", "+00:00")),
            "notes": r.get("notes"),
        }
        for r in rows
    ]
    pdf_bytes = generate_time_records_batch_pdf(records)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=horarios_{batch_id}.pdf"},
    )


@router.get("/{record_id}/pdf")
def record_pdf(record_id: str):
    db = get_supabase()
    r = (
        db.table("time_records")
        .select("*")
        .eq("id", record_id)
        .single()
        .execute()
    ).data
    if not r:
        raise HTTPException(status_code=404, detail="Registro não encontrado.")
    pdf_bytes = generate_time_record_pdf(
        name=r["person_name_snapshot"],
        cpf=r.get("person_cpf_snapshot"),
        punch_at=datetime.fromisoformat(r["punch_at"].replace("Z", "+00:00")),
        notes=r.get("notes"),
    )
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=horario_{record_id}.pdf"},
    )


@router.delete("/batch/{batch_id}")
def delete_batch(batch_id: str):
    db = get_supabase()
    db.table("time_records").delete().eq("batch_id", batch_id).execute()
    return {"ok": True}
