-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Admins can view admin_users" ON public.admin_users;

-- Create a new policy that allows authenticated users to check their own admin status
CREATE POLICY "Users can check their own admin status" 
ON public.admin_users 
FOR SELECT 
USING (auth.uid() = user_id);