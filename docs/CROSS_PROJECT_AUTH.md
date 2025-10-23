# 跨项目认证使用指南

## 概述
本项目支持通过 JWT Token 与其他 Lovable 项目共享用户认证。

## 使用方法

### 1. 在当前项目（项目 A）中导出认证

```typescript
import { exportAuthToProject } from "@/utils/crossProjectAuth";
import { toast } from "sonner";

// 在按钮点击或其他事件中调用
const handleJumpToProjectB = async () => {
  try {
    await exportAuthToProject("https://project-b.lovable.app");
    // 用户将被自动跳转到项目 B
  } catch (error) {
    toast.error("跳转失败：" + error.message);
  }
};
```

### 2. 在目标项目（项目 B）中接收认证

#### 步骤 1: 复制必要的文件到项目 B

将以下文件复制到项目 B：
- `src/pages/AuthCallback.tsx`
- `src/utils/crossProjectAuth.ts`

#### 步骤 2: 在项目 B 的 App.tsx 中添加路由

```typescript
import AuthCallback from "./pages/AuthCallback";

// 在 Routes 中添加：
<Route path="/auth/callback" element={<AuthCallback />} />
```

#### 步骤 3: 配置 Supabase

确保两个项目使用相同的 Supabase 项目，或者在 Supabase 项目中配置允许跨项目的 JWT token。

## 使用示例

### 在 Navigation 组件中添加跨项目跳转按钮

```typescript
import { exportAuthToProject } from "@/utils/crossProjectAuth";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

const Navigation = () => {
  const handleJumpToStoryApp = async () => {
    try {
      await exportAuthToProject("https://story.neodomain.ai");
    } catch (error) {
      console.error("跳转失败:", error);
    }
  };

  return (
    <nav>
      {/* 其他导航项... */}
      
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={handleJumpToStoryApp}
        className="flex items-center gap-2"
      >
        <ExternalLink className="h-4 w-4" />
        前往故事应用
      </Button>
    </nav>
  );
};
```

### 生成认证链接（用于分享或嵌入）

```typescript
import { generateAuthLink } from "@/utils/crossProjectAuth";

const ShareButton = () => {
  const handleGenerateLink = async () => {
    try {
      const authLink = await generateAuthLink("https://project-b.lovable.app");
      // 可以复制链接或分享给用户
      navigator.clipboard.writeText(authLink);
      toast.success("认证链接已复制到剪贴板");
    } catch (error) {
      toast.error("生成链接失败");
    }
  };

  return <Button onClick={handleGenerateLink}>生成跨项目链接</Button>;
};
```

## 安全注意事项

1. **Token 过期**: JWT token 有过期时间，跨项目跳转后 token 会自动刷新
2. **HTTPS 必需**: 生产环境必须使用 HTTPS 以保护 token 传输
3. **同一 Supabase 项目**: 两个 Lovable 项目必须连接到同一个 Supabase 项目或配置正确的 JWT 验证

## 故障排除

### 问题: "认证信息缺失"
- 检查 URL 参数是否正确传递
- 确保用户在项目 A 中已登录

### 问题: "认证失败，请重新登录"
- 确认两个项目使用相同的 Supabase 项目配置
- 检查 token 是否已过期

### 问题: 跳转后立即跳回登录页
- 检查项目 B 的 AuthCallback 路由是否正确配置
- 查看浏览器控制台的错误信息
