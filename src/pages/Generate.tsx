import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

const Generate = () => {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAISelecting, setIsAISelecting] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string>("");
  const { toast } = useToast();

  // 获取模型列表
  const { data: models, isLoading: modelsLoading } = useQuery({
    queryKey: ["liblib-models"],
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

  const handleAISelect = async () => {
    if (!prompt.trim()) {
      toast({
        title: "请输入提示词",
        description: "AI需要了解您的需求才能选择合适的模型",
        variant: "destructive",
      });
      return;
    }

    setIsAISelecting(true);
    setAiReasoning("");

    try {
      const { data, error } = await supabase.functions.invoke("ai-select-model", {
        body: { userPrompt: prompt },
      });

      if (error) throw error;

      setSelectedModel(data.model_id);
      setAiReasoning(data.reasoning);
      
      toast({
        title: "AI已选择模型",
        description: `${data.model_name}: ${data.reasoning}`,
      });
    } catch (error: any) {
      console.error("AI selection error:", error);
      toast({
        title: "AI选择失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsAISelecting(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "请输入提示词",
        description: "提示词不能为空",
        variant: "destructive",
      });
      return;
    }

    if (!selectedModel) {
      toast({
        title: "请选择模型",
        description: "请先选择一个模型或使用AI智能选择",
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

    try {
      const { data, error } = await supabase.functions.invoke("liblib-generate", {
        body: {
          prompt,
          modelId: model.model_id,
          modelName: model.name,
        },
      });

      if (error) throw error;

      console.log("Edge function response:", data);

      if (data.success && data.status === "processing") {
        // 异步生成已启动，开始轮询状态
        toast({
          title: "生成中",
          description: "图片正在生成，请稍候...",
        });

        const historyId = data.historyId;
        let pollAttempts = 0;
        const maxPollAttempts = 90; // 90 * 2秒 = 3分钟

        const pollInterval = setInterval(async () => {
          pollAttempts++;
          
          if (pollAttempts > maxPollAttempts) {
            clearInterval(pollInterval);
            setIsGenerating(false);
            toast({
              title: "生成超时",
              description: "生成时间过长，请稍后在历史记录中查看结果",
              variant: "destructive",
            });
            return;
          }

          const { data: historyData, error: historyError } = await supabase
            .from("generation_history")
            .select("*")
            .eq("id", historyId)
            .single();

          if (historyError) {
            console.error("轮询错误:", historyError);
            return;
          }

          if (historyData.status === "completed" && historyData.image_url) {
            clearInterval(pollInterval);
            setGeneratedImage(historyData.image_url);
            setIsGenerating(false);
            toast({
              title: "生成成功",
              description: "图片已生成",
            });
          } else if (historyData.status === "failed") {
            clearInterval(pollInterval);
            setIsGenerating(false);
            toast({
              title: "生成失败",
              description: historyData.error_message || "请稍后重试",
              variant: "destructive",
            });
          }
        }, 2000); // 每2秒轮询一次

      } else if (data.success && data.imageUrl) {
        // 旧版同步返回（向后兼容）
        setGeneratedImage(data.imageUrl);
        toast({
          title: "生成成功",
          description: "图片已生成",
        });
        setIsGenerating(false);
      } else {
        throw new Error(data.error || "生成失败");
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      toast({
        title: "生成失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold bg-[var(--gradient-primary)] bg-clip-text text-transparent">
            AI智能绘图
          </h1>
          <p className="text-muted-foreground">
            描述您的创意，AI会自动选择最合适的模型为您生成图片
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 输入区域 */}
          <Card className="p-6 bg-gradient-to-br from-card via-card to-primary/5 border-primary/20">
            <h2 className="mb-4 text-xl font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              创作设置
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  提示词
                </label>
                <Textarea
                  placeholder="描述您想要生成的图片，例如：一个赛博朋克风格的城市夜景，霓虹灯闪烁..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-32 resize-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  模型选择
                </label>
                <div className="flex gap-2">
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="选择模型或使用AI智能选择" />
                    </SelectTrigger>
                    <SelectContent>
                      {modelsLoading ? (
                        <SelectItem value="loading" disabled>
                          加载中...
                        </SelectItem>
                      ) : models && models.length > 0 ? (
                        models.map((model) => (
                          <SelectItem key={model.id} value={model.model_id}>
                            {model.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-models" disabled>
                          暂无可用模型
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={handleAISelect}
                    disabled={isAISelecting || !prompt.trim()}
                    variant="outline"
                    className="shrink-0"
                  >
                    {isAISelecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                    <span className="ml-2">AI选择</span>
                  </Button>
                </div>

                {aiReasoning && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    💡 {aiReasoning}
                  </p>
                )}
              </div>

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim() || !selectedModel}
                className="w-full"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    开始生成
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* 预览区域 */}
          <Card className="p-6 bg-gradient-to-br from-card via-card to-accent/5 border-accent/20">
            <h2 className="mb-4 text-xl font-semibold">生成预览</h2>
            
            <div className="relative aspect-square overflow-hidden rounded-lg bg-muted/50 flex items-center justify-center">
              {isGenerating ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">正在生成图片...</p>
                </div>
              ) : generatedImage ? (
                <img
                  src={generatedImage}
                  alt="Generated"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <Sparkles className="mx-auto mb-2 h-12 w-12 opacity-50" />
                  <p>图片将在这里显示</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Generate;