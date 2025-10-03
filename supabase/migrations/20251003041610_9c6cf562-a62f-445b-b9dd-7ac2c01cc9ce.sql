-- 修改generation_history表以支持多张图片
-- 将image_url改为images数组，存储多个图片URL
ALTER TABLE generation_history 
ADD COLUMN IF NOT EXISTS images TEXT[];

-- 将现有的image_url数据迁移到images数组
UPDATE generation_history 
SET images = ARRAY[image_url]
WHERE image_url IS NOT NULL AND images IS NULL;