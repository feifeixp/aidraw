-- 添加base_algo字段来存储模型的基础算法类型
ALTER TABLE public.liblib_models 
ADD COLUMN IF NOT EXISTS base_algo integer DEFAULT 1;

COMMENT ON COLUMN public.liblib_models.base_algo IS '基础算法类型: 1=SD, 2=XL, 3=F.1/Flux';