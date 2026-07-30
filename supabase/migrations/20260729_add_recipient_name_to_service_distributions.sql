-- Add recipient_name column to service_distributions table
-- This allows specifying which family member received a particular service

ALTER TABLE service_distributions 
ADD COLUMN IF NOT EXISTS recipient_name text;
