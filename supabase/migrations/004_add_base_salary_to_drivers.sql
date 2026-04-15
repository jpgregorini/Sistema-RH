-- Active: 1770754835056@@127.0.0.1@3306
-- Migration: Add optional monthly base salary to drivers
-- Some drivers are paid commission only, others earn salary + commission,
-- so base_salary is nullable.

alter table drivers
    add column base_salary numeric(10,2);
