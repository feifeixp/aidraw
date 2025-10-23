import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const accessToken = searchParams.get('token');
      const refreshToken = searchParams.get('refresh_token');

      if (!accessToken || !refreshToken) {
        toast.error("认证信息缺失");
        navigate("/auth");
        return;
      }

      try {
        // 设置从另一个项目传递过来的 session
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error("设置会话失败:", error);
          toast.error("认证失败，请重新登录");
          navigate("/auth");
          return;
        }

        toast.success("认证成功！");
        navigate("/");
      } catch (error) {
        console.error("认证回调错误:", error);
        toast.error("认证过程出错");
        navigate("/auth");
      }
    };

    handleAuthCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">正在验证认证信息...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
