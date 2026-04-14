from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import drivers, employees, trips, products, advances, payroll, ai

app = FastAPI(title="Novalog HR API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(drivers.router, prefix="/api/drivers", tags=["Motoristas"])
app.include_router(employees.router, prefix="/api/employees", tags=["Funcionários"])
app.include_router(trips.router, prefix="/api/trips", tags=["Viagens"])
app.include_router(products.router, prefix="/api/products", tags=["Produtos"])
app.include_router(advances.router, prefix="/api/advances", tags=["Adiantamentos"])
app.include_router(payroll.router, prefix="/api/payroll", tags=["Folha"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
