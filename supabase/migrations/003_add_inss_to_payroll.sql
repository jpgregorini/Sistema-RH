-- Add INSS column to payroll table
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS inss DECIMAL(12,2) DEFAULT 0;
