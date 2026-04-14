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
  beneficio_alimentacao: number;
  beneficio_transporte: number;
  beneficio_refeicao: number;
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
  created_at: string;
  updated_at: string;
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
