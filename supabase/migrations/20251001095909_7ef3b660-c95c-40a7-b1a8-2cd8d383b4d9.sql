-- 添加LibLib模型的额外配置字段
ALTER TABLE public.liblib_models 
ADD COLUMN IF NOT EXISTS checkpoint_id text,
ADD COLUMN IF NOT EXISTS lora_version_id text,
ADD COLUMN IF NOT EXISTS sampler integer DEFAULT 15,
ADD COLUMN IF NOT EXISTS cfg_scale numeric DEFAULT 7,
ADD COLUMN IF NOT EXISTS randn_source integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS lora_weight numeric DEFAULT 0.8;

COMMENT ON COLUMN public.liblib_models.checkpoint_id IS '底模UUID (checkPointId)';
COMMENT ON COLUMN public.liblib_models.lora_version_id IS 'Lora模型版本UUID (versionUuid)';
COMMENT ON COLUMN public.liblib_models.sampler IS '采样方法';
COMMENT ON COLUMN public.liblib_models.cfg_scale IS '提示词引导系数';
COMMENT ON COLUMN public.liblib_models.randn_source IS '随机种子生成器 (0=CPU, 1=GPU)';
COMMENT ON COLUMN public.liblib_models.lora_weight IS 'Lora权重 (0-1之间)';