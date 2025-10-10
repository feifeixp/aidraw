import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Image as ImageIcon, Star, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export const HistoryGrid = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: history, isLoading } = useQuery({
    queryKey: ["generation-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generation_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
  });

  const toggleTemplateMutation = useMutation({
    mutationFn: async ({ id, isTemplate }: { id: string; isTemplate: boolean }) => {
      const { error } = await supabase
        .from("generation_history")
        .update({ is_template: isTemplate })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generation-history"] });
      queryClient.invalidateQueries({ queryKey: ["inspiration-templates"] });
      toast({
        title: "成功",
        description: "分享状态已更新",
      });
    },
    onError: () => {
      toast({
        title: "错误",
        description: "更新失败，请重试",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "processing":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "failed":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "已完成";
      case "processing":
        return "处理中";
      case "failed":
        return "失败";
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">还没有生成记录</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {history.map((item) => {
        const ImageDisplay = () => {
          const [currentImageIndex, setCurrentImageIndex] = useState(0);
          const images = (item as any).images || (item.image_url ? [item.image_url] : []);
          
          if (images.length === 0) {
            return <ImageIcon className="h-12 w-12 text-muted-foreground/50" />;
          }

          return (
            <div className="relative w-full h-full">
              <img
                src={images[currentImageIndex]}
                alt={item.prompt}
                className="h-full w-full object-cover"
              />
              {images.length > 1 && (
                <>
                  <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {currentImageIndex + 1}/{images.length}
                  </div>
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                    {images.map((_: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          idx === currentImageIndex 
                            ? 'bg-white w-4' 
                            : 'bg-white/50 hover:bg-white/70'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        };

        return (
          <Card key={item.id} className="overflow-hidden bg-gradient-to-br from-card via-card to-accent/5 border-accent/20">
            <div className="aspect-square w-full overflow-hidden bg-muted flex items-center justify-center">
              <ImageDisplay />
            </div>
          
            <div className="p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(item.status)}>
                    {getStatusText(item.status)}
                  </Badge>
                  {item.is_template && (
                    <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                      <Star className="h-3 w-3 mr-1" />
                      已分享
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(item.created_at), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>
              </div>

              <p className="mb-2 text-sm line-clamp-2">{item.prompt}</p>
              
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  模型: {item.model_name}
                </p>
                
                {item.task_uuid && (
                  <p className="text-xs text-muted-foreground">
                    任务ID: {item.task_uuid.substring(0, 8)}...
                  </p>
                )}
                
                {item.template_uuid && (
                  <p className="text-xs text-muted-foreground">
                    模板: {item.template_uuid === "6f7c4652458d4802969f8d089cf5b91f" ? "F.1文生图" : "1.5/XL文生图"}
                  </p>
                )}
                
                {item.checkpoint_id && (
                  <p className="text-xs text-muted-foreground">
                    底模: {item.checkpoint_id.substring(0, 8)}...
                  </p>
                )}
                
                {item.lora_models && Array.isArray(item.lora_models) && item.lora_models.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    LoRA: {(item.lora_models[0] as any).modelId.substring(0, 8)}... (权重: {(item.lora_models[0] as any).weight})
                  </p>
                )}
              </div>

              {item.error_message && (
                <p className="mt-2 text-xs text-destructive">
                  错误: {item.error_message}
                </p>
              )}

              <div className="mt-3 flex gap-2">
                {item.status === "completed" && (
                  <>
                    <Button
                      variant={item.is_template ? "secondary" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => toggleTemplateMutation.mutate({ 
                        id: item.id, 
                        isTemplate: !item.is_template 
                      })}
                    >
                      <Star className={`h-4 w-4 mr-2 ${item.is_template ? 'fill-current' : ''}`} />
                      {item.is_template ? "取消分享" : "分享"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const images = (item as any).images || (item.image_url ? [item.image_url] : []);
                        if (images.length > 0) {
                          // 下载第一张图片
                          const link = document.createElement('a');
                          link.href = images[0];
                          link.download = `image-${item.id}-${Date.now()}.png`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          toast({
                            title: "下载已开始",
                            description: images.length > 1 ? "已下载第一张图片" : "图片正在下载中...",
                          });
                        }
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
