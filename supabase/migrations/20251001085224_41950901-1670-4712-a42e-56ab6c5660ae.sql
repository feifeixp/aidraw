-- 创建LibLib模型表
CREATE TABLE public.liblib_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  features JSONB DEFAULT '{}',
  thumbnail_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 创建生成历史表
CREATE TABLE public.generation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  prompt TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  image_url TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 启用RLS
ALTER TABLE public.liblib_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_history ENABLE ROW LEVEL SECURITY;

-- 模型表策略（所有人可读，管理员可写）
CREATE POLICY "Everyone can view models"
  ON public.liblib_models
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage models"
  ON public.liblib_models
  FOR ALL
  USING (true);

-- 历史表策略（用户可以看到所有历史，便于展示）
CREATE POLICY "Everyone can view generation history"
  ON public.generation_history
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage history"
  ON public.generation_history
  FOR ALL
  USING (true);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_liblib_models_updated_at
  BEFORE UPDATE ON public.liblib_models
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 创建索引
CREATE INDEX idx_liblib_models_active ON public.liblib_models(is_active);
CREATE INDEX idx_generation_history_created ON public.generation_history(created_at DESC);