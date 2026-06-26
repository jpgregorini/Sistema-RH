-- Migration: Employee Registration (Registro de Empregado)
-- Adds the full set of fields required to generate the JPX DO BRASIL
-- "Registro de Empregado" document, plus the public-link registration flow
-- where the new employee fills their own personal data.

alter table employees
    -- Registration flow
    add column if not exists registration_mode text not null default 'manual',
    add column if not exists registration_token text unique,
    add column if not exists registration_submitted_at timestamptz,
    add column if not exists matricula_esocial text,
    add column if not exists beneficiarios text,

    -- Personal data (filled by the employee via public link)
    add column if not exists residencia text,
    add column if not exists local_nascimento text,
    add column if not exists pais_nacionalidade text default 'BRASIL',
    add column if not exists estado_civil text,
    add column if not exists filiacao_pai text,
    add column if not exists filiacao_mae text,
    add column if not exists orgao_emissor text,
    add column if not exists grau_instrucao text,
    add column if not exists sexo text,
    add column if not exists cor text,
    add column if not exists deficiencia text,
    add column if not exists telefone_residencial text,
    add column if not exists telefone_celular text,

    -- Identity documents (optional, RH fills if needed)
    add column if not exists cedula_identidade text,
    add column if not exists rg_data_emissao text,
    add column if not exists titulo_eleitoral text,
    add column if not exists titulo_zona text,
    add column if not exists titulo_secao text,
    add column if not exists inscr_orgao_classe text,
    add column if not exists ctps text,
    add column if not exists ctps_serie text,
    add column if not exists ctps_data_expedicao text,
    add column if not exists ctps_uf text,
    add column if not exists cnh text,
    add column if not exists cnh_categoria text,
    add column if not exists doc_militar text,
    add column if not exists doc_militar_categoria text,

    -- Work data (filled by RH)
    add column if not exists cargo text,
    add column if not exists funcao text,
    add column if not exists cbo text,
    add column if not exists data_admissao date,
    add column if not exists salario_por text,
    add column if not exists horario_trabalho text,
    add column if not exists horario_intervalo text,
    add column if not exists fgts_opcao_em date,
    add column if not exists conta_vinculada_banco text,
    add column if not exists data_ratificacao text,

    -- PIS / bank
    add column if not exists pis_cadastrado_em text,
    add column if not exists pis_sob_n text,
    add column if not exists pis_domicilio_bancario text,
    add column if not exists pis_n_banco text,
    add column if not exists pis_agencia_codigo text,
    add column if not exists pis_end_agencia text;

create index if not exists idx_employees_registration_token
    on employees(registration_token);
