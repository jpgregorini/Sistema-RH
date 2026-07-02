-- Migration: make sure the payroll include/paid flag columns exist.
-- On some databases included_benefits/included_salary were missing, which made
-- every benefit row show as excluded (struck-through) and broke "Incluir".
-- Idempotent: adds only what's missing; existing rows get the defaults.

alter table payroll
    add column if not exists included_salary boolean not null default true,
    add column if not exists included_benefits boolean not null default true,
    add column if not exists paid_salary boolean not null default false,
    add column if not exists paid_benefits boolean not null default false;
