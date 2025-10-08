import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Plus,
  ChevronUp,
  ChevronDown,
  Upload,
  Sparkles
} from "lucide-react";
import { Layer } from "@/pages/Editor";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LayerPanelProps {
  layers: Layer[];
  activeLayerId: string;
  setActiveLayerId: (id: string) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  addLayer: () => void;
  deleteLayer: (id: string) => void;
  moveLayer: (id: string, direction: "up" | "down") => void;
}

export const LayerPanel = ({
  layers,
  activeLayerId,
  setActiveLayerId,
  updateLayer,
  addLayer,
  deleteLayer,
  moveLayer,
}: LayerPanelProps) => {
  const [generatingForLayer, setGeneratingForLayer] = useState<string | null>(null);

  const handleUpload = (layerId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          updateLayer(layerId, { imageUrl: event.target?.result as string });
          toast.success("图片已上传");
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleGenerate = async (layerId: string) => {
    const prompt = window.prompt("请输入图片生成提示词：");
    if (!prompt) return;

    setGeneratingForLayer(layerId);
    try {
      const { data, error } = await supabase.functions.invoke("liblib-generate", {
        body: { 
          prompt,
          model_id: "flux-dev"
        }
      });

      if (error) throw error;
      
      if (data?.images?.[0]?.url) {
        updateLayer(layerId, { imageUrl: data.images[0].url });
        toast.success("图片生成成功");
      }
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("图片生成失败");
    } finally {
      setGeneratingForLayer(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background border-r border-border">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">图层</h3>
          <Button size="sm" variant="outline" onClick={addLayer}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {[...layers].reverse().map((layer, index) => {
            const isActive = layer.id === activeLayerId;
            const actualIndex = layers.length - 1 - index;
            
            return (
              <div
                key={layer.id}
                className={`border rounded-lg p-2 cursor-pointer transition-colors ${
                  isActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
                onClick={() => setActiveLayerId(layer.id)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    value={layer.name}
                    onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
                    className="h-7 text-sm flex-1"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateLayer(layer.id, { visible: !layer.visible });
                    }}
                  >
                    {layer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateLayer(layer.id, { locked: !layer.locked });
                    }}
                  >
                    {layer.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  </Button>
                </div>

                {layer.imageUrl && (
                  <div className="mb-2 rounded overflow-hidden">
                    <img src={layer.imageUrl} alt={layer.name} className="w-full h-20 object-cover" />
                  </div>
                )}

                <div className="flex gap-1 mb-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpload(layer.id);
                    }}
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    上传
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerate(layer.id);
                    }}
                    disabled={generatingForLayer === layer.id}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {generatingForLayer === layer.id ? "生成中..." : "生成"}
                  </Button>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-muted-foreground">不透明度: {layer.opacity}%</label>
                    <Slider
                      value={[layer.opacity]}
                      onValueChange={([value]) => updateLayer(layer.id, { opacity: value })}
                      max={100}
                      step={1}
                      className="mt-1"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayer(layer.id, "up");
                      }}
                      disabled={actualIndex === layers.length - 1}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayer(layer.id, "down");
                      }}
                      disabled={actualIndex === 0}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLayer(layer.id);
                      }}
                      disabled={layers.length <= 1}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
