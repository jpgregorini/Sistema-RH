-- Novalog HR System - Initial Schema
-- Run this in Supabase SQL Editor

create extension if not exists "uuid-ossp";

-- ENUM types
create type contract_type as enum ('CLT', 'PJ');
create type person_type as enum ('driver', 'employee');
create type company_name as enum ('Ascop', 'Cooplider', 'Alimex');

-- ============================================
-- DRIVERS
-- ============================================
create table drivers (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    cpf varchar(14) not null unique,
    date_of_birth date,
    photo_url text,
    contract_file_url text,
    life_insurance_url text,
    certidao_negativa_url text,
    payday integer not null default 10,
    phone varchar(20),
    pix_key text,
    active boolean not null default true,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Per-company commission rates for drivers
create table driver_company_commissions (
    id uuid primary key default uuid_generate_v4(),
    driver_id uuid not null references drivers(id) on delete cascade,
    company company_name not null,
    commission_pct numeric(5,2) not null,
    unique(driver_id, company)
);

-- ============================================
-- EMPLOYEES
-- ============================================
create table employees (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    cpf varchar(14) not null unique,
    date_of_birth date,
    contract_type contract_type not null,
    base_salary numeric(10,2),
    contract_file_url text,
    photo_url text,
    payday integer not null default 5,
    phone varchar(20),
    pix_key text,
    active boolean not null default true,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ============================================
-- TRIPS
-- ============================================
create table trips (
    id uuid primary key default uuid_generate_v4(),
    driver_id uuid not null references drivers(id),
    trip_date date not null,
    origin text,
    destination text,
    total_weight_kg numeric(10,2),
    total_value_brl numeric(12,2),
    notes text,
    created_at timestamptz not null default now()
);

-- Cargo breakdown per company per trip
create table trip_cargo (
    id uuid primary key default uuid_generate_v4(),
    trip_id uuid not null references trips(id) on delete cascade,
    company company_name not null,
    weight_kg numeric(10,2) not null,
    value_brl numeric(12,2) not null
);

-- ============================================
-- PRODUCTS
-- ============================================
create table products (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    price numeric(10,2) not null,
    active boolean not null default true,
    created_at timestamptz not null default now()
);

-- ============================================
-- PRODUCT DEDUCTIONS
-- ============================================
create table product_deductions (
    id uuid primary key default uuid_generate_v4(),
    person_type person_type not null,
    person_id uuid not null,
    product_id uuid not null references products(id),
    quantity integer not null default 1,
    unit_price numeric(10,2) not null,
    deduction_date date not null default current_date,
    payroll_month varchar(7),
    notes text,
    created_at timestamptz not null default now()
);

-- ============================================
-- SALARY ADVANCES
-- ============================================
create table salary_advances (
    id uuid primary key default uuid_generate_v4(),
    person_type person_type not null,
    person_id uuid not null,
    amount numeric(10,2) not null,
    advance_date date not null default current_date,
    contract_pdf_url text,
    signed_contract_url text,
    payroll_month varchar(7),
    notes text,
    created_at timestamptz not null default now()
);

-- ============================================
-- PAYROLL
-- ============================================
create table payroll (
    id uuid primary key default uuid_generate_v4(),
    person_type person_type not null,
    person_id uuid not null,
    month varchar(7) not null,
    gross_pay numeric(12,2) not null,
    total_deductions numeric(12,2) not null default 0,
    total_advances numeric(12,2) not null default 0,
    net_pay numeric(12,2) not null,
    breakdown jsonb,
    generated_at timestamptz not null default now(),
    unique(person_type, person_id, month)
);

-- ============================================
-- INDEXES
-- ============================================
create index idx_driver_commissions_driver on driver_company_commissions(driver_id);
create index idx_trips_driver on trips(driver_id);
create index idx_trips_date on trips(trip_date);
create index idx_trip_cargo_trip on trip_cargo(trip_id);
create index idx_deductions_person on product_deductions(person_type, person_id);
create index idx_deductions_month on product_deductions(payroll_month);
create index idx_advances_person on salary_advances(person_type, person_id);
create index idx_advances_month on salary_advances(payroll_month);
create index idx_payroll_month on payroll(month);
create index idx_payroll_person on payroll(person_type, person_id);

-- ============================================
-- TRIGGERS
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger drivers_updated_at before update on drivers
    for each row execute function update_updated_at();
create trigger employees_updated_at before update on employees
    for each row execute function update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table drivers enable row level security;
alter table driver_company_commissions enable row level security;
alter table employees enable row level security;
alter table trips enable row level security;
alter table trip_cargo enable row level security;
alter table products enable row level security;
alter table product_deductions enable row level security;
alter table salary_advances enable row level security;
alter table payroll enable row level security;

-- All authenticated users get full access
create policy "auth_full_access" on drivers for all using (auth.role() = 'authenticated');
create policy "auth_full_access" on driver_company_commissions for all using (auth.role() = 'authenticated');
create policy "auth_full_access" on employees for all using (auth.role() = 'authenticated');
create policy "auth_full_access" on trips for all using (auth.role() = 'authenticated');
create policy "auth_full_access" on trip_cargo for all using (auth.role() = 'authenticated');
create policy "auth_full_access" on products for all using (auth.role() = 'authenticated');
create policy "auth_full_access" on product_deductions for all using (auth.role() = 'authenticated');
create policy "auth_full_access" on salary_advances for all using (auth.role() = 'authenticated');
create policy "auth_full_access" on payroll for all using (auth.role() = 'authenticated');
