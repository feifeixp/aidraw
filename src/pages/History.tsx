import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Clock, Image as ImageIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

const History = () => {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold bg-[var(--gradient-primary)] bg-clip-text text-transparent">
            生成历史
          </h1>
          <p className="mt-2 text-muted-foreground">
            查看所有的图片生成记录
          </p>
        </header>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">加载中...</p>
          </div>
        ) : history && history.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {history.map((item) => (
              <Card key={item.id} className="overflow-hidden bg-gradient-to-br from-card via-card to-accent/5 border-accent/20">
                <div className="aspect-square w-full overflow-hidden bg-muted flex items-center justify-center">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.prompt}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
                  )}
                </div>
                
                <div className="p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <Badge className={getStatusColor(item.status)}>
                      {getStatusText(item.status)}
                    </Badge>
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
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">还没有生成记录</p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default History;