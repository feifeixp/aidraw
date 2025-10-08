import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
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
import { convertMagentaToTransparent } from "@/lib/colorToTransparent";
import { useState } from "react";

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
  const [featherStrength, setFeatherStrength] = useState(50);
  const [showFeatherControl, setShowFeatherControl] = useState(false);

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
      // Step 1: Convert blob URL to base64
      const response = await fetch(activeLayer.imageUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      
      const base64Image = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Step 2: Use AI to replace background with magenta
      const { data: aiData, error: aiError } = await supabase.functions.invoke(
        'ai-remove-background',
        {
          body: { imageUrl: base64Image }
        }
      );

      if (aiError) throw aiError;

      if (aiData?.imageUrl) {
        // Step 3: Convert magenta color to transparent with feather strength
        toast.info("正在处理透明通道...");
        const transparentUrl = await convertMagentaToTransparent(aiData.imageUrl, featherStrength);
        
        // Update layer with transparent image
        updateLayer(activeLayer.id, { 
          imageUrl: transparentUrl,
          fabricObjects: []
        });
        toast.success("背景已去除");
        setShowFeatherControl(true);
      } else {
        throw new Error('No image returned from AI');
      }
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
    <div className="flex flex-col gap-2">
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

      {showFeatherControl && (
        <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
          <Label className="text-sm whitespace-nowrap">边缘羽化强度:</Label>
          <Slider
            value={[featherStrength]}
            onValueChange={(value) => setFeatherStrength(value[0])}
            min={0}
            max={100}
            step={5}
            className="flex-1"
          />
          <span className="text-sm font-medium w-12 text-right">{featherStrength}</span>
          <Button 
            size="sm" 
            onClick={handleRemoveBackground}
            variant="secondary"
          >
            重新处理
          </Button>
        </div>
      )}
    </div>
  );
};
