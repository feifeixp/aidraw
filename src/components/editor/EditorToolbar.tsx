import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  MousePointer2,
  Crop,
  Scissors,
  ImageOff,
  FlipHorizontal,
  Palette,
  Download,
  Undo,
  Redo,
} from "lucide-react";
import { Canvas as FabricCanvas } from "fabric";
import { Layer } from "@/pages/Editor";
import { toast } from "sonner";
import { removeBackground, loadImage } from "@/lib/backgroundRemoval";
import { supabase } from "@/integrations/supabase/client";

interface EditorToolbarProps {
  canvas: FabricCanvas | null;
  activeTool: string;
  setActiveTool: (tool: string) => void;
  activeLayer?: Layer;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
}

export const EditorToolbar = ({
  canvas,
  activeTool,
  setActiveTool,
  activeLayer,
  updateLayer,
}: EditorToolbarProps) => {
  const handleCrop = () => {
    if (!canvas) return;
    toast.info("请在画布上框选要裁剪的区域");
    setActiveTool("crop");
  };

  const handleRemoveBackground = async () => {
    if (!canvas || !activeLayer?.imageUrl) {
      toast.error("请先选择包含图片的图层");
      return;
    }

    toast.info("正在使用 AI 去除背景，请稍候...");
    try {
      // First try AI background removal
      const { data: aiData, error: aiError } = await supabase.functions.invoke(
        'ai-remove-background',
        {
          body: { imageUrl: activeLayer.imageUrl }
        }
      );

      if (aiError) throw aiError;

      if (aiData?.imageUrl) {
        // Clear fabricObjects to force canvas reload
        updateLayer(activeLayer.id, { 
          imageUrl: aiData.imageUrl,
          fabricObjects: []
        });
        toast.success("AI 背景已去除");
        return;
      }

      // Fallback to local background removal if AI fails
      toast.info("使用本地方法去除背景...");
      const img = await loadImage(await fetch(activeLayer.imageUrl).then(r => r.blob()));
      const resultBlob = await removeBackground(img);
      const resultUrl = URL.createObjectURL(resultBlob);
      
      updateLayer(activeLayer.id, { 
        imageUrl: resultUrl,
        fabricObjects: []
      });
      toast.success("背景已去除");
    } catch (error) {
      console.error("Remove background error:", error);
      toast.error("去除背景失败");
    }
  };

  const handleFlip = () => {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      activeObject.set("flipX", !activeObject.flipX);
      canvas.renderAll();
      toast.success("已镜像反转");
    } else {
      toast.error("请先选择一个对象");
    }
  };

  const handleColorAdjust = () => {
    toast.info("颜色调整功能开发中");
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

  const handleUndo = () => {
    toast.info("撤销功能开发中");
  };

  const handleRedo = () => {
    toast.info("重做功能开发中");
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

      <Button variant="outline" size="sm" onClick={handleUndo}>
        <Undo className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={handleRedo}>
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
      <Button variant="outline" size="sm" onClick={handleRemoveBackground}>
        <ImageOff className="h-4 w-4 mr-1" />
        去背景
      </Button>
      <Button variant="outline" size="sm" onClick={handleFlip}>
        <FlipHorizontal className="h-4 w-4 mr-1" />
        镜像
      </Button>
      <Button variant="outline" size="sm" onClick={handleColorAdjust}>
        <Palette className="h-4 w-4 mr-1" />
        颜色
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <Button variant="outline" size="sm" onClick={handleExport}>
        <Download className="h-4 w-4 mr-1" />
        导出
      </Button>
    </div>
  );
};
