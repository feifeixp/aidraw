-- Create storage bucket for pose reference images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pose-references',
  'pose-references',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);

-- Create table for pose reference presets
CREATE TABLE public.pose_reference_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  description text,
  tags text[] DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Enable RLS
ALTER TABLE public.pose_reference_presets ENABLE ROW LEVEL SECURITY;

-- Anyone can view active presets
CREATE POLICY "Anyone can view active pose presets"
ON public.pose_reference_presets
FOR SELECT
USING (is_active = true);

-- Only admins can manage presets
CREATE POLICY "Admins can manage pose presets"
ON public.pose_reference_presets
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Storage policies for pose-references bucket
CREATE POLICY "Public can view pose reference images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'pose-references');

CREATE POLICY "Admins can upload pose reference images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'pose-references' 
  AND has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update pose reference images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'pose-references' 
  AND has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete pose reference images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'pose-references' 
  AND has_role(auth.uid(), 'admin')
);

-- Trigger for updated_at
CREATE TRIGGER update_pose_reference_presets_updated_at
BEFORE UPDATE ON public.pose_reference_presets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();