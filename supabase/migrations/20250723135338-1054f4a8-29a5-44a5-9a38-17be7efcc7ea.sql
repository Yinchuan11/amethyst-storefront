-- Add Litecoin payment fields to orders table
ALTER TABLE public.orders 
ADD COLUMN litecoin_address TEXT,
ADD COLUMN litecoin_amount NUMERIC;