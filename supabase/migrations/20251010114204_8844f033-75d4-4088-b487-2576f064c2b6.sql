-- 创建用户资料表
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 启用 profiles 表的 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 创建角色枚举
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 创建用户角色表
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 启用 user_roles 表的 RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 创建检查角色的安全函数
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 创建自动创建用户资料的函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- 获取用户邮箱
  user_email := NEW.email;
  
  -- 插入用户资料
  INSERT INTO public.profiles (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(user_email, '@', 1)),
    user_email
  );
  
  -- 如果是管理员邮箱，自动分配管理员角色
  IF user_email = 'feifeixp@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    -- 普通用户角色
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- profiles 表的 RLS 策略
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- user_roles 表的 RLS 策略
CREATE POLICY "Users can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 删除 generation_history 的旧策略
DROP POLICY IF EXISTS "Everyone can view generation history" ON public.generation_history;
DROP POLICY IF EXISTS "Service role can manage history" ON public.generation_history;

-- generation_history 新策略：用户看自己的 + 所有人看模板
CREATE POLICY "Users can view own history"
  ON public.generation_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_template = true);

CREATE POLICY "Anyone can view templates"
  ON public.generation_history FOR SELECT
  TO anon
  USING (is_template = true);

CREATE POLICY "Users can insert own history"
  ON public.generation_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own history"
  ON public.generation_history FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own history"
  ON public.generation_history FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 删除 chat_conversations 的旧策略
DROP POLICY IF EXISTS "Everyone can view conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Service role can manage conversations" ON public.chat_conversations;

-- chat_conversations 需要添加 user_id 列
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- chat_conversations 新策略
CREATE POLICY "Users can view own conversations"
  ON public.chat_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations"
  ON public.chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON public.chat_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON public.chat_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 删除 chat_messages 的旧策略
DROP POLICY IF EXISTS "Everyone can view messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Service role can manage messages" ON public.chat_messages;

-- chat_messages 新策略：通过 conversation 关联检查
CREATE POLICY "Users can view messages in own conversations"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
        AND chat_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in own conversations"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
        AND chat_conversations.user_id = auth.uid()
    )
  );

-- 删除 liblib_models 的旧策略
DROP POLICY IF EXISTS "Everyone can view models" ON public.liblib_models;
DROP POLICY IF EXISTS "Service role can manage models" ON public.liblib_models;

-- liblib_models 新策略：所有人查看，管理员管理
CREATE POLICY "Anyone can view models"
  ON public.liblib_models FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

CREATE POLICY "Admins can manage models"
  ON public.liblib_models FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 创建更新 profiles updated_at 的触发器
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();