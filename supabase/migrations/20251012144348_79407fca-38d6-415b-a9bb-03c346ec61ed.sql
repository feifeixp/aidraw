-- Add metadata fields to generation_history table
ALTER TABLE public.generation_history
ADD COLUMN element_type TEXT,
ADD COLUMN element_name TEXT,
ADD COLUMN element_style TEXT,
ADD COLUMN element_description TEXT;