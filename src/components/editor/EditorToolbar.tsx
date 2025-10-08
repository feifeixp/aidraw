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
  RotateCw,
  PersonStanding,
} from "lucide-react";
import { Canvas as FabricCanvas } from "fabric";
import { Layer } from "@/pages/Editor";
import { toast } from "sonner";
import { removeBackground, loadImage } from "@/lib/backgroundRemoval";
import { supabase } from "@/integrations/supabase/client";
import { convertMagentaToTransparent } from "@/lib/colorToTransparent";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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
  const [originalAiImage, setOriginalAiImage] = useState<string | null>(null);
  const [showAngleDialog, setShowAngleDialog] = useState(false);
  const [showPoseDialog, setShowPoseDialog] = useState(false);
  const [customPose, setCustomPose] = useState("");

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
        // Save the original AI image for reprocessing
        setOriginalAiImage(aiData.imageUrl);
        
        // Step 3: Convert magenta color to transparent with feather strength
        toast.info("正在处理透明通道...");
        const transparentUrl = await convertMagentaToTransparent(aiData.imageUrl, featherStrength);
        
        // Remove old fabric objects from canvas before updating
        if (canvas && activeLayer.fabricObjects.length > 0) {
          activeLayer.fabricObjects.forEach(obj => {
            canvas.remove(obj);
          });
          canvas.renderAll();
        }
        
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

  const handleReprocessFeather = async () => {
    if (!originalAiImage || !activeLayer) {
      toast.error("没有可重新处理的图片");
      return;
    }

    toast.info("正在重新处理透明通道...");
    try {
      const transparentUrl = await convertMagentaToTransparent(originalAiImage, featherStrength);
      
      // Remove old fabric objects from canvas before updating
      if (canvas && activeLayer.fabricObjects.length > 0) {
        activeLayer.fabricObjects.forEach(obj => {
          canvas.remove(obj);
        });
        canvas.renderAll();
      }
      
      updateLayer(activeLayer.id, { 
        imageUrl: transparentUrl,
        fabricObjects: []
      });
      toast.success("重新处理完成");
    } catch (error) {
      console.error("Reprocess error:", error);
      toast.error("重新处理失败");
    }
  };

  const handleAdjustAngle = async (angle: string) => {
    if (!canvas || !activeLayer?.imageUrl) {
      toast.error("请先选择包含图片的图层");
      return;
    }

    setShowAngleDialog(false);
    toast.info(`正在调整到${angle}，请稍候...`);

    try {
      const response = await fetch(activeLayer.imageUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      
      const base64Image = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const instruction = `Transform this character to show them from a ${angle} view angle. Keep the character's appearance, clothing, and style exactly the same, only change the viewing angle.`;

      const { data: aiData, error: aiError } = await supabase.functions.invoke(
        'ai-edit-image',
        {
          body: { imageUrl: base64Image, instruction }
        }
      );

      if (aiError) throw aiError;

      if (aiData?.imageUrl) {
        if (canvas && activeLayer.fabricObjects.length > 0) {
          activeLayer.fabricObjects.forEach(obj => {
            canvas.remove(obj);
          });
          canvas.renderAll();
        }
        
        updateLayer(activeLayer.id, { 
          imageUrl: aiData.imageUrl,
          fabricObjects: []
        });
        toast.success("角度调整完成");
      } else {
        throw new Error('No image returned from AI');
      }
    } catch (error) {
      console.error("Adjust angle error:", error);
      toast.error("角度调整失败");
    }
  };

  const handleAdjustPose = async (pose: string) => {
    if (!canvas || !activeLayer?.imageUrl) {
      toast.error("请先选择包含图片的图层");
      return;
    }

    setShowPoseDialog(false);
    toast.info(`正在调整为${pose}姿势，请稍候...`);

    try {
      const response = await fetch(activeLayer.imageUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      
      const base64Image = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const instruction = `Change this character's pose to: ${pose}. Keep the character's appearance, clothing, style, and background exactly the same, only change the body pose and position.`;

      const { data: aiData, error: aiError } = await supabase.functions.invoke(
        'ai-edit-image',
        {
          body: { imageUrl: base64Image, instruction }
        }
      );

      if (aiError) throw aiError;

      if (aiData?.imageUrl) {
        if (canvas && activeLayer.fabricObjects.length > 0) {
          activeLayer.fabricObjects.forEach(obj => {
            canvas.remove(obj);
          });
          canvas.renderAll();
        }
        
        updateLayer(activeLayer.id, { 
          imageUrl: aiData.imageUrl,
          fabricObjects: []
        });
        toast.success("姿势调整完成");
      } else {
        throw new Error('No image returned from AI');
      }
    } catch (error) {
      console.error("Adjust pose error:", error);
      toast.error("姿势调整失败");
    }
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
        <Button variant="outline" size="sm" onClick={() => setShowAngleDialog(true)}>
          <RotateCw className="h-4 w-4 mr-1" />
          调整角度
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowPoseDialog(true)}>
          <PersonStanding className="h-4 w-4 mr-1" />
          调整动作
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
            onClick={handleReprocessFeather}
            variant="secondary"
          >
            重新处理
          </Button>
        </div>
      )}

      <Dialog open={showAngleDialog} onOpenChange={setShowAngleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>选择角度</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <Button variant="outline" onClick={() => handleAdjustAngle("front view")}>
              正面
            </Button>
            <Button variant="outline" onClick={() => handleAdjustAngle("back view")}>
              背面
            </Button>
            <Button variant="outline" onClick={() => handleAdjustAngle("side view")}>
              侧面
            </Button>
            <Button variant="outline" onClick={() => handleAdjustAngle("three-quarter front view")}>
              正面3/4
            </Button>
            <Button variant="outline" onClick={() => handleAdjustAngle("three-quarter back view")}>
              背后3/4
            </Button>
            <Button variant="outline" onClick={() => handleAdjustAngle("top view from above")}>
              上方
            </Button>
            <Button variant="outline" onClick={() => handleAdjustAngle("bottom view from below")}>
              下方
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPoseDialog} onOpenChange={setShowPoseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>选择或输入动作</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => handleAdjustPose("standing")}>
                站立
              </Button>
              <Button variant="outline" onClick={() => handleAdjustPose("sitting")}>
                坐着
              </Button>
              <Button variant="outline" onClick={() => handleAdjustPose("walking")}>
                行走
              </Button>
              <Button variant="outline" onClick={() => handleAdjustPose("running")}>
                奔跑
              </Button>
              <Button variant="outline" onClick={() => handleAdjustPose("jumping")}>
                跳跃
              </Button>
              <Button variant="outline" onClick={() => handleAdjustPose("waving")}>
                挥手
              </Button>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>自定义动作</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="输入自定义动作描述..."
                  value={customPose}
                  onChange={(e) => setCustomPose(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customPose.trim()) {
                      handleAdjustPose(customPose);
                      setCustomPose("");
                    }
                  }}
                />
                <Button 
                  onClick={() => {
                    if (customPose.trim()) {
                      handleAdjustPose(customPose);
                      setCustomPose("");
                    }
                  }}
                >
                  应用
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
