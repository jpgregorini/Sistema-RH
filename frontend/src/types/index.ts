export type CompanyName = "Ascop" | "Cooplider" | "Alimex";
export type ContractType = "CLT" | "PJ";
export type PersonType = "driver" | "employee";
export type AdvanceType = "beneficio" | "salario" | "produtos";
export type BeneficioCategory = "alimentacao" | "transporte" | "refeicao";

export interface CommissionRate {
  id?: string;
  driver_id?: string;
  company: CompanyName;
  commission_pct: number;
}

export interface Driver {
  id: string;
  name: string;
  cpf: string;
  date_of_birth: string | null;
  photo_url: string | null;
  contract_file_url: string | null;
  life_insurance_url: string | null;
  certidao_negativa_url: string | null;
  payday: number;
  phone: string | null;
  pix_key: string | null;
  active: boolean;
  notes: string | null;
  base_salary: number | null;
  beneficio_alimentacao: number;
  beneficio_transporte: number;
  beneficio_refeicao: number;
  insalubridade_pct: number;
  periculosidade: boolean;
  created_at: string;
  updated_at: string;
  driver_company_commissions: CommissionRate[];
}

export interface Employee {
  id: string;
  name: string;
  cpf: string;
  date_of_birth: string | null;
  contract_type: ContractType;
  base_salary: number | null;
  contract_file_url: string | null;
  photo_url: string | null;
  payday: number;
  phone: string | null;
  pix_key: string | null;
  active: boolean;
  notes: string | null;
  beneficio_alimentacao: number;
  beneficio_transporte: number;
  beneficio_refeicao: number;
  insalubridade_pct: number;
  periculosidade: boolean;
  created_at: string;
  updated_at: string;

  // Registro de Empregado
  email?: string | null;
  registration_mode?: string | null;
  registration_token?: string | null;
  registration_submitted_at?: string | null;
  matricula_esocial?: string | null;
  beneficiarios?: string | null;
  residencia?: string | null;
  local_nascimento?: string | null;
  pais_nacionalidade?: string | null;
  estado_civil?: string | null;
  filiacao_pai?: string | null;
  filiacao_mae?: string | null;
  orgao_emissor?: string | null;
  grau_instrucao?: string | null;
  sexo?: string | null;
  cor?: string | null;
  deficiencia?: string | null;
  telefone_residencial?: string | null;
  telefone_celular?: string | null;
  cedula_identidade?: string | null;
  rg_data_emissao?: string | null;
  titulo_eleitoral?: string | null;
  titulo_zona?: string | null;
  titulo_secao?: string | null;
  inscr_orgao_classe?: string | null;
  ctps?: string | null;
  ctps_serie?: string | null;
  ctps_data_expedicao?: string | null;
  ctps_uf?: string | null;
  cnh?: string | null;
  cnh_categoria?: string | null;
  doc_militar?: string | null;
  doc_militar_categoria?: string | null;
  cargo?: string | null;
  funcao?: string | null;
  cbo?: string | null;
  data_admissao?: string | null;
  salario_por?: string | null;
  horario_trabalho?: string | null;
  horario_intervalo?: string | null;
  fgts_opcao_em?: string | null;
  conta_vinculada_banco?: string | null;
  data_ratificacao?: string | null;
  pis_cadastrado_em?: string | null;
  pis_sob_n?: string | null;
  pis_domicilio_bancario?: string | null;
  pis_n_banco?: string | null;
  pis_agencia_codigo?: string | null;
  pis_end_agencia?: string | null;
  doc_comprovante_endereco_url?: string | null;
  doc_rg_cnh_url?: string | null;
}

export interface RegistroStatus {
  can_generate: boolean;
  missing: string[];
  registration_mode?: string | null;
  registration_token?: string | null;
  registration_submitted_at?: string | null;
}

export interface PublicRegistration {
  employer: { name: string; cnpj: string; endereco: string };
  submitted_at: string | null;
  fields: Record<string, string | null>;
  documents: Record<string, string | null>;
}

export interface TripCargo {
  id: string;
  trip_id: string;
  company: CompanyName;
  weight_kg: number;
  value_brl: number;
}

export interface Trip {
  id: string;
  driver_id: string;
  trip_date: string;
  origin: string | null;
  destination: string | null;
  total_weight_kg: number;
  total_value_brl: number;
  notes: string | null;
  created_at: string;
  trip_cargo: TripCargo[];
  drivers: { name: string; cpf: string };
}

export interface Product {
  id: string;
  name: string;
  price: number;
  active: boolean;
  created_at: string;
}

export interface ProductDeduction {
  id: string;
  person_type: PersonType;
  person_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  deduction_date: string;
  payroll_month: string;
  notes: string | null;
  person_name_snapshot?: string | null;
  person_cpf_snapshot?: string | null;
  product_name_snapshot?: string | null;
  products?: { name: string; price: number } | null;
  created_at: string;
}

export interface TimeRecord {
  id: string;
  batch_id: string;
  person_type: PersonType;
  person_id: string;
  person_name_snapshot: string;
  person_cpf_snapshot: string | null;
  punch_at: string;
  notes: string | null;
  created_at: string;
}

export interface TimeRecordBatch {
  batch_id: string;
  punch_at: string;
  count: number;
  notes: string | null;
  people: {
    id: string;
    person_type: PersonType;
    person_id: string;
    name: string;
    cpf: string | null;
  }[];
}

export interface SalaryAdvance {
  id: string;
  person_type: PersonType;
  person_id: string;
  advance_type: AdvanceType;
  amount: number;
  beneficio_category: BeneficioCategory | null;
  product_name: string | null;
  advance_date: string;
  contract_pdf_url: string | null;
  signed_contract_url: string | null;
  payroll_month: string;
  notes: string | null;
  created_at: string;
  installment_group_id?: string | null;
  installment_index?: number | null;
  installment_total?: number | null;
  person_name_snapshot?: string | null;
  person_cpf_snapshot?: string | null;
}

export interface BenefitBreakdown {
  beneficio_bruto: number;
  alimentacao_valor: number;
  alimentacao_deducao: number;
  transporte_valor: number;
  transporte_deducao: number;
  refeicao_valor: number;
  refeicao_deducao: number;
  beneficio_liquido: number;
}

export interface PayrollRecord {
  id: string;
  person_type: PersonType;
  person_id: string;
  month: string;
  gross_pay: number;
  inss: number;
  total_deductions: number;
  total_advances: number;
  net_pay: number;
  included_salary: boolean;
  included_benefits: boolean;
  paid_salary?: boolean;
  paid_benefits?: boolean;
  person_name_snapshot?: string | null;
  person_cpf_snapshot?: string | null;
  breakdown: {
    company_earnings?: Record<string, { total_value: number; total_earning: number; pct: number }>;
    advances?: Record<string, { amount: number; date: string; category?: string; product_name?: string }[]>;
    advance_totals?: Record<string, number>;
    benefit?: BenefitBreakdown;
    pix_key?: string;
  } | null;
  generated_at: string;
  person_name?: string;
  person_cpf?: string;
  pix_key?: string;
  beneficio_alimentacao?: number;
  beneficio_transporte?: number;
  beneficio_refeicao?: number;
}
