-- Migration: separate inclusion flags for salary and benefits payroll
-- Run this in Supabase SQL Editor

-- Rename existing "included" -> "included_salary" if not already done
do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_name = 'payroll' and column_name = 'included'
    ) and not exists (
        select 1 from information_schema.columns
        where table_name = 'payroll' and column_name = 'included_salary'
    ) then
        alter table payroll rename column included to included_salary;
    end if;
end $$;

-- Ensure included_salary exists (in case migration 005 was skipped or column dropped)
alter table payroll
    add column if not exists included_salary boolean not null default true,
    add column if not exists included_benefits boolean not null default true;
