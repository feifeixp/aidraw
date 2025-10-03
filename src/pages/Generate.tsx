import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Wand2, Send, Image as ImageIcon, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  prompt?: string;
  modelName?: string;
  modelId?: string;
  imageUrl?: string;
  images?: string[];
  status?: "processing" | "completed" | "failed";
  aiReasoning?: string;
  timestamp: Date;
}

const ASPECT_RATIOS = [
  { label: "1:1", ratio: "1:1", width: 1024, height: 1024 },
  { label: "3:4", ratio: "3:4", width: 768, height: 1024 },
  { label: "4:3", ratio: "4:3", width: 1024, height: 768 },
  { label: "16:9", ratio: "16:9", width: 1024, height: 576 },
  { label: "9:16", ratio: "9:16", width: 576, height: 1024 },
  { label: "2:1", ratio: "2:1", width: 1024, height: 512 },
  { label: "1:2", ratio: "1:2", width: 512, height: 1024 },
];

const Generate = () => {
  const [prompt, setPrompt] = useState("");
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<string>("");
  const [selectedLoras, setSelectedLoras] = useState<string[]>([]);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("1:1");
  const [imageCount, setImageCount] = useState("1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAISelecting, setIsAISelecting] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isStyleDialogOpen, setIsStyleDialogOpen] = useState(false);
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

  // 分离底模和风格列表
  const checkpointModels = models?.filter(m => m.checkpoint_id) || [];
  
  // 根据选中的底模筛选风格模型
  const filteredLoraModels = models?.filter(m => {
    if (!m.lora_version_id) return false;
    
    // 如果没有选择底模，显示所有风格
    if (!selectedCheckpoint) return true;
    
    // 检查features中是否包含compatible_checkpoint_id
    const features = m.features as Record<string, any> | null;
    const compatibleCheckpointId = features?.compatible_checkpoint_id;
    if (compatibleCheckpointId) {
      return compatibleCheckpointId === selectedCheckpoint;
    }
    
    // 如果没有compatible_checkpoint_id，显示所有风格
    return true;
  }) || [];

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

      // 根据返回的模型类型设置选择
      const selectedModel = models?.find(m => m.model_id === data.model_id);
      if (selectedModel) {
        if (selectedModel.checkpoint_id) {
          setSelectedCheckpoint(data.model_id);
        } else if (selectedModel.lora_version_id) {
          setSelectedLoras(prev => {
            if (!prev.includes(data.model_id) && prev.length < 5) {
              return [...prev, data.model_id];
            }
            return prev;
          });
        }
      }
      
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
    
    if (!currentPrompt) {
      toast({
        title: "请输入提示词",
        description: "提示词不能为空",
        variant: "destructive",
      });
      return;
    }

    // 使用AI选择时用override，否则检查用户选择
    let checkpointModel = null;
    let loraModelsSelected: any[] = [];

    if (modelIdOverride) {
      const model = models?.find(m => m.model_id === modelIdOverride);
      if (model?.checkpoint_id) {
        checkpointModel = model;
      } else if (model?.lora_version_id) {
        loraModelsSelected = [model];
      }
    } else {
      if (selectedCheckpoint) {
        checkpointModel = models?.find(m => m.model_id === selectedCheckpoint);
      }
      if (selectedLoras.length > 0) {
        loraModelsSelected = models?.filter(m => selectedLoras.includes(m.model_id)) || [];
      }
    }

    // 至少需要选择一个模型
      if (!checkpointModel && loraModelsSelected.length === 0) {
      toast({
        title: "请选择模型",
        description: "请至少选择一个底模或风格模型",
        variant: "destructive",
      });
      return;
    }

    const loraNames = loraModelsSelected.map(l => l.name).join(" + ");
    const displayModelName = checkpointModel 
      ? (loraModelsSelected.length > 0 ? `${checkpointModel.name} + ${loraNames}` : checkpointModel.name)
      : loraNames || "未知模型";
    const primaryModelId = checkpointModel?.model_id || loraModelsSelected[0]?.model_id || "";

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: "user",
      prompt: currentPrompt,
      modelName: displayModelName,
      modelId: primaryModelId,
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

    // 获取选中比例的尺寸
    const aspectRatio = ASPECT_RATIOS.find(ar => ar.ratio === selectedAspectRatio) || ASPECT_RATIOS[0];

    try {
      const { data, error } = await supabase.functions.invoke("liblib-generate", {
        body: {
          prompt: currentPrompt,
          modelId: primaryModelId,
          modelName: displayModelName,
          checkpointId: checkpointModel?.model_id,
          loraIds: loraModelsSelected.map(l => l.model_id),
          width: aspectRatio.width,
          height: aspectRatio.height,
          imgCount: parseInt(imageCount),
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

          if (historyData.status === "completed" && (historyData.images || historyData.image_url)) {
            clearInterval(pollInterval);
            const imageUrls = historyData.images || (historyData.image_url ? [historyData.image_url] : []);
            setChatMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, status: "completed" as const, images: imageUrls, imageUrl: imageUrls[0] }
                : msg
            ));
            setIsGenerating(false);
            setIsAISelecting(false);
            toast({
              title: "生成成功",
              description: `已生成 ${imageUrls.length} 张图片`,
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

                      {message.status === "completed" && (message.images || message.imageUrl) && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-4 gap-2">
                            {(message.images || [message.imageUrl]).filter(Boolean).map((url, idx) => (
                              <div key={idx} className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-muted">
                                <img
                                  src={url!}
                                  alt={`Generated ${idx + 1}`}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                            已完成 ({(message.images || [message.imageUrl]).filter(Boolean).length} 张)
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
          <div className="flex items-center gap-2 flex-wrap">
            {/* 底模选择 */}
            <Select value={selectedCheckpoint} onValueChange={setSelectedCheckpoint}>
              <SelectTrigger className="w-auto min-w-[180px]">
                <SelectValue placeholder="选择底模" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {modelsLoading ? (
                  <SelectItem value="loading" disabled>
                    加载中...
                  </SelectItem>
                ) : checkpointModels.length > 0 ? (
                  checkpointModels.map((model) => (
                    <SelectItem key={model.id} value={model.model_id}>
                      <div className="flex items-center gap-2">
                        <span>{model.name}</span>
                        <Badge className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/20">
                          底模
                        </Badge>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-checkpoints" disabled>
                    暂无底模
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            {/* 风格选择弹窗 */}
            <div className="flex items-center gap-2 flex-wrap">
              <Dialog open={isStyleDialogOpen} onOpenChange={setIsStyleDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    选择风格 ({selectedLoras.length}/5)
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>
                      选择风格模型 ({selectedLoras.length}/5)
                      {selectedCheckpoint && (
                        <span className="text-sm text-muted-foreground ml-2">
                          - 基于 {checkpointModels.find(m => m.model_id === selectedCheckpoint)?.name}
                        </span>
                      )}
                    </DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="h-[60vh] pr-4">
                    {modelsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredLoraModels.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {filteredLoraModels.map((model) => {
                          const isSelected = selectedLoras.includes(model.model_id);
                          return (
                            <Card
                              key={model.id}
                              className={`cursor-pointer transition-all hover:shadow-lg ${
                                isSelected ? 'ring-2 ring-primary' : ''
                              }`}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedLoras(prev => prev.filter(id => id !== model.model_id));
                                } else if (selectedLoras.length < 5) {
                                  setSelectedLoras(prev => [...prev, model.model_id]);
                                } else {
                                  toast({
                                    title: "最多选择5个风格",
                                    description: "您已经选择了5个风格模型",
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              <div className="relative aspect-square overflow-hidden rounded-t-lg bg-muted">
                                {model.thumbnail_url ? (
                                  <img
                                    src={model.thumbnail_url}
                                    alt={model.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex items-center justify-center h-full">
                                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                                  </div>
                                )}
                                {isSelected && (
                                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                                    <span className="text-xs font-bold">✓</span>
                                  </div>
                                )}
                              </div>
                              <div className="p-3 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="font-medium text-sm line-clamp-1">{model.name}</h4>
                                  <Badge className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20 flex-shrink-0">
                                    风格
                                  </Badge>
                                </div>
                                {model.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {model.description}
                                  </p>
                                )}
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                          {selectedCheckpoint ? "该底模暂无可用风格" : "请先选择底模"}
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </DialogContent>
              </Dialog>
              
              {selectedLoras.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {selectedLoras.map((loraId) => {
                    const lora = models?.find(m => m.model_id === loraId);
                    return (
                      <Badge
                        key={loraId}
                        variant="secondary"
                        className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20 cursor-pointer"
                        onClick={() => setSelectedLoras(prev => prev.filter(id => id !== loraId))}
                      >
                        {lora?.name} ×
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

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

          {/* 图片比例选择 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">图片比例:</span>
            {ASPECT_RATIOS.map((ar) => (
              <Button
                key={ar.ratio}
                variant={selectedAspectRatio === ar.ratio ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedAspectRatio(ar.ratio)}
                disabled={isGenerating || isAISelecting}
                className="min-w-[60px]"
              >
                {ar.label}
              </Button>
            ))}
          </div>

          {/* 生成次数选择 */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">生成数量:</span>
            <RadioGroup 
              value={imageCount} 
              onValueChange={setImageCount}
              className="flex gap-2"
              disabled={isGenerating || isAISelecting}
            >
              {[1, 2, 3, 4].map((count) => (
                <div key={count} className="flex items-center space-x-2">
                  <RadioGroupItem 
                    value={count.toString()} 
                    id={`count-${count}`}
                    disabled={isGenerating || isAISelecting}
                  />
                  <Label 
                    htmlFor={`count-${count}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {count}张
                  </Label>
                </div>
              ))}
            </RadioGroup>
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
                  if (!isGenerating && !isAISelecting && prompt.trim() && (selectedCheckpoint || selectedLoras.length > 0)) {
                    handleGenerate();
                  }
                }
              }}
              className="min-h-[60px] resize-none"
              disabled={isGenerating || isAISelecting}
            />
            <Button
              onClick={() => handleGenerate()}
              disabled={isGenerating || isAISelecting || !prompt.trim() || (!selectedCheckpoint && selectedLoras.length === 0)}
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