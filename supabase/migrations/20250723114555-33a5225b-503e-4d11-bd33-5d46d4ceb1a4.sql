-- Add INSERT policy for orders to allow customers to create orders
CREATE POLICY "Anyone can create orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (true);