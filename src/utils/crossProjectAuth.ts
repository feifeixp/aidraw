import { supabase } from "@/integrations/supabase/client";

/**
 * 导出当前认证到另一个 Lovable 项目
 * @param targetProjectUrl 目标项目的 URL（例如：https://project-b.lovable.app）
 */
export const exportAuthToProject = async (targetProjectUrl: string) => {
  try {
    // 获取当前 session
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      throw new Error("未找到有效的登录会话");
    }

    // 构建目标项目的回调 URL，传递 token
    const callbackUrl = new URL('/auth/callback', targetProjectUrl);
    callbackUrl.searchParams.set('token', session.access_token);
    callbackUrl.searchParams.set('refresh_token', session.refresh_token);

    // 跳转到目标项目
    window.location.href = callbackUrl.toString();
  } catch (error) {
    console.error("导出认证失败:", error);
    throw error;
  }
};

/**
 * 生成跨项目认证链接
 * @param targetProjectUrl 目标项目的 URL
 * @returns 包含认证信息的完整 URL
 */
export const generateAuthLink = async (targetProjectUrl: string): Promise<string> => {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    throw new Error("未找到有效的登录会话");
  }

  const callbackUrl = new URL('/auth/callback', targetProjectUrl);
  callbackUrl.searchParams.set('token', session.access_token);
  callbackUrl.searchParams.set('refresh_token', session.refresh_token);

  return callbackUrl.toString();
};
