-- 添加草稿类型和文件大小字段
ALTER TABLE public.editor_drafts
ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;

-- 更新现有记录为临时草稿
UPDATE public.editor_drafts
SET is_temporary = true
WHERE is_temporary IS NULL;

-- 创建函数来清理旧的临时草稿（保留最新5个）
CREATE OR REPLACE FUNCTION clean_old_temporary_drafts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 删除超过5个的旧临时草稿
  DELETE FROM public.editor_drafts
  WHERE id IN (
    SELECT id
    FROM public.editor_drafts
    WHERE user_id = NEW.user_id
    AND is_temporary = true
    ORDER BY last_saved_at DESC
    OFFSET 5
  );
  
  RETURN NEW;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_clean_old_temporary_drafts ON public.editor_drafts;
CREATE TRIGGER trigger_clean_old_temporary_drafts
AFTER INSERT OR UPDATE ON public.editor_drafts
FOR EACH ROW
WHEN (NEW.is_temporary = true)
EXECUTE FUNCTION clean_old_temporary_drafts();

-- 创建函数计算用户总存储使用量
CREATE OR REPLACE FUNCTION get_user_storage_usage(p_user_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_size BIGINT;
BEGIN
  SELECT COALESCE(SUM(file_size), 0)
  INTO total_size
  FROM public.editor_drafts
  WHERE user_id = p_user_id;
  
  RETURN total_size;
END;
$$;