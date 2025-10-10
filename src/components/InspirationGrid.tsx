import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Star, Copy, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface InspirationGridProps {
  onUseTemplate: (template: any) => void;
}

export const InspirationGrid = ({ onUseTemplate }: InspirationGridProps) => {
  const { toast } = useToast();
  
  const { data: templates, isLoading } = useQuery({
    queryKey: ["inspiration-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generation_history")
        .select("*")
        .eq("is_template", true)
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const handleUseTemplate = (template: any) => {
    onUseTemplate(template);
    
    toast({
      title: "已复制模板参数",
      description: "参数已填充到生成页面，可以开始生成了",
    });
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!templates || templates.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Star className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">还没有模板</p>
        <p className="text-sm text-muted-foreground mt-2">
          在生成历史中将喜欢的作品设为模板，它们就会出现在这里
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {templates.map((template) => {
        const ImageDisplay = () => {
          const [currentImageIndex, setCurrentImageIndex] = useState(0);
          const images = (template as any).images || (template.image_url ? [template.image_url] : []);
          
          if (images.length === 0) {
            return <ImageIcon className="h-12 w-12 text-muted-foreground/50" />;
          }

          return (
            <div className="relative w-full h-full">
              <img
                src={images[currentImageIndex]}
                alt={template.prompt}
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
          <Card key={template.id} className="overflow-hidden bg-gradient-to-br from-card via-card to-accent/5 border-accent/20 hover:border-primary/50 transition-all duration-300">
            <div className="aspect-square w-full overflow-hidden bg-muted flex items-center justify-center">
              <ImageDisplay />
            </div>
          
            <div className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  精选模板
                </Badge>
              </div>

              <p className="mb-3 text-sm line-clamp-2 font-medium">{template.prompt}</p>
              
              <div className="space-y-1 mb-3">
                <p className="text-xs text-muted-foreground">
                  模型: {template.model_name}
                </p>
                
                {template.checkpoint_id && (
                  <p className="text-xs text-muted-foreground">
                    底模: {template.checkpoint_id.substring(0, 8)}...
                  </p>
                )}
                
                {template.lora_models && Array.isArray(template.lora_models) && template.lora_models.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    风格数量: {template.lora_models.length}
                  </p>
                )}
              </div>

              <Button
                variant="default"
                size="sm"
                className="w-full"
                onClick={() => handleUseTemplate(template)}
              >
                <Copy className="h-4 w-4 mr-2" />
                做同款
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
