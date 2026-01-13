-- Create multitracks table
CREATE TABLE public.multitracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_name TEXT NOT NULL,
  song_name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  cover_url TEXT,
  file_url TEXT NOT NULL,
  preview_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sales table
CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  multitrack_id UUID NOT NULL REFERENCES public.multitracks(id) ON DELETE CASCADE,
  buyer_email TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_id TEXT,
  download_token TEXT UNIQUE,
  download_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create admin_users table (for admin authentication)
CREATE TABLE public.admin_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.multitracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Multitracks policies (public read, admin write)
CREATE POLICY "Anyone can view multitracks" 
ON public.multitracks 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert multitracks" 
ON public.multitracks 
FOR INSERT 
WITH CHECK (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can update multitracks" 
ON public.multitracks 
FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can delete multitracks" 
ON public.multitracks 
FOR DELETE 
USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

-- Sales policies (admin only)
CREATE POLICY "Admins can view all sales" 
ON public.sales 
FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Anyone can insert sales" 
ON public.sales 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can update sales" 
ON public.sales 
FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

-- Admin users policies
CREATE POLICY "Admins can view admin_users" 
ON public.admin_users 
FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('multitracks', 'multitracks', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('previews', 'previews', true);

-- Storage policies for covers (public read)
CREATE POLICY "Anyone can view covers" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'covers');

CREATE POLICY "Admins can upload covers" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'covers' AND 
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can update covers" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'covers' AND 
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can delete covers" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'covers' AND 
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

-- Storage policies for previews (public read)
CREATE POLICY "Anyone can view previews" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'previews');

CREATE POLICY "Admins can upload previews" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'previews' AND 
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can update previews" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'previews' AND 
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can delete previews" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'previews' AND 
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

-- Storage policies for multitracks (private - only via signed URLs)
CREATE POLICY "Admins can upload multitracks" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'multitracks' AND 
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can view multitracks" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'multitracks' AND 
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can update multitracks storage" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'multitracks' AND 
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can delete multitracks storage" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'multitracks' AND 
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_multitracks_updated_at
BEFORE UPDATE ON public.multitracks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();