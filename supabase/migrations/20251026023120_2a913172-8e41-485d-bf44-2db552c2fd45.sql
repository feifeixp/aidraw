-- 创建编辑器草稿表
CREATE TABLE public.editor_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT DEFAULT '未命名草稿',
  thumbnail_url TEXT,
  file_path TEXT NOT NULL,
  last_saved_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_auto_save BOOLEAN DEFAULT true,
  frame_count INTEGER DEFAULT 1,
  canvas_settings JSONB
);

-- 启用 RLS
ALTER TABLE public.editor_drafts ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的草稿
CREATE POLICY "Users can view own drafts"
  ON public.editor_drafts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drafts"
  ON public.editor_drafts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drafts"
  ON public.editor_drafts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own drafts"
  ON public.editor_drafts
  FOR DELETE
  USING (auth.uid() = user_id);

-- 创建 Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('editor-drafts', 'editor-drafts', false);

-- Storage RLS 策略：用户只能访问自己的草稿文件
CREATE POLICY "Users can view own draft files"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'editor-drafts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own draft files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'editor-drafts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own draft files"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'editor-drafts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own draft files"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'editor-drafts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 创建触发器自动更新 updated_at
CREATE TRIGGER update_editor_drafts_updated_at
  BEFORE UPDATE ON public.editor_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();