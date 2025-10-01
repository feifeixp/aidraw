import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Wand2, Send, Image as ImageIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  prompt?: string;
  modelName?: string;
  modelId?: string;
  imageUrl?: string;
  status?: "processing" | "completed" | "failed";
  aiReasoning?: string;
  timestamp: Date;
}

const Generate = () => {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAISelecting, setIsAISelecting] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

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

    try {
      const { data, error } = await supabase.functions.invoke("ai-select-model", {
        body: { userPrompt: prompt },
      });

      if (error) throw error;

      setSelectedModel(data.model_id);
      
      toast({
        title: "AI已选择模型",
        description: `${data.model_name}: ${data.reasoning}`,
      });

      // 自动触发生成
      handleGenerate(data.model_id, data.reasoning);
    } catch (error: any) {
      console.error("AI selection error:", error);
      toast({
        title: "AI选择失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
      setIsAISelecting(false);
    }
  };

  const handleGenerate = async (modelIdOverride?: string, reasoning?: string) => {
    const currentPrompt = prompt.trim();
    const currentModelId = modelIdOverride || selectedModel;

    if (!currentPrompt) {
      toast({
        title: "请输入提示词",
        description: "提示词不能为空",
        variant: "destructive",
      });
      return;
    }

    if (!currentModelId) {
      toast({
        title: "请选择模型",
        description: "请先选择一个模型或使用AI智能选择",
        variant: "destructive",
      });
      return;
    }

    const model = models?.find(m => m.model_id === currentModelId);
    if (!model) {
      toast({
        title: "模型未找到",
        variant: "destructive",
      });
      return;
    }

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: "user",
      prompt: currentPrompt,
      modelName: model.name,
      modelId: model.model_id,
      aiReasoning: reasoning,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setPrompt("");
    setIsGenerating(true);

    // 添加处理中的助手消息
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      type: "assistant",
      status: "processing",
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, assistantMessage]);

    try {
      const { data, error } = await supabase.functions.invoke("liblib-generate", {
        body: {
          prompt: currentPrompt,
          modelId: model.model_id,
          modelName: model.name,
        },
      });

      if (error) throw error;

      console.log("Edge function response:", data);

      if (data.success && data.status === "processing") {
        const historyId = data.historyId;
        let pollAttempts = 0;
        const maxPollAttempts = 120;

        const pollInterval = setInterval(async () => {
          pollAttempts++;
          
          if (pollAttempts > maxPollAttempts) {
            clearInterval(pollInterval);
            setChatMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, status: "failed" as const }
                : msg
            ));
            setIsGenerating(false);
            setIsAISelecting(false);
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
            setChatMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, status: "completed" as const, imageUrl: historyData.image_url }
                : msg
            ));
            setIsGenerating(false);
            setIsAISelecting(false);
            toast({
              title: "生成成功",
              description: "图片已生成",
            });
          } else if (historyData.status === "failed") {
            clearInterval(pollInterval);
            setChatMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, status: "failed" as const }
                : msg
            ));
            setIsGenerating(false);
            setIsAISelecting(false);
            toast({
              title: "生成失败",
              description: historyData.error_message || "请稍后重试",
              variant: "destructive",
            });
          }
        }, 2000);

      } else if (data.success && data.imageUrl) {
        setChatMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, status: "completed" as const, imageUrl: data.imageUrl }
            : msg
        ));
        setIsGenerating(false);
        setIsAISelecting(false);
        toast({
          title: "生成成功",
          description: "图片已生成",
        });
      } else {
        throw new Error(data.error || "生成失败");
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      setChatMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, status: "failed" as const }
          : msg
      ));
      setIsGenerating(false);
      setIsAISelecting(false);
      toast({
        title: "生成失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* 顶部标题 */}
      <header className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm px-6 py-4">
        <h1 className="text-2xl font-bold bg-[var(--gradient-primary)] bg-clip-text text-transparent">
          AI智能绘图
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          描述您的创意，AI会自动选择最合适的模型为您生成图片
        </p>
      </header>

      {/* 对话列表区域 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Sparkles className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <p className="text-lg text-muted-foreground">开始您的创作之旅</p>
              <p className="text-sm text-muted-foreground/70 mt-2">输入提示词，让AI为您生成精美图片</p>
            </div>
          ) : (
            chatMessages.map((message) => (
              <div key={message.id} className="space-y-4">
                {message.type === "user" && (
                  <div className="flex justify-end">
                    <Card className="max-w-2xl p-4 bg-primary/10 border-primary/20">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{message.prompt}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {message.modelName}
                          </Badge>
                          {message.aiReasoning && (
                            <span className="flex items-center gap-1">
                              <Wand2 className="h-3 w-3" />
                              AI推荐
                            </span>
                          )}
                        </div>
                        {message.aiReasoning && (
                          <p className="text-xs text-muted-foreground italic">
                            💡 {message.aiReasoning}
                          </p>
                        )}
                      </div>
                    </Card>
                  </div>
                )}

                {message.type === "assistant" && (
                  <div className="flex justify-start">
                    <Card className="max-w-2xl p-4 bg-card border-accent/20">
                      {message.status === "processing" && (
                        <div className="flex flex-col items-center gap-4 py-8">
                          <Loader2 className="h-12 w-12 animate-spin text-primary" />
                          <p className="text-sm text-muted-foreground">正在生成图片...</p>
                          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                            生成中
                          </Badge>
                        </div>
                      )}

                      {message.status === "completed" && message.imageUrl && (
                        <div className="space-y-3">
                          <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-muted">
                            <img
                              src={message.imageUrl}
                              alt="Generated"
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                            已完成
                          </Badge>
                        </div>
                      )}

                      {message.status === "failed" && (
                        <div className="flex flex-col items-center gap-4 py-8 text-destructive">
                          <ImageIcon className="h-12 w-12" />
                          <p className="text-sm">生成失败，请重试</p>
                          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                            失败
                          </Badge>
                        </div>
                      )}
                    </Card>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 底部输入区域 */}
      <div className="flex-shrink-0 border-t bg-card/50 backdrop-blur-sm p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* 模型选择 */}
          <div className="flex items-center gap-2">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-auto min-w-[200px]">
                <SelectValue placeholder="选择模型" />
              </SelectTrigger>
              <SelectContent>
                {modelsLoading ? (
                  <SelectItem value="loading" disabled>
                    加载中...
                  </SelectItem>
                ) : models && models.length > 0 ? (
                  models.map((model) => (
                    <SelectItem key={model.id} value={model.model_id}>
                      <div className="flex flex-col">
                        <span>{model.name}</span>
                        {model.lora_weight && (
                          <span className="text-xs text-muted-foreground">
                            LoRA权重: {model.lora_weight}
                          </span>
                        )}
                      </div>
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
              disabled={isAISelecting || isGenerating || !prompt.trim()}
              variant="outline"
              size="sm"
            >
              {isAISelecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              <span className="ml-2">AI选择</span>
            </Button>
          </div>

          {/* 输入框 */}
          <div className="flex gap-2">
            <Textarea
              placeholder="输入提示词..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!isGenerating && !isAISelecting && prompt.trim() && selectedModel) {
                    handleGenerate();
                  }
                }
              }}
              className="min-h-[60px] resize-none"
              disabled={isGenerating || isAISelecting}
            />
            <Button
              onClick={() => handleGenerate()}
              disabled={isGenerating || isAISelecting || !prompt.trim() || !selectedModel}
              size="lg"
              className="px-6"
            >
              {isGenerating || isAISelecting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Generate;