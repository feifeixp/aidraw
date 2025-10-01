-- 更新所有活动模型的默认采样器和CFG参数
UPDATE liblib_models 
SET 
  sampler = 1,  -- Euler sampler
  cfg_scale = 3.5
WHERE is_active = true;