-- Migration: Add benefits to drivers/employees, restructure advances
-- Run this in Supabase SQL Editor

-- ============================================
-- ENUM for advance types
-- ============================================
create type advance_type as enum ('beneficio', 'salario', 'produtos');
create type beneficio_category as enum ('alimentacao', 'transporte', 'refeicao');

-- ============================================
-- ADD BENEFIT COLUMNS TO DRIVERS
-- ============================================
alter table drivers
    add column beneficio_alimentacao numeric(10,2) not null default 0,
    add column beneficio_transporte numeric(10,2) not null default 0,
    add column beneficio_refeicao numeric(10,2) not null default 0;

-- ============================================
-- ADD BENEFIT COLUMNS TO EMPLOYEES
-- ============================================
alter table employees
    add column beneficio_alimentacao numeric(10,2) not null default 0,
    add column beneficio_transporte numeric(10,2) not null default 0,
    add column beneficio_refeicao numeric(10,2) not null default 0;

-- ============================================
-- ADD TYPE COLUMNS TO SALARY_ADVANCES
-- ============================================
alter table salary_advances
    add column advance_type advance_type not null default 'salario',
    add column beneficio_category beneficio_category,
    add column product_name text;

-- Index for querying advances by type
create index idx_advances_type on salary_advances(advance_type);

-- ============================================
-- NOTE: product_deductions table is kept for
-- historical data but no longer used by the app.
-- ============================================
