-- Migration: Add insalubridade and periculosidade to drivers and employees
-- insalubridade_pct: 0 (none), 10, 20 or 40 (% of minimum wage added to gross)
-- periculosidade: boolean; when true adds 30% of base_salary to gross

alter table drivers
    add column insalubridade_pct integer not null default 0
        check (insalubridade_pct in (0, 10, 20, 40)),
    add column periculosidade boolean not null default false;

alter table employees
    add column insalubridade_pct integer not null default 0
        check (insalubridade_pct in (0, 10, 20, 40)),
    add column periculosidade boolean not null default false;
