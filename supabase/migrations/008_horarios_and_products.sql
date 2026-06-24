-- Migration: time records (horários) + product deductions cleanup
-- Adds time_records table for the new /horarios punch-clock feature and
-- ensures product_deductions has the snapshot/notes columns we expect.

-- ============================================
-- TIME RECORDS (Horários)
-- ============================================
create table if not exists time_records (
    id uuid primary key default uuid_generate_v4(),
    batch_id uuid not null,
    person_type person_type not null,
    person_id uuid not null,
    person_name_snapshot text not null,
    person_cpf_snapshot text,
    punch_at timestamptz not null,
    notes text,
    created_at timestamptz not null default now()
);

create index if not exists idx_time_records_punch_at on time_records(punch_at);
create index if not exists idx_time_records_batch on time_records(batch_id);
create index if not exists idx_time_records_person on time_records(person_type, person_id);

alter table time_records enable row level security;
create policy "auth_full_access" on time_records for all using (auth.role() = 'authenticated');

-- ============================================
-- PRODUCT DEDUCTIONS: ensure snapshot columns exist
-- ============================================
alter table product_deductions
    add column if not exists person_name_snapshot text,
    add column if not exists person_cpf_snapshot text,
    add column if not exists product_name_snapshot text;
