from fastapi import APIRouter
from database import get_supabase
from models.schemas import ProductCreate, ProductUpdate

router = APIRouter()


@router.get("")
def list_products(active_only: bool = True):
    db = get_supabase()
    query = db.table("products").select("*")
    if active_only:
        query = query.eq("active", True)
    result = query.order("name").execute()
    return result.data


@router.post("")
def create_product(data: ProductCreate):
    db = get_supabase()
    result = db.table("products").insert(data.model_dump()).execute()
    return result.data[0]


@router.put("/{product_id}")
def update_product(product_id: str, data: ProductUpdate):
    db = get_supabase()
    update_data = data.model_dump(exclude_none=True)
    result = (
        db.table("products").update(update_data).eq("id", product_id).execute()
    )
    return result.data[0]


@router.delete("/{product_id}")
def delete_product(product_id: str):
    db = get_supabase()
    db.table("products").update({"active": False}).eq("id", product_id).execute()
    return {"ok": True}
