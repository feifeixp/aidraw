import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TestTube2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

const Test = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const { toast } = useToast();

  // 获取模型列表
  const { data: models, isLoading: modelsLoading } = useQuery({
    queryKey: ["test-liblib-models"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("liblib_models")
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  // 自动选择第一个模型
  useEffect(() => {
    if (models && models.length > 0 && !selectedModel) {
      setSelectedModel(models[0].model_id);
    }
  }, [models, selectedModel]);

  // 简单的测试提示词
  const testPrompt = "一个微笑的年轻女孩，简单风格，干净背景";

  const handleTest = async () => {
    if (!selectedModel) {
      toast({
        title: "请选择模型",
        description: "请先选择一个测试模型",
        variant: "destructive",
      });
      return;
    }

    const model = models?.find(m => m.model_id === selectedModel);
    if (!model) {
      toast({
        title: "模型未找到",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);
    setApiResponse(null);

    try {
      console.log("=== 开始测试 LibLib API ===");
      console.log("测试配置:", { 
        prompt: testPrompt, 
        modelId: model.model_id,
        modelName: model.name,
        baseAlgo: model.base_algo 
      });
      
      const startTime = Date.now();
      const { data, error } = await supabase.functions.invoke("liblib-generate", {
        body: {
          prompt: testPrompt,
          modelId: model.model_id,
          modelName: model.name,
        },
      });
      const endTime = Date.now();

      console.log(`请求耗时: ${endTime - startTime}ms`);
      console.log("API响应:", data);
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
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-muted-foreground">
                  选择测试模型
                </label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择一个模型进行测试" />
                  </SelectTrigger>
                  <SelectContent>
                    {modelsLoading ? (
                      <SelectItem value="loading" disabled>
                        加载中...
                      </SelectItem>
                    ) : models && models.length > 0 ? (
                      models.map((model) => (
                        <SelectItem key={model.id} value={model.model_id}>
                          {model.name} ({model.base_algo === 3 ? 'Flux' : model.base_algo === 1 ? 'SD/XL' : 'Unknown'})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-models" disabled>
                        暂无可用模型
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AccessKey:</span>
                  <span className="font-mono text-xs">Pt6EX8XqnGpmwAerrYkhsQ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">测试提示词:</span>
                  <span className="text-right">{testPrompt}</span>
                </div>
                {selectedModel && models && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">模型ID:</span>
                    <span className="font-mono text-xs">{selectedModel}</span>
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={handleTest}
              disabled={isGenerating || !selectedModel || modelsLoading}
              className="mt-6 w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  测试中（最长45秒）...
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
            <h3 className="mb-2 font-semibold">📋 测试说明</h3>
            <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
              <li>此页面使用数据库中的真实模型进行测试</li>
              <li>如果测试失败，请检查 <code className="px-1 py-0.5 bg-muted rounded">LIBLIB_API_KEY</code> 是否正确配置</li>
              <li>测试过程中会在控制台输出详细日志，包括请求耗时和API响应</li>
              <li>Edge Function 日志中会显示更详细的调试信息</li>
              <li>超时时间设置为45秒，如果超时请检查网络连接和LibLib API状态</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Test;