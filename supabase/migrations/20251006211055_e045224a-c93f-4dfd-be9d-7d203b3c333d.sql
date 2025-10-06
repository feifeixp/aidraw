-- Add is_template column to generation_history table
ALTER TABLE public.generation_history 
ADD COLUMN is_template boolean DEFAULT false;

-- Add index for faster template queries
CREATE INDEX idx_generation_history_is_template ON public.generation_history(is_template) WHERE is_template = true;