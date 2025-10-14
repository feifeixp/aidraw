import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Wand2, Send, Image as ImageIcon, X, Download, ZoomIn, RotateCcw, Edit, ChevronDown, Check, History as HistoryIcon, MessageSquare, Star, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSearchParams } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InspirationGrid } from "@/components/InspirationGrid";
import { HistoryGrid } from "@/components/HistoryGrid";
import { useAuth } from "@/hooks/useAuth";
type GenerationMode = "agent" | "imageGeneration";
interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  prompt?: string;
  content?: string;
  modelName?: string;
  modelId?: string;
  imageUrl?: string;
  images?: string[];
  status?: "processing" | "completed" | "failed";
  aiReasoning?: string;
  timestamp: Date;
  checkpointId?: string;
  loraIds?: string[];
  aspectRatio?: string;
  imageCount?: string;
  mode?: GenerationMode;
  metadata?: {
    checkpoint_id?: string;
    lora_ids?: string[];
    aspect_ratio?: string;
    image_count?: number;
    reasoning?: string;
  };
}
const ASPECT_RATIOS = [{
  label: "1:1 标清",
  ratio: "1:1",
  width: 1024,
  height: 1024
}, {
  label: "1:1 高清",
  ratio: "1:1-hd",
  width: 2048,
  height: 2048
}, {
  label: "3:4 标清",
  ratio: "3:4",
  width: 768,
  height: 1024
}, {
  label: "3:4 高清",
  ratio: "3:4-hd",
  width: 1536,
  height: 2048
}, {
  label: "3:4 超清",
  ratio: "3:4-uhd",
  width: 2304,
  height: 3072
}, {
  label: "4:3 标清",
  ratio: "4:3",
  width: 1024,
  height: 768
}, {
  label: "4:3 高清",
  ratio: "4:3-hd",
  width: 2048,
  height: 1536
}, {
  label: "16:9 标清",
  ratio: "16:9",
  width: 1024,
  height: 576
}, {
  label: "16:9 高清",
  ratio: "16:9-hd",
  width: 1920,
  height: 1080
}, {
  label: "9:16 标清",
  ratio: "9:16",
  width: 576,
  height: 1024
}, {
  label: "9:16 高清",
  ratio: "9:16-hd",
  width: 1080,
  height: 1920
}, {
  label: "2:1",
  ratio: "2:1",
  width: 1024,
  height: 512
}, {
  label: "1:2",
  ratio: "1:2",
  width: 512,
  height: 1024
}];
const Generate = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<GenerationMode>("agent");
  const [prompt, setPrompt] = useState("");
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<string>("");
  const [selectedLoras, setSelectedLoras] = useState<string[]>([]);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("1:1");
  const [imageCount, setImageCount] = useState("1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAISelecting, setIsAISelecting] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isStyleDialogOpen, setIsStyleDialogOpen] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("generate");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();

  // 获取模型列表
  const {
    data: models,
    isLoading: modelsLoading
  } = useQuery({
    queryKey: ["liblib-models"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("liblib_models").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    }
  });

  // 获取对话历史
  const {
    data: conversationHistory
  } = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("chat_conversations").select(`
          *,
          chat_messages (*)
        `).order("updated_at", {
        ascending: false
      }).limit(20);
      if (error) throw error;
      return data;
    }
  });

  // 保存对话记录的mutation
  const saveConversationMutation = useMutation({
    mutationFn: async ({
      conversationId,
      messages
    }: {
      conversationId: string | null;
      messages: ChatMessage[];
    }) => {
      let convId = conversationId;

      // 如果没有会话ID，创建新会话
      if (!convId) {
        const {
          data: newConv,
          error: convError
        } = await supabase.from("chat_conversations").insert({}).select().single();
        if (convError) throw convError;
        convId = newConv.id;
        setCurrentConversationId(convId);
      }

      // 删除旧消息
      await supabase.from("chat_messages").delete().eq("conversation_id", convId);

      // 保存新消息
      const messagesToSave = messages.map(msg => ({
        conversation_id: convId,
        role: msg.type === "user" ? "user" : "assistant",
        content: msg.content || msg.prompt || "",
        images: msg.images ? {
          images: msg.images
        } : null
      }));
      const {
        error: msgError
      } = await supabase.from("chat_messages").insert(messagesToSave);
      if (msgError) throw msgError;
      return convId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["chat-conversations"]
      });
    }
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
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  };
  useEffect(() => {
    scrollToBottom();

    // 自动保存对话记录
    if (chatMessages.length > 0) {
      const timeoutId = setTimeout(() => {
        saveConversationMutation.mutate({
          conversationId: currentConversationId,
          messages: chatMessages
        });
      }, 1000); // 延迟1秒保存，避免频繁保存

      return () => clearTimeout(timeoutId);
    }
  }, [chatMessages]);

  // 从URL参数加载模板数据
  useEffect(() => {
    const promptParam = searchParams.get("prompt");
    const checkpointParam = searchParams.get("checkpoint");
    const lorasParam = searchParams.get("loras");
    const aspectRatioParam = searchParams.get("aspectRatio");
    const imageCountParam = searchParams.get("imageCount");
    if (promptParam) {
      setPrompt(promptParam);
      setMode("imageGeneration"); // 使用模板时切换到图片生成模式
    }
    if (checkpointParam) {
      setSelectedCheckpoint(checkpointParam);
    }
    if (lorasParam) {
      try {
        const loraModels = JSON.parse(lorasParam);
        const loraIds = loraModels.map((lora: any) => lora.modelId);
        setSelectedLoras(loraIds);
      } catch (e) {
        console.error("Failed to parse loras:", e);
      }
    }
    if (aspectRatioParam) {
      setSelectedAspectRatio(aspectRatioParam);
    }
    if (imageCountParam) {
      setImageCount(imageCountParam);
    }

    // 清除URL参数
    if (promptParam || checkpointParam || lorasParam) {
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);
  const handleAISelect = async () => {
    if (!prompt.trim()) {
      toast({
        title: "请输入提示词",
        description: "AI需要了解您的需求才能选择合适的模型",
        variant: "destructive"
      });
      return;
    }
    setIsAISelecting(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("ai-select-model", {
        body: {
          userPrompt: prompt
        }
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
        description: `${data.model_name}: ${data.reasoning}`
      });

      // 自动触发生成
      handleGenerate(data.model_id, data.reasoning);
    } catch (error: any) {
      console.error("AI selection error:", error);
      toast({
        title: "AI选择失败",
        description: error.message || "请稍后重试",
        variant: "destructive"
      });
      setIsAISelecting(false);
    }
  };
  const handleAgentChat = async () => {
    const currentPrompt = prompt.trim();
    if (!currentPrompt) {
      toast({
        title: "请输入内容",
        description: "请描述您的需求",
        variant: "destructive"
      });
      return;
    }

    // 检查用户是否登录
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({
        title: "请先登录",
        description: "登录后才能使用 AI 对话功能",
        variant: "destructive"
      });
      return;
    }

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: "user",
      content: currentPrompt,
      timestamp: new Date(),
      mode: "agent"
    };
    setChatMessages(prev => [...prev, userMessage]);
    setPrompt("");
    setIsGenerating(true);

    // 添加助手消息占位
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      type: "assistant",
      content: "",
      status: "processing",
      timestamp: new Date(),
      mode: "agent"
    };
    setChatMessages(prev => [...prev, assistantMessage]);
    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-chat`;

      // 获取对话历史
      const conversationHistory = chatMessages.filter(msg => msg.mode === "agent" && (msg.content || msg.prompt)).map(msg => ({
        role: msg.type === "user" ? "user" : "assistant",
        content: msg.content || msg.prompt || ""
      }));
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          messages: [...conversationHistory, {
            role: "user",
            content: currentPrompt
          }]
        })
      });
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("请求过于频繁，请稍后再试");
        }
        if (response.status === 402) {
          throw new Error("需要充值，请前往设置添加余额");
        }
        throw new Error("AI 服务暂时不可用");
      }
      if (!response.body) throw new Error("无法获取响应流");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";
      let streamDone = false;
      while (!streamDone) {
        const {
          done,
          value
        } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, {
          stream: true
        });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            // Don't break immediately - continue reading for tool_result
            continue;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta;

            // Handle tool result (image generation)
            if (delta?.tool_result) {
              const toolResult = delta.tool_result;
              // Update existing assistant message with tool result
              setChatMessages(prev => prev.map(msg => msg.id === assistantMessageId ? {
                ...msg,
                content: (msg.content || '') + (toolResult.content || ''),
                status: "completed" as const,
                images: toolResult.images,
                metadata: toolResult.metadata,
                checkpointId: toolResult.metadata?.checkpoint_id,
                loraIds: toolResult.metadata?.lora_ids,
                aspectRatio: toolResult.metadata?.aspect_ratio,
                imageCount: toolResult.metadata?.image_count?.toString()
              } : msg));
            } else {
              // Handle regular content
              const content = delta?.content as string | undefined;
              if (content) {
                assistantContent += content;
                setChatMessages(prev => prev.map(msg => msg.id === assistantMessageId ? {
                  ...msg,
                  content: assistantContent,
                  status: "completed" as const
                } : msg));
              }
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
      setIsGenerating(false);
    } catch (error: any) {
      console.error("Agent chat error:", error);
      setChatMessages(prev => prev.map(msg => msg.id === assistantMessageId ? {
        ...msg,
        status: "failed" as const
      } : msg));
      setIsGenerating(false);
      toast({
        title: "对话失败",
        description: error.message || "请稍后重试",
        variant: "destructive"
      });
    }
  };
  const handleGenerate = async (modelIdOverride?: string, reasoning?: string) => {
    // 检查用户是否登录
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({
        title: "请先登录",
        description: "登录后才能生成图片",
        variant: "destructive"
      });
      return;
    }
    
    const currentPrompt = prompt.trim();
    if (!currentPrompt) {
      toast({
        title: "请输入提示词",
        description: "提示词不能为空",
        variant: "destructive"
      });
      return;
    }

    // 使用AI选择时用override，否则检查用户选择
    let checkpointModel = null;
    let loraModelsSelected: any[] = [];
    let finalPrompt = currentPrompt;
    let finalReasoning = reasoning;
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

      // 如果用户没有选择底模或风格，使用AI自动选择并优化提示词
      if (!checkpointModel && loraModelsSelected.length === 0) {
        try {
          toast({
            title: "AI正在分析",
            description: "正在优化提示词并推荐模型..."
          });
          const {
            data: enhanceData,
            error: enhanceError
          } = await supabase.functions.invoke('ai-enhance-prompt', {
            body: {
              userInput: currentPrompt
            }
          });
          if (enhanceError) {
            console.error("AI enhancement error:", enhanceError);
            toast({
              title: "请选择模型",
              description: "请至少选择一个底模或风格模型",
              variant: "destructive"
            });
            return;
          }
          if (enhanceData) {
            console.log("AI enhancement result:", enhanceData);
            finalPrompt = enhanceData.enhanced_prompt || currentPrompt;
            finalReasoning = enhanceData.reasoning;
            if (enhanceData.checkpoint_id) {
              checkpointModel = models?.find(m => m.model_id === enhanceData.checkpoint_id);
            }
            if (enhanceData.lora_ids && enhanceData.lora_ids.length > 0) {
              loraModelsSelected = models?.filter(m => enhanceData.lora_ids.includes(m.model_id)) || [];
            }
            toast({
              title: "AI推荐完成",
              description: enhanceData.reasoning
            });
          }
        } catch (error: any) {
          console.error("AI enhancement failed:", error);
          toast({
            title: "请选择模型",
            description: "请至少选择一个底模或风格模型",
            variant: "destructive"
          });
          return;
        }
      }
    }

    // 至少需要选择一个模型
    if (!checkpointModel && loraModelsSelected.length === 0) {
      toast({
        title: "请选择模型",
        description: "请至少选择一个底模或风格模型",
        variant: "destructive"
      });
      return;
    }
    const loraNames = loraModelsSelected.map(l => l.name).join(" + ");
    const displayModelName = checkpointModel ? loraModelsSelected.length > 0 ? `${checkpointModel.name} + ${loraNames}` : checkpointModel.name : loraNames || "未知模型";
    const primaryModelId = checkpointModel?.model_id || loraModelsSelected[0]?.model_id || "";

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: "user",
      prompt: finalPrompt,
      modelName: displayModelName,
      modelId: primaryModelId,
      aiReasoning: finalReasoning,
      timestamp: new Date(),
      checkpointId: checkpointModel?.model_id,
      loraIds: loraModelsSelected.map(l => l.model_id),
      aspectRatio: selectedAspectRatio,
      imageCount: imageCount,
      mode: "imageGeneration"
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
      prompt: finalPrompt,
      checkpointId: checkpointModel?.model_id,
      loraIds: loraModelsSelected.map(l => l.model_id),
      aspectRatio: selectedAspectRatio,
      imageCount: imageCount,
      modelName: displayModelName,
      mode: "imageGeneration"
    };
    setChatMessages(prev => [...prev, assistantMessage]);

    // 获取选中比例的尺寸
    const aspectRatio = ASPECT_RATIOS.find(ar => ar.ratio === selectedAspectRatio) || ASPECT_RATIOS[0];
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("liblib-generate", {
        body: {
          prompt: finalPrompt,
          modelId: primaryModelId,
          modelName: displayModelName,
          checkpointId: checkpointModel?.model_id,
          loraIds: loraModelsSelected.map(l => l.model_id),
          width: aspectRatio.width,
          height: aspectRatio.height,
          imgCount: parseInt(imageCount),
          userId: session.user.id
        }
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
            setChatMessages(prev => prev.map(msg => msg.id === assistantMessageId ? {
              ...msg,
              status: "failed" as const
            } : msg));
            setIsGenerating(false);
            setIsAISelecting(false);
            toast({
              title: "生成超时",
              description: "生成时间过长，请稍后在历史记录中查看结果",
              variant: "destructive"
            });
            return;
          }
          const {
            data: historyData,
            error: historyError
          } = await supabase.from("generation_history").select("*").eq("id", historyId).single();
          if (historyError) {
            console.error("轮询错误:", historyError);
            return;
          }
          if (historyData.status === "completed" && (historyData.images || historyData.image_url)) {
            clearInterval(pollInterval);
            const imageUrls = historyData.images || (historyData.image_url ? [historyData.image_url] : []);
            setChatMessages(prev => prev.map(msg => msg.id === assistantMessageId ? {
              ...msg,
              status: "completed" as const,
              images: imageUrls,
              imageUrl: imageUrls[0]
            } : msg));
            setIsGenerating(false);
            setIsAISelecting(false);
            toast({
              title: "生成成功",
              description: `已生成 ${imageUrls.length} 张图片`
            });
          } else if (historyData.status === "failed") {
            clearInterval(pollInterval);
            setChatMessages(prev => prev.map(msg => msg.id === assistantMessageId ? {
              ...msg,
              status: "failed" as const
            } : msg));
            setIsGenerating(false);
            setIsAISelecting(false);
            toast({
              title: "生成失败",
              description: historyData.error_message || "请稍后重试",
              variant: "destructive"
            });
          }
        }, 2000);
      } else if (data.success && data.imageUrl) {
        setChatMessages(prev => prev.map(msg => msg.id === assistantMessageId ? {
          ...msg,
          status: "completed" as const,
          imageUrl: data.imageUrl
        } : msg));
        setIsGenerating(false);
        setIsAISelecting(false);
        toast({
          title: "生成成功",
          description: "图片已生成"
        });
      } else {
        throw new Error(data.error || "生成失败");
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      setChatMessages(prev => prev.map(msg => msg.id === assistantMessageId ? {
        ...msg,
        status: "failed" as const
      } : msg));
      setIsGenerating(false);
      setIsAISelecting(false);
      toast({
        title: "生成失败",
        description: error.message || "请稍后重试",
        variant: "destructive"
      });
    }
  };
  return <div className="flex flex-col h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* 顶部标题 */}
      

      {/* Tabs组件 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 border-b px-[80px] py-0 my-[20px]">
          <TabsList className="h-12">
            <TabsTrigger value="generate" className="gap-2">
              <Sparkles className="h-4 w-4" />
              图片生成
            </TabsTrigger>
            <TabsTrigger value="inspiration" className="gap-2">
              <Star className="h-4 w-4" />
              灵感广场
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <Clock className="h-4 w-4" />
              图片记录
            </TabsTrigger>
          </TabsList>
        </div>

        {/* 智能生成标签页 */}
        <TabsContent value="generate" className={`flex-1 flex flex-col mt-0 overflow-hidden ${activeTab !== "generate" ? "hidden" : ""}`}>
      {/* 对话列表区域 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {chatMessages.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Sparkles className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <p className="text-lg text-muted-foreground">开始您的创作之旅</p>
              <p className="text-sm text-muted-foreground/70 mt-2">输入提示词，让AI为您生成精美图片</p>
            </div> : chatMessages.map(message => <div key={message.id} className="space-y-4">
                {message.type === "user" && <div className="flex justify-end">
                    <Card className="max-w-2xl p-4 bg-primary/10 border-primary/20">
                      {message.mode === "agent" ? <p className="text-sm font-medium">{message.content || message.prompt}</p> : <div className="space-y-3">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">提示词</p>
                            <p className="text-sm font-medium">{message.prompt}</p>
                          </div>
                        
                        <div className="space-y-2 pt-2 border-t border-primary/20">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {message.checkpointId && <div>
                                <span className="text-muted-foreground">底模: </span>
                                <span className="font-medium">
                                  {models?.find(m => m.model_id === message.checkpointId)?.name || "未知"}
                                </span>
                              </div>}
                            {message.loraIds && message.loraIds.length > 0 && <div>
                                <span className="text-muted-foreground">风格: </span>
                                <span className="font-medium">
                                  {message.loraIds.map(id => models?.find(m => m.model_id === id)?.name).filter(Boolean).join(", ")}
                                </span>
                              </div>}
                            <div>
                              <span className="text-muted-foreground">宽高比: </span>
                              <span className="font-medium">{message.aspectRatio}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">数量: </span>
                              <span className="font-medium">{message.imageCount} 张</span>
                            </div>
                          </div>
                        </div>

                          {message.aiReasoning && <div className="pt-2 border-t border-primary/20">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                <Wand2 className="h-3 w-3" />
                                AI推荐理由
                              </div>
                              <p className="text-xs text-muted-foreground italic">
                                {message.aiReasoning}
                              </p>
                            </div>}
                        </div>}
                    </Card>
                  </div>}

                {message.type === "assistant" && <div className="flex justify-start">
                    <Card className="max-w-2xl p-4 bg-card border-accent/20">
                      {message.mode === "agent" && <div className="space-y-3">
                          {message.content && <div className="prose prose-sm max-w-none">
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            </div>}

                          {/* Agent生成的图片 */}
                          {message.images && message.images.length > 0 && <>
                              {message.metadata && <div className="pt-3 border-t border-border">
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                                    <Sparkles className="h-3 w-3" />
                                    生成参数
                                  </div>
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      {message.checkpointId && <div>
                                          <span className="text-muted-foreground">底模: </span>
                                          <span className="font-medium">
                                            {models?.find(m => m.model_id === message.checkpointId)?.name || message.checkpointId}
                                          </span>
                                        </div>}
                                      {message.loraIds && message.loraIds.length > 0 && <div>
                                          <span className="text-muted-foreground">风格: </span>
                                          <span className="font-medium">
                                            {message.loraIds.map(id => models?.find(m => m.model_id === id)?.name).filter(Boolean).join(", ") || `${message.loraIds.length} 个 LoRA`}
                                          </span>
                                        </div>}
                                      {message.aspectRatio && <div>
                                          <span className="text-muted-foreground">宽高比: </span>
                                          <span className="font-medium">{message.aspectRatio}</span>
                                        </div>}
                                      {message.imageCount && <div>
                                          <span className="text-muted-foreground">数量: </span>
                                          <span className="font-medium">{message.imageCount} 张</span>
                                        </div>}
                                    </div>
                                    {message.metadata.reasoning && <div className="pt-2 border-t border-border">
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                          <Wand2 className="h-3 w-3" />
                                          AI选择理由
                                        </div>
                                        <p className="text-xs text-muted-foreground italic">
                                          {message.metadata.reasoning}
                                        </p>
                                      </div>}
                                  </div>
                                </div>}
                              <div className="grid grid-cols-4 gap-2">
                                {message.images.map((url, idx) => <div key={idx} className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-muted cursor-pointer relative group" onClick={() => setEnlargedImage(url)}>
                                    <img src={url} alt={`Generated ${idx + 1}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                      <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </div>)}
                              </div>
                              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                                已完成 ({message.images.length} 张)
                              </Badge>
                            </>}
                        </div>}

                      {message.mode === "imageGeneration" && message.status === "processing" && <div className="flex flex-col items-center gap-4 py-8">
                          <Loader2 className="h-12 w-12 animate-spin text-primary" />
                          <p className="text-sm text-muted-foreground">正在生成图片...</p>
                          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                            生成中
                          </Badge>
                        </div>}

                      {message.mode === "imageGeneration" && message.status === "completed" && (message.images || message.imageUrl) && <div className="space-y-3">
                          {/* 显示最终使用的参数 */}
                          <div className="pb-3 border-b border-border">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                              <Sparkles className="h-3 w-3" />
                              最终使用的生成参数
                            </div>
                            <div className="space-y-2">
                              {message.prompt && <div>
                                  <span className="text-xs text-muted-foreground">提示词: </span>
                                  <span className="text-xs font-medium">{message.prompt}</span>
                                </div>}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {message.checkpointId && <div>
                                    <span className="text-muted-foreground">底模: </span>
                                    <span className="font-medium">
                                      {models?.find(m => m.model_id === message.checkpointId)?.name || "未知"}
                                    </span>
                                  </div>}
                                {message.loraIds && message.loraIds.length > 0 && <div>
                                    <span className="text-muted-foreground">风格: </span>
                                    <span className="font-medium">
                                      {message.loraIds.map(id => models?.find(m => m.model_id === id)?.name).filter(Boolean).join(", ")}
                                    </span>
                                  </div>}
                                <div>
                                  <span className="text-muted-foreground">宽高比: </span>
                                  <span className="font-medium">{message.aspectRatio}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">数量: </span>
                                  <span className="font-medium">{message.imageCount} 张</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-2">
                            {(message.images || [message.imageUrl]).filter(Boolean).map((url, idx) => <div key={idx} className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-muted cursor-pointer relative group" onClick={() => setEnlargedImage(url!)}>
                                <img src={url!} alt={`Generated ${idx + 1}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                  <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>)}
                          </div>
                          <div className="flex items-center justify-between">
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                              已完成 ({(message.images || [message.imageUrl]).filter(Boolean).length} 张)
                            </Badge>
                            <div className="flex gap-2">
                              {(() => {
                          const prevUserMessage = chatMessages.find(m => m.type === "user" && chatMessages.indexOf(m) === chatMessages.indexOf(message) - 1);
                          return prevUserMessage ? <>
                                    <Button size="sm" variant="outline" onClick={() => {
                              setPrompt(prevUserMessage.prompt || "");
                              setSelectedCheckpoint(prevUserMessage.checkpointId || "");
                              setSelectedLoras(prevUserMessage.loraIds || []);
                              setSelectedAspectRatio(prevUserMessage.aspectRatio || "1:1");
                              setImageCount(prevUserMessage.imageCount || "1");
                              toast({
                                title: "已加载参数",
                                description: "参数已填入输入框，可以修改后重新生成"
                              });
                            }}>
                                      <Edit className="h-4 w-4 mr-1" />
                                      编辑
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => {
                              setPrompt(prevUserMessage.prompt || "");
                              setSelectedCheckpoint(prevUserMessage.checkpointId || "");
                              setSelectedLoras(prevUserMessage.loraIds || []);
                              setSelectedAspectRatio(prevUserMessage.aspectRatio || "1:1");
                              setImageCount(prevUserMessage.imageCount || "1");
                              setTimeout(() => {
                                handleGenerate();
                              }, 100);
                            }} disabled={isGenerating || isAISelecting}>
                                      <RotateCcw className="h-4 w-4 mr-1" />
                                      重新生成
                                    </Button>
                                  </> : null;
                        })()}
                            </div>
                          </div>
                        </div>}

                      {message.mode === "imageGeneration" && message.status === "failed" && <div className="flex flex-col items-center gap-4 py-8 text-destructive">
                          <ImageIcon className="h-12 w-12" />
                          <p className="text-sm">生成失败，请重试</p>
                          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                            失败
                          </Badge>
                        </div>}
                    </Card>
                  </div>}
              </div>)}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 底部输入区域 */}
      <div className="flex-shrink-0 border-t bg-card/50 backdrop-blur-sm p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* 模式选择和输入区域 */}
          {mode === "imageGeneration" && <>
              {/* 模型选择 */}
              <div className="flex items-center gap-2 flex-wrap">
            {/* 底模选择 */}
            <Select value={selectedCheckpoint} onValueChange={setSelectedCheckpoint}>
              <SelectTrigger className="w-auto min-w-[180px]">
                <SelectValue placeholder="选择底模" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {modelsLoading ? <SelectItem value="loading" disabled>
                    加载中...
                  </SelectItem> : checkpointModels.length > 0 ? checkpointModels.map(model => <SelectItem key={model.id} value={model.model_id}>
                      <div className="flex items-center gap-2">
                        <span>{model.name}</span>
                        <Badge className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/20">
                          底模
                        </Badge>
                      </div>
                    </SelectItem>) : <SelectItem value="no-checkpoints" disabled>
                    暂无底模
                  </SelectItem>}
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
                      {selectedCheckpoint && <span className="text-sm text-muted-foreground ml-2">
                          - 基于 {checkpointModels.find(m => m.model_id === selectedCheckpoint)?.name}
                        </span>}
                    </DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="h-[60vh] pr-4">
                    {modelsLoading ? <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div> : filteredLoraModels.length > 0 ? <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {filteredLoraModels.map(model => {
                            const isSelected = selectedLoras.includes(model.model_id);
                            return <Card key={model.id} className={`cursor-pointer transition-all hover:shadow-lg ${isSelected ? 'ring-2 ring-primary' : ''}`} onClick={() => {
                              if (isSelected) {
                                setSelectedLoras(prev => prev.filter(id => id !== model.model_id));
                              } else if (selectedLoras.length < 5) {
                                setSelectedLoras(prev => [...prev, model.model_id]);
                              } else {
                                toast({
                                  title: "最多选择5个风格",
                                  description: "您已经选择了5个风格模型",
                                  variant: "destructive"
                                });
                              }
                            }}>
                              <div className="relative h-48 overflow-hidden rounded-t-lg bg-muted flex items-center justify-center">
                                {model.thumbnail_url ? <img src={model.thumbnail_url} alt={model.name} className="w-full h-full object-contain" /> : <div className="flex items-center justify-center h-full">
                                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                                  </div>}
                                {isSelected && <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                                    <span className="text-xs font-bold">✓</span>
                                  </div>}
                              </div>
                              <div className="p-3 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="font-medium text-sm line-clamp-1">{model.name}</h4>
                                  <Badge className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20 flex-shrink-0">
                                    风格
                                  </Badge>
                                </div>
                                {model.description && <p className="text-xs text-muted-foreground line-clamp-2">
                                    {model.description}
                                  </p>}
                              </div>
                            </Card>;
                          })}
                      </div> : <div className="flex flex-col items-center justify-center py-12 text-center">
                        <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                          {selectedCheckpoint ? "该底模暂无可用风格" : "请先选择底模"}
                        </p>
                      </div>}
                  </ScrollArea>
                </DialogContent>
              </Dialog>
              
              {selectedLoras.length > 0 && <div className="flex items-center gap-1 flex-wrap">
                  {selectedLoras.map(loraId => {
                      const lora = models?.find(m => m.model_id === loraId);
                      return <Badge key={loraId} variant="secondary" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20 cursor-pointer" onClick={() => setSelectedLoras(prev => prev.filter(id => id !== loraId))}>
                        {lora?.name} ×
                      </Badge>;
                    })}
                </div>}
            </div>

            <Button onClick={handleAISelect} disabled={isAISelecting || isGenerating || !prompt.trim()} variant="outline" size="sm">
              {isAISelecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              <span className="ml-2">AI选择</span>
            </Button>
          </div>

          {/* 图片比例选择 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">图片比例:</span>
            {ASPECT_RATIOS.map(ar => <Button key={ar.ratio} variant={selectedAspectRatio === ar.ratio ? "default" : "outline"} size="sm" onClick={() => setSelectedAspectRatio(ar.ratio)} disabled={isGenerating || isAISelecting} className="min-w-[60px]">
                {ar.label}
              </Button>)}
          </div>

          {/* 生成次数选择 */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">生成数量:</span>
            <RadioGroup value={imageCount} onValueChange={setImageCount} className="flex gap-2" disabled={isGenerating || isAISelecting}>
              {[1, 2, 3, 4].map(count => <div key={count} className="flex items-center space-x-2">
                  <RadioGroupItem value={count.toString()} id={`count-${count}`} disabled={isGenerating || isAISelecting} />
                  <Label htmlFor={`count-${count}`} className="text-sm font-normal cursor-pointer">
                    {count}张
                  </Label>
                </div>)}
            </RadioGroup>
          </div>

              {/* 输入框 */}
              <div className="flex gap-2">
                <Textarea placeholder='请输入图片生成的提示词，例如：做一张"中秋节"海报' value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!isGenerating && !isAISelecting && prompt.trim() && (selectedCheckpoint || selectedLoras.length > 0)) {
                      handleGenerate();
                    }
                  }
                }} className="min-h-[60px] resize-none" disabled={isGenerating || isAISelecting} />
                <Button onClick={() => handleGenerate()} disabled={isGenerating || isAISelecting || !prompt.trim() || !selectedCheckpoint && selectedLoras.length === 0} size="lg" className="px-6">
                  {isGenerating || isAISelecting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </div>
            </>}

          {mode === "agent" && <div className="flex gap-2 items-end">
              <Textarea placeholder="说说今天想做点什么" value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!isGenerating && prompt.trim()) {
                    handleAgentChat();
                  }
                }
              }} className="min-h-[60px] resize-none flex-1" disabled={isGenerating} />
              <Button onClick={handleAgentChat} disabled={isGenerating || !prompt.trim()} size="lg" className="px-6">
                {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </div>}

          {/* 模式选择器和会话历史 */}
          <div className="flex justify-between items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  {mode === "agent" ? "Agent 模式" : "图片生成"}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  创作类型
                </div>
                <DropdownMenuItem onClick={() => setMode("agent")} className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span>Agent 模式</span>
                  {mode === "agent" && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMode("imageGeneration")} className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  <span>图片生成</span>
                  {mode === "imageGeneration" && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <HistoryIcon className="h-4 w-4" />
                  会话历史
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                  <SheetTitle>对话历史</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-100px)] mt-4">
                  <div className="space-y-4">
                    {conversationHistory && conversationHistory.length > 0 ? conversationHistory.map((conversation: any) => {
                        const firstMessage = conversation.chat_messages?.[0];
                        const messageCount = conversation.chat_messages?.length || 0;
                        return <Card key={conversation.id} className="p-4 cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => {
                          // 恢复对话
                          const messages: ChatMessage[] = conversation.chat_messages.map((msg: any, idx: number) => ({
                            id: `${msg.id}-${idx}`,
                            type: msg.role as "user" | "assistant",
                            content: msg.content,
                            prompt: msg.content,
                            images: msg.images?.images || [],
                            timestamp: new Date(msg.created_at),
                            mode: "agent" as GenerationMode
                          }));
                          setChatMessages(messages);
                          setCurrentConversationId(conversation.id);
                          setIsHistoryOpen(false);
                          toast({
                            title: "已恢复对话",
                            description: `共 ${messageCount} 条消息`
                          });
                        }}>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Badge variant="outline" className="gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  {messageCount} 条消息
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(conversation.updated_at), {
                                  addSuffix: true,
                                  locale: zhCN
                                })}
                                </span>
                              </div>
                              {firstMessage && <p className="text-sm text-muted-foreground line-clamp-2">
                                  {firstMessage.content}
                                </p>}
                            </div>
                          </Card>;
                      }) : <div className="flex flex-col items-center justify-center py-12 text-center">
                        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">暂无对话历史</p>
                      </div>}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
        </TabsContent>

        {/* 灵感广场标签页 */}
        <TabsContent value="inspiration" className="flex-1 mt-0 overflow-hidden">
          <div className="h-full overflow-y-auto px-6 py-6">
            <InspirationGrid onUseTemplate={template => {
            // 切换回智能生成标签页
            setActiveTab("generate");
            // 填充模板参数
            if (template.prompt) {
              setPrompt(template.prompt);
            }
            if (template.checkpoint_id) {
              setSelectedCheckpoint(template.checkpoint_id);
            }
            if (template.lora_models && Array.isArray(template.lora_models)) {
              const loraIds = template.lora_models.map((lora: any) => lora.modelId || lora.model_id).filter(Boolean);
              setSelectedLoras(loraIds);
            }
            setMode("imageGeneration");
          }} />
          </div>
        </TabsContent>

        {/* 图片记录标签页 */}
        <TabsContent value="history" className="flex-1 mt-0 overflow-hidden">
          <div className="h-full overflow-y-auto px-6 py-6">
            <HistoryGrid />
          </div>
        </TabsContent>
      </Tabs>

      {/* 图片放大查看对话框 */}
      <Dialog open={!!enlargedImage} onOpenChange={open => !open && setEnlargedImage(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>查看图片</DialogTitle>
          </DialogHeader>
          {enlargedImage && <div className="flex flex-col items-center gap-4 p-6 pt-2">
              <div className="w-full max-h-[70vh] overflow-auto">
                <img src={enlargedImage} alt="Enlarged" className="w-full h-auto rounded-lg" />
              </div>
              <Button onClick={() => {
            const link = document.createElement('a');
            link.href = enlargedImage;
            link.download = `generated-image-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast({
              title: "下载已开始",
              description: "图片正在下载中..."
            });
          }} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                下载图片
              </Button>
            </div>}
        </DialogContent>
      </Dialog>
    </div>;
};
export default Generate;