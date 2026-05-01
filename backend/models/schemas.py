from pydantic import BaseModel
from datetime import date
from enum import Enum


class CompanyName(str, Enum):
    ascop = "Ascop"
    cooplider = "Cooplider"
    alimex = "Alimex"


class ContractType(str, Enum):
    clt = "CLT"
    pj = "PJ"


class PersonType(str, Enum):
    driver = "driver"
    employee = "employee"


class AdvanceType(str, Enum):
    beneficio = "beneficio"
    salario = "salario"
    produtos = "produtos"


class BeneficioCategory(str, Enum):
    alimentacao = "alimentacao"
    transporte = "transporte"
    refeicao = "refeicao"


# --- Commission ---
class CommissionRate(BaseModel):
    company: CompanyName
    commission_pct: float


# --- Driver ---
class DriverCreate(BaseModel):
    name: str
    cpf: str
    date_of_birth: date | None = None
    photo_url: str | None = None
    contract_file_url: str | None = None
    life_insurance_url: str | None = None
    certidao_negativa_url: str | None = None
    payday: int = 10
    phone: str | None = None
    pix_key: str | None = None
    notes: str | None = None
    base_salary: float | None = None
    commissions: list[CommissionRate] = []
    beneficio_alimentacao: float = 0
    beneficio_transporte: float = 0
    beneficio_refeicao: float = 0


class DriverUpdate(BaseModel):
    name: str | None = None
    cpf: str | None = None
    date_of_birth: date | None = None
    photo_url: str | None = None
    contract_file_url: str | None = None
    life_insurance_url: str | None = None
    certidao_negativa_url: str | None = None
    payday: int | None = None
    phone: str | None = None
    pix_key: str | None = None
    notes: str | None = None
    active: bool | None = None
    base_salary: float | None = None
    commissions: list[CommissionRate] | None = None
    beneficio_alimentacao: float | None = None
    beneficio_transporte: float | None = None
    beneficio_refeicao: float | None = None


# --- Employee ---
class EmployeeCreate(BaseModel):
    name: str
    cpf: str
    date_of_birth: date | None = None
    contract_type: ContractType
    base_salary: float | None = None
    contract_file_url: str | None = None
    photo_url: str | None = None
    payday: int = 5
    phone: str | None = None
    pix_key: str | None = None
    notes: str | None = None
    beneficio_alimentacao: float = 0
    beneficio_transporte: float = 0
    beneficio_refeicao: float = 0


class EmployeeUpdate(BaseModel):
    name: str | None = None
    cpf: str | None = None
    date_of_birth: date | None = None
    contract_type: ContractType | None = None
    base_salary: float | None = None
    contract_file_url: str | None = None
    photo_url: str | None = None
    payday: int | None = None
    phone: str | None = None
    pix_key: str | None = None
    notes: str | None = None
    active: bool | None = None
    beneficio_alimentacao: float | None = None
    beneficio_transporte: float | None = None
    beneficio_refeicao: float | None = None


# --- Trip ---
class TripCargoItem(BaseModel):
    company: CompanyName
    weight_kg: float
    value_brl: float


class TripCreate(BaseModel):
    driver_id: str
    trip_date: date
    origin: str | None = None
    destination: str | None = None
    notes: str | None = None
    cargo: list[TripCargoItem]


class TripUpdate(BaseModel):
    driver_id: str | None = None
    trip_date: date | None = None
    origin: str | None = None
    destination: str | None = None
    notes: str | None = None
    cargo: list[TripCargoItem] | None = None


# --- Product ---
class ProductCreate(BaseModel):
    name: str
    price: float


class ProductUpdate(BaseModel):
    name: str | None = None
    price: float | None = None
    active: bool | None = None


# --- Advance ---
class AdvanceCreate(BaseModel):
    person_type: PersonType
    person_id: str
    advance_type: AdvanceType
    amount: float
    beneficio_category: BeneficioCategory | None = None
    product_name: str | None = None
    advance_date: date | None = None
    payroll_month: str | None = None
    notes: str | None = None
    installments: int = 1


class PayrollUpdate(BaseModel):
    included_salary: bool | None = None
    included_benefits: bool | None = None


# --- Payroll ---
class PayrollCalculateRequest(BaseModel):
    person_type: PersonType
    person_id: str
    month: str  # YYYY-MM
    scope: str = "all"  # 'salary', 'benefits', or 'all'
