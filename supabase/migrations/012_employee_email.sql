-- Migration: employee e-mail (filled by the employee via the public link).
alter table employees
    add column if not exists email text;
