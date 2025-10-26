-- 修复现有的空 file_path 记录
UPDATE public.editor_drafts
SET file_path = user_id || '/' || id || '.json'
WHERE file_path = '' OR file_path IS NULL;