-- 添加 updated_at 字段到 editor_drafts 表
ALTER TABLE public.editor_drafts 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();