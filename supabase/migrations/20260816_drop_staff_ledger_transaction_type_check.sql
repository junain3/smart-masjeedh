-- Drop staff_ledger_transaction_type_check constraint to allow more flexibility
-- This constraint was causing issues with Custom Credit inserts
-- The transaction_type field is already validated by the application logic

alter table public.staff_ledger drop constraint if exists staff_ledger_transaction_type_check;
