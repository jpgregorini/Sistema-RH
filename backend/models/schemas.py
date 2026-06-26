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
    insalubridade_pct: int = 0
    periculosidade: bool = False


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
    insalubridade_pct: int | None = None
    periculosidade: bool | None = None


# --- Employee ---
# Fields used to generate the "Registro de Empregado" document. Most are
# optional free-text; some are filled by the employee via the public link.
class EmployeeRegistrationFields(BaseModel):
    # Registration flow
    registration_mode: str | None = None  # 'manual' | 'link'
    matricula_esocial: str | None = None
    beneficiarios: str | None = None

    # Personal (employee-fillable)
    residencia: str | None = None
    local_nascimento: str | None = None
    pais_nacionalidade: str | None = None
    estado_civil: str | None = None
    filiacao_pai: str | None = None
    filiacao_mae: str | None = None
    orgao_emissor: str | None = None
    grau_instrucao: str | None = None
    sexo: str | None = None
    cor: str | None = None
    deficiencia: str | None = None
    telefone_residencial: str | None = None
    telefone_celular: str | None = None

    # Identity documents
    cedula_identidade: str | None = None
    rg_data_emissao: str | None = None
    titulo_eleitoral: str | None = None
    titulo_zona: str | None = None
    titulo_secao: str | None = None
    inscr_orgao_classe: str | None = None
    ctps: str | None = None
    ctps_serie: str | None = None
    ctps_data_expedicao: str | None = None
    ctps_uf: str | None = None
    cnh: str | None = None
    cnh_categoria: str | None = None
    doc_militar: str | None = None
    doc_militar_categoria: str | None = None

    # Work (RH)
    cargo: str | None = None
    funcao: str | None = None
    cbo: str | None = None
    data_admissao: date | None = None
    salario_por: str | None = None
    horario_trabalho: str | None = None
    horario_intervalo: str | None = None
    fgts_opcao_em: date | None = None
    conta_vinculada_banco: str | None = None
    data_ratificacao: str | None = None

    # PIS / bank
    pis_cadastrado_em: str | None = None
    pis_sob_n: str | None = None
    pis_domicilio_bancario: str | None = None
    pis_n_banco: str | None = None
    pis_agencia_codigo: str | None = None
    pis_end_agencia: str | None = None


class EmployeeCreate(EmployeeRegistrationFields):
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
    insalubridade_pct: int = 0
    periculosidade: bool = False


class EmployeeUpdate(EmployeeRegistrationFields):
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
    insalubridade_pct: int | None = None
    periculosidade: bool | None = None


# Subset the new employee fills in via the public registration link.
class EmployeeRegistrationPublic(BaseModel):
    name: str | None = None
    cpf: str | None = None
    pix_key: str | None = None
    date_of_birth: date | None = None
    residencia: str | None = None
    local_nascimento: str | None = None
    pais_nacionalidade: str | None = None
    estado_civil: str | None = None
    filiacao_pai: str | None = None
    filiacao_mae: str | None = None
    orgao_emissor: str | None = None
    grau_instrucao: str | None = None
    sexo: str | None = None
    cor: str | None = None
    deficiencia: str | None = None
    telefone_residencial: str | None = None
    telefone_celular: str | None = None


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
# New advances are always salary deductions. The advance_type field is kept
# only for legacy compatibility (so old beneficio/produtos rows still load).
class AdvanceCreate(BaseModel):
    person_type: PersonType
    person_id: str
    amount: float
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


# --- Product Deductions (saída de produto) ---
class ProductDeductionCreate(BaseModel):
    person_type: PersonType
    person_id: str
    product_id: str
    quantity: int = 1
    deduction_date: date | None = None
    payroll_month: str | None = None
    notes: str | None = None


# --- Time Records (horários) ---
class TimeRecordTarget(str, Enum):
    all_drivers = "all_drivers"
    all_employees = "all_employees"
    all = "all"
    custom = "custom"


class TimeRecordPerson(BaseModel):
    person_type: PersonType
    person_id: str


class TimeRecordCreate(BaseModel):
    punch_at: str  # ISO datetime
    target: TimeRecordTarget
    people: list[TimeRecordPerson] = []
    notes: str | None = None
