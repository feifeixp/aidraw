import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TestTube2 } from "lucide-react";

const Test = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const { toast } = useToast();

  // 简单的测试提示词 - 一个简单人物
  const testPrompt = "一个微笑的年轻女孩，简单风格，干净背景";
  const testModelId = "test-model-001"; // 这个需要根据实际可用的模型ID调整

  const handleTest = async () => {
    setIsGenerating(true);
    setGeneratedImage(null);
    setApiResponse(null);

    try {
      console.log("Testing LibLib API with:", { testPrompt, testModelId });
      
      const { data, error } = await supabase.functions.invoke("liblib-generate", {
        body: {
          prompt: testPrompt,
          modelId: testModelId,
          modelName: "测试模型",
        },
      });

      console.log("Response:", data);
      setApiResponse(data);

      if (error) {
        console.error("Function invocation error:", error);
        throw error;
      }

      if (data.success && data.imageUrl) {
        setGeneratedImage(data.imageUrl);
        toast({
          title: "✅ API测试成功",
          description: "图片已生成",
        });
      } else {
        toast({
          title: "⚠️ API响应异常",
          description: data.error || "未能获取图片URL",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Test error:", error);
      setApiResponse({ error: error.message });
      toast({
        title: "❌ API测试失败",
        description: error.message || "请检查API配置",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold bg-[var(--gradient-primary)] bg-clip-text text-transparent flex items-center justify-center gap-2">
            <TestTube2 className="h-8 w-8 text-primary" />
            API测试页面
          </h1>
          <p className="text-muted-foreground">
            测试LibLib API连接和图片生成功能
          </p>
        </header>

        <div className="space-y-6">
          {/* 测试信息卡片 */}
          <Card className="p-6 bg-gradient-to-br from-card via-card to-accent/5 border-accent/20">
            <h2 className="mb-4 text-xl font-semibold">测试配置</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">AccessKey:</span>
                <span className="font-mono">Pt6EX8XqnGpmwAerrYkhsQ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">测试提示词:</span>
                <span>{testPrompt}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">测试模型ID:</span>
                <span className="font-mono">{testModelId}</span>
              </div>
            </div>

            <Button
              onClick={handleTest}
              disabled={isGenerating}
              className="mt-6 w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  测试中...
                </>
              ) : (
                <>
                  <TestTube2 className="mr-2 h-5 w-5" />
                  开始测试API
                </>
              )}
            </Button>
          </Card>

          {/* 结果显示 */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* 图片预览 */}
            <Card className="p-6 bg-gradient-to-br from-card via-card to-primary/5 border-primary/20">
              <h2 className="mb-4 text-xl font-semibold">生成结果</h2>
              <div className="relative aspect-square overflow-hidden rounded-lg bg-muted/50 flex items-center justify-center">
                {isGenerating ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">正在测试API...</p>
                  </div>
                ) : generatedImage ? (
                  <img
                    src={generatedImage}
                    alt="Test Generated"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <TestTube2 className="mx-auto mb-2 h-12 w-12 opacity-50" />
                    <p>点击测试按钮开始</p>
                  </div>
                )}
              </div>
            </Card>

            {/* API响应 */}
            <Card className="p-6 bg-gradient-to-br from-card via-card to-accent/5 border-accent/20">
              <h2 className="mb-4 text-xl font-semibold">API响应</h2>
              <div className="relative max-h-96 overflow-auto rounded-lg bg-muted/50 p-4">
                {apiResponse ? (
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                    {JSON.stringify(apiResponse, null, 2)}
                  </pre>
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    <p>API响应将在这里显示</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* 说明 */}
          <Card className="p-6 bg-gradient-to-br from-card via-card to-accent/5 border-accent/20">
            <h3 className="mb-2 font-semibold">⚠️ 重要说明</h3>
            <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
              <li>如果测试失败，请检查 <code className="px-1 py-0.5 bg-muted rounded">LIBLIB_API_KEY</code> 是否正确配置</li>
              <li>测试使用的模型ID（<code className="px-1 py-0.5 bg-muted rounded">{testModelId}</code>）需要替换为实际可用的LibLib模型ID</li>
              <li>可以在模型管理页面添加真实的LibLib模型</li>
              <li>查看浏览器控制台和Edge Function日志获取详细错误信息</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Test;