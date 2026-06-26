-- Migration: allow link-first registration (employee fills name/CPF) and
-- store documents the employee uploads via the public link.

-- Name and CPF are now filled by the employee through the public link, so
-- they must be nullable at creation time. (CPF stays UNIQUE; Postgres allows
-- multiple NULLs in a unique index.)
alter table employees alter column name drop not null;
alter table employees alter column cpf drop not null;

-- Employee-uploaded documents (foto reuses existing photo_url).
alter table employees
    add column if not exists doc_comprovante_endereco_url text,
    add column if not exists doc_rg_cnh_url text;
