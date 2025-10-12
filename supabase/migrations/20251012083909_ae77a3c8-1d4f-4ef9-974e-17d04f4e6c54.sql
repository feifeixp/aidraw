-- Create canvas_drafts table for persistent draft storage
CREATE TABLE public.canvas_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_id text NOT NULL,
  canvas_data jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, draft_id)
);

-- Enable RLS
ALTER TABLE public.canvas_drafts ENABLE ROW LEVEL SECURITY;

-- Users can view their own drafts
CREATE POLICY "Users can view own drafts"
ON public.canvas_drafts
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own drafts
CREATE POLICY "Users can insert own drafts"
ON public.canvas_drafts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own drafts
CREATE POLICY "Users can update own drafts"
ON public.canvas_drafts
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own drafts
CREATE POLICY "Users can delete own drafts"
ON public.canvas_drafts
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_canvas_drafts_updated_at
BEFORE UPDATE ON public.canvas_drafts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_canvas_drafts_user_id ON public.canvas_drafts(user_id);
CREATE INDEX idx_canvas_drafts_updated_at ON public.canvas_drafts(updated_at DESC);