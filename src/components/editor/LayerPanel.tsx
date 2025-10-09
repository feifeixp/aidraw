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
} from "lucide-react";
import { Element } from "@/pages/Editor";
import { useEffect } from "react";

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
  
  // Sync on mount
  useEffect(() => {
    syncElementsWithCanvas();
  }, []);

  return (
    <div className="h-full flex flex-col bg-background border-r border-border">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">元素</h3>
          <span className="text-xs text-muted-foreground">{elements.length} 个</span>
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
