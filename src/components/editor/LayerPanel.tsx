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
  ChevronUp,
  ChevronDown,
  Plus,
  Upload,
  Sparkles,
} from "lucide-react";
import { Element } from "@/pages/Editor";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LayerPanelProps {
  elements: Element[];
  activeElementId: string | null;
  setActiveElementId: (id: string | null) => void;
  updateElement: (id: string, updates: Partial<Element>) => void;
  deleteElement: (id: string) => void;
  moveElement: (id: string, direction: "up" | "down") => void;
  syncElementsWithCanvas: () => void;
}

export const LayerPanel = ({
  elements,
  activeElementId,
  setActiveElementId,
  updateElement,
  deleteElement,
  moveElement,
  syncElementsWithCanvas,
}: LayerPanelProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Sync on mount
  useEffect(() => {
    syncElementsWithCanvas();
  }, []);

  const handleUploadImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imageUrl = event.target?.result as string;
          // Trigger custom event to add image to canvas
          window.dispatchEvent(new CustomEvent('addImageToCanvas', { 
            detail: { imageUrl, name: file.name }
          }));
          toast.success("图片已添加");
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleGenerateImage = async () => {
    const prompt = window.prompt("请输入图片生成提示词：");
    if (!prompt) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("liblib-generate", {
        body: { 
          prompt,
          model_id: "flux-dev"
        }
      });

      if (error) throw error;
      
      if (data?.images?.[0]?.url) {
        // Trigger custom event to add image to canvas
        window.dispatchEvent(new CustomEvent('addImageToCanvas', { 
          detail: { imageUrl: data.images[0].url, name: "生成的图片" }
        }));
        toast.success("图片生成成功");
      }
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("图片生成失败");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background border-r border-border">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">元素</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{elements.length} 个</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={isGenerating}>
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleUploadImage}>
                  <Upload className="h-4 w-4 mr-2" />
                  上传图片
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleGenerateImage} disabled={isGenerating}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {isGenerating ? "生成中..." : "AI生成图片"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {elements.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              <p>暂无元素</p>
              <p className="text-xs mt-2">在画布上添加图片或绘制内容</p>
            </div>
          ) : (
            [...elements].reverse().map((element, index) => {
              const isActive = element.id === activeElementId;
              const actualIndex = elements.length - 1 - index;
              
              return (
                <div
                  key={element.id}
                  className={`border rounded-lg p-2 cursor-pointer transition-colors ${
                    isActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setActiveElementId(element.id)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Input
                      value={element.name}
                      onChange={(e) => updateElement(element.id, { name: e.target.value })}
                      className="h-7 text-sm flex-1"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        const newVisible = !element.visible;
                        updateElement(element.id, { visible: newVisible });
                        if (element.fabricObject) {
                          element.fabricObject.visible = newVisible;
                          element.fabricObject.canvas?.renderAll();
                        }
                      }}
                    >
                      {element.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        const newLocked = !element.locked;
                        updateElement(element.id, { locked: newLocked });
                        if (element.fabricObject) {
                          element.fabricObject.selectable = !newLocked;
                          element.fabricObject.evented = !newLocked;
                          element.fabricObject.canvas?.renderAll();
                        }
                      }}
                    >
                      {element.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground mb-2">
                    类型: {element.type}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-muted-foreground">不透明度: {element.opacity}%</label>
                      <Slider
                        value={[element.opacity]}
                        onValueChange={([value]) => {
                          updateElement(element.id, { opacity: value });
                          if (element.fabricObject) {
                            element.fabricObject.opacity = value / 100;
                            element.fabricObject.canvas?.renderAll();
                          }
                        }}
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
                          moveElement(element.id, "up");
                        }}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveElement(element.id, "down");
                        }}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteElement(element.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
