-- Migration: editable payroll inclusion, history snapshots, advance installments
-- Run this in Supabase SQL Editor

-- ============================================
-- PAYROLL: editable inclusion + history snapshot
-- ============================================
alter table payroll
    add column if not exists included boolean not null default true,
    add column if not exists person_name_snapshot text,
    add column if not exists person_cpf_snapshot text;

-- Backfill snapshots for existing rows
update payroll p
set person_name_snapshot = d.name,
    person_cpf_snapshot = d.cpf
from drivers d
where p.person_type = 'driver'
  and p.person_id = d.id
  and p.person_name_snapshot is null;

update payroll p
set person_name_snapshot = e.name,
    person_cpf_snapshot = e.cpf
from employees e
where p.person_type = 'employee'
  and p.person_id = e.id
  and p.person_name_snapshot is null;

-- ============================================
-- SALARY_ADVANCES: history snapshot + installments
-- ============================================
alter table salary_advances
    add column if not exists person_name_snapshot text,
    add column if not exists person_cpf_snapshot text,
    add column if not exists installment_group_id uuid,
    add column if not exists installment_index integer,
    add column if not exists installment_total integer;

-- Backfill snapshots
update salary_advances a
set person_name_snapshot = d.name,
    person_cpf_snapshot = d.cpf
from drivers d
where a.person_type = 'driver'
  and a.person_id = d.id
  and a.person_name_snapshot is null;

update salary_advances a
set person_name_snapshot = e.name,
    person_cpf_snapshot = e.cpf
from employees e
where a.person_type = 'employee'
  and a.person_id = e.id
  and a.person_name_snapshot is null;

create index if not exists idx_advances_installment_group
    on salary_advances(installment_group_id);
