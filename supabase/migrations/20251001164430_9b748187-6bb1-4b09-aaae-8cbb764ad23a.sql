-- 为generation_history表添加更详细的记录字段
ALTER TABLE generation_history 
ADD COLUMN IF NOT EXISTS task_uuid TEXT,
ADD COLUMN IF NOT EXISTS checkpoint_id TEXT,
ADD COLUMN IF NOT EXISTS lora_models JSONB,
ADD COLUMN IF NOT EXISTS template_uuid TEXT;