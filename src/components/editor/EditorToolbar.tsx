import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  MousePointer2,
  Crop,
  Scissors,
  Download,
  Undo,
  Redo,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
} from "lucide-react";
import { Canvas as FabricCanvas } from "fabric";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface EditorToolbarProps {
  canvas: FabricCanvas | null;
  activeTool: string;
  setActiveTool: (tool: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveState: () => void;
}

export const EditorToolbar = ({
  canvas,
  activeTool,
  setActiveTool,
  undo,
  redo,
  canUndo,
  canRedo,
  saveState,
}: EditorToolbarProps) => {
  const handleCrop = () => {
    if (!canvas) return;
    toast.info("请在画布上框选要裁剪的区域");
    setActiveTool("crop");
  };

  const handleUndo = () => {
    undo();
  };

  const handleRedo = () => {
    redo();
  };

  // Layer ordering functions
  const handleBringForward = () => {
    const activeObject = canvas?.getActiveObject();
    if (!activeObject) {
      toast.error("请先选择一个对象");
      return;
    }
    canvas?.bringObjectForward(activeObject);
    canvas?.renderAll();
    saveState();
    toast.success("已向前移动一层");
  };

  const handleSendBackwards = () => {
    const activeObject = canvas?.getActiveObject();
    if (!activeObject) {
      toast.error("请先选择一个对象");
      return;
    }
    canvas?.sendObjectBackwards(activeObject);
    canvas?.renderAll();
    saveState();
    toast.success("已向后移动一层");
  };

  const handleBringToFront = () => {
    const activeObject = canvas?.getActiveObject();
    if (!activeObject) {
      toast.error("请先选择一个对象");
      return;
    }
    canvas?.bringObjectToFront(activeObject);
    canvas?.renderAll();
    saveState();
    toast.success("已移到最前");
  };

  const handleSendToBack = () => {
    const activeObject = canvas?.getActiveObject();
    if (!activeObject) {
      toast.error("请先选择一个对象");
      return;
    }
    canvas?.sendObjectToBack(activeObject);
    canvas?.renderAll();
    saveState();
    toast.success("已移到最后");
  };

  const handleRedraw = async () => {
    if (!canvas) {
      toast.error("画布未初始化");
      return;
    }

    toast.info("正在融合图层并重新绘制，请稍候...");

    try {
      const canvasDataURL = canvas.toDataURL({
        format: "png",
        quality: 1,
        multiplier: 1,
      });

      const instruction = `Redraw this image with professional lighting and shading. Enhance the lighting, add proper shadows and highlights based on the environment and composition. Make it look more polished and professionally lit while keeping all subjects and elements in their exact positions.`;

      const { data: aiData, error: aiError } = await supabase.functions.invoke(
        'ai-edit-image',
        {
          body: { imageUrl: canvasDataURL, instruction }
        }
      );

      if (aiError) {
        console.error("AI service error:", aiError);
        throw new Error(`AI服务错误: ${aiError.message || '未知错误'}`);
      }

      if (aiData?.imageUrl) {
        const { FabricImage } = await import("fabric");
        
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = aiData.imageUrl;
        });
        
        const fabricImg = new FabricImage(img, {
          left: 0,
          top: 0,
          selectable: true,
        });
        
        const scaleX = canvas.width! / fabricImg.width!;
        const scaleY = canvas.height! / fabricImg.height!;
        const scale = Math.min(scaleX, scaleY);
        fabricImg.scale(scale);
        
        canvas.add(fabricImg);
        canvas.renderAll();
        
        saveState();
        
        toast.success("重绘完成！");
      } else {
        throw new Error('AI未返回图片');
      }
    } catch (error) {
      console.error("Redraw error:", error);
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      toast.error(`重绘失败: ${errorMessage}`);
    }
  };

  const handleExport = () => {
    if (!canvas) return;
    const dataURL = canvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 1,
    });
    const link = document.createElement("a");
    link.download = `artwork-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    toast.success("已导出画布");
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={activeTool === "select" ? "default" : "outline"}
        size="sm"
        onClick={() => setActiveTool("select")}
      >
        <MousePointer2 className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <Button variant="outline" size="sm" onClick={handleUndo} disabled={!canUndo}>
        <Undo className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={handleRedo} disabled={!canRedo}>
        <Redo className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <Button variant="outline" size="sm" onClick={handleCrop}>
        <Crop className="h-4 w-4 mr-1" />
        裁剪
      </Button>
      <Button variant="outline" size="sm">
        <Scissors className="h-4 w-4 mr-1" />
        绘制裁剪
      </Button>
      <Button variant="outline" size="sm" onClick={handleRedraw}>
        <Sparkles className="h-4 w-4 mr-1" />
        重绘
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <Button variant="outline" size="sm" onClick={handleBringToFront} title="移到最前">
        <ChevronsUp className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={handleBringForward} title="向前一层">
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={handleSendBackwards} title="向后一层">
        <ArrowDown className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={handleSendToBack} title="移到最后">
        <ChevronsDown className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <Button variant="outline" size="sm" onClick={handleExport}>
        <Download className="h-4 w-4 mr-1" />
        导出
      </Button>
    </div>
  );
};
