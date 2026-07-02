-- Migration: track payment status per payroll row.
-- paid_salary / paid_benefits let RH mark who already received salary and
-- benefits. Benefit receipt ZIP download requires everyone marked as paid.

alter table payroll
    add column if not exists paid_salary boolean not null default false,
    add column if not exists paid_benefits boolean not null default false;
