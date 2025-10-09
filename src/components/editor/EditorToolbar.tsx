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
  Users,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
} from "lucide-react";
import { Canvas as FabricCanvas } from "fabric";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [featherStrength, setFeatherStrength] = useState(50);
  const [showFeatherControl, setShowFeatherControl] = useState(false);
  const [originalAiImage, setOriginalAiImage] = useState<string | null>(null);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [showPoseDialog, setShowPoseDialog] = useState(false);
  const [showSubjectAngleDialog, setShowSubjectAngleDialog] = useState(false);
  const [customPose, setCustomPose] = useState("");

  const handleCrop = () => {
    if (!canvas) return;
    toast.info("请在画布上框选要裁剪的区域");
    setActiveTool("crop");
  };

  const handleRemoveBackground = async () => {
    const activeObject = canvas?.getActiveObject();
    if (!canvas || !activeObject || activeObject.type !== 'image') {
      toast.error("请先选择画布上的图片");
      return;
    }

    toast.info("正在使用 AI 去除背景，请稍候...");
    try {
      // Convert image to dataURL
      const imageDataURL = (activeObject as any).toDataURL({
        format: 'png',
        quality: 1,
      });

      // Use AI to replace background with green
      const { data: aiData, error: aiError } = await supabase.functions.invoke(
        'ai-remove-background',
        {
          body: { imageUrl: imageDataURL }
        }
      );

      if (aiError) throw aiError;

      if (aiData?.imageUrl) {
        setOriginalAiImage(aiData.imageUrl);
        
        toast.info("正在处理透明通道...");
        const transparentUrl = await convertMagentaToTransparent(aiData.imageUrl, featherStrength);
        
        // Load new image and replace the old one
        const { FabricImage } = await import("fabric");
        const img = await FabricImage.fromURL(transparentUrl, { crossOrigin: 'anonymous' });
        
        // Copy position and scale from original
        img.set({
          left: activeObject.left,
          top: activeObject.top,
          scaleX: activeObject.scaleX,
          scaleY: activeObject.scaleY,
        });
        
        canvas.remove(activeObject);
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        
        saveState();
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
      saveState();
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

  const handleReprocessFeather = async () => {
    const activeObject = canvas?.getActiveObject();
    if (!originalAiImage || !activeObject) {
      toast.error("没有可重新处理的图片");
      return;
    }

    toast.info("正在重新处理透明通道...");
    try {
      const transparentUrl = await convertMagentaToTransparent(originalAiImage, featherStrength);
      
      // Load new image and replace the old one
      const { FabricImage } = await import("fabric");
      const img = await FabricImage.fromURL(transparentUrl, { crossOrigin: 'anonymous' });
      
      img.set({
        left: activeObject.left,
        top: activeObject.top,
        scaleX: activeObject.scaleX,
        scaleY: activeObject.scaleY,
      });
      
      canvas!.remove(activeObject);
      canvas!.add(img);
      canvas!.setActiveObject(img);
      canvas!.renderAll();
      
      toast.success("重新处理完成");
    } catch (error) {
      console.error("Reprocess error:", error);
      toast.error("重新处理失败");
    }
  };

  const handleAdjustCamera = async (setting: string, description: string) => {
    const activeObject = canvas?.getActiveObject();
    if (!canvas || !activeObject || activeObject.type !== 'image') {
      toast.error("请先选择画布上的图片");
      return;
    }

    setShowCameraDialog(false);
    toast.info(`正在调整镜头：${description}，请稍候...`);

    try {
      const imageDataURL = (activeObject as any).toDataURL({
        format: 'png',
        quality: 1,
      });

      const instruction = `Transform this image to use ${setting}. Keep the subject's appearance, clothing, and style exactly the same, only change the camera framing or angle as specified.`;

      const { data: aiData, error: aiError } = await supabase.functions.invoke(
        'ai-edit-image',
        {
          body: { imageUrl: imageDataURL, instruction }
        }
      );

      if (aiError) throw aiError;

      if (aiData?.imageUrl) {
        const { FabricImage } = await import("fabric");
        const img = await FabricImage.fromURL(aiData.imageUrl, { crossOrigin: 'anonymous' });
        
        img.set({
          left: activeObject.left,
          top: activeObject.top,
          scaleX: activeObject.scaleX,
          scaleY: activeObject.scaleY,
        });
        
        canvas.remove(activeObject);
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        
        saveState();
        toast.success("镜头调整完成");
      } else {
        throw new Error('No image returned from AI');
      }
    } catch (error) {
      console.error("Adjust camera error:", error);
      toast.error("镜头调整失败");
    }
  };

  const handleAdjustPose = async (pose: string) => {
    const activeObject = canvas?.getActiveObject();
    if (!canvas || !activeObject || activeObject.type !== 'image') {
      toast.error("请先选择画布上的图片");
      return;
    }

    setShowPoseDialog(false);
    toast.info(`正在调整为${pose}姿势，请稍候...`);

    try {
      const imageDataURL = (activeObject as any).toDataURL({
        format: 'png',
        quality: 1,
      });

      const instruction = `Change this character's pose to: ${pose}. Keep the character's appearance, clothing, style, and background exactly the same, only change the body pose and position.`;

      const { data: aiData, error: aiError } = await supabase.functions.invoke(
        'ai-edit-image',
        {
          body: { imageUrl: imageDataURL, instruction }
        }
      );

      if (aiError) throw aiError;

      if (aiData?.imageUrl) {
        const { FabricImage } = await import("fabric");
        const img = await FabricImage.fromURL(aiData.imageUrl, { crossOrigin: 'anonymous' });
        
        img.set({
          left: activeObject.left,
          top: activeObject.top,
          scaleX: activeObject.scaleX,
          scaleY: activeObject.scaleY,
        });
        
        canvas.remove(activeObject);
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        
        saveState();
        toast.success("姿势调整完成");
      } else {
        throw new Error('No image returned from AI');
      }
    } catch (error) {
      console.error("Adjust pose error:", error);
      toast.error("姿势调整失败");
    }
  };

  const handleAdjustSubjectAngle = async (angle: string, description: string) => {
    const activeObject = canvas?.getActiveObject();
    if (!canvas || !activeObject || activeObject.type !== 'image') {
      toast.error("请先选择画布上的图片");
      return;
    }

    setShowSubjectAngleDialog(false);
    toast.info(`正在调整为${description}，请稍候...`);

    try {
      const imageDataURL = (activeObject as any).toDataURL({
        format: 'png',
        quality: 1,
      });

      const instruction = `Rotate this subject to show them from ${angle}. Keep the subject's appearance, clothing, style, pose, and background exactly the same, only rotate the subject's body orientation to face ${angle}.`;

      const { data: aiData, error: aiError } = await supabase.functions.invoke(
        'ai-edit-image',
        {
          body: { imageUrl: imageDataURL, instruction }
        }
      );

      if (aiError) throw aiError;

      if (aiData?.imageUrl) {
        const { FabricImage } = await import("fabric");
        const img = await FabricImage.fromURL(aiData.imageUrl, { crossOrigin: 'anonymous' });
        
        img.set({
          left: activeObject.left,
          top: activeObject.top,
          scaleX: activeObject.scaleX,
          scaleY: activeObject.scaleY,
        });
        
        canvas.remove(activeObject);
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        
        saveState();
        toast.success("主体角度调整完成");
      } else {
        throw new Error('No image returned from AI');
      }
    } catch (error) {
      console.error("Adjust subject angle error:", error);
      toast.error("主体角度调整失败");
    }
  };

  const handleRedraw = async () => {
    if (!canvas) {
      toast.error("画布未初始化");
      return;
    }

    toast.info("正在融合图层并重新绘制，请稍候...");

    try {
      // Export the entire canvas as a single image (without clearing it first)
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
        // Load the redrawn image directly from base64
        const { FabricImage } = await import("fabric");
        
        // Create image from base64 data URL
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
        
        // Scale to fit canvas if needed
        const scaleX = canvas.width! / fabricImg.width!;
        const scaleY = canvas.height! / fabricImg.height!;
        const scale = Math.min(scaleX, scaleY);
        fabricImg.scale(scale);
        
        // Add to canvas first
        canvas.add(fabricImg);
        canvas.renderAll();
        
        // Save state for undo/redo
        saveState();
        
        toast.success("重绘完成！");
      } else {
        throw new Error('AI未返回图片');
      }
    } catch (error) {
      console.error("Redraw error:", error);
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      toast.error(`重绘失败: ${errorMessage}`);
      // Original canvas remains intact - no need to restore
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
        <Button variant="outline" size="sm" onClick={handleRemoveBackground}>
          <ImageOff className="h-4 w-4 mr-1" />
          去背景
        </Button>
        <Button variant="outline" size="sm" onClick={handleFlip}>
          <FlipHorizontal className="h-4 w-4 mr-1" />
          镜像
        </Button>
        <Button variant="outline" size="sm" onClick={handleRedraw}>
          <Sparkles className="h-4 w-4 mr-1" />
          重绘
        </Button>
        <Button variant="outline" size="sm" onClick={handleColorAdjust}>
          <Palette className="h-4 w-4 mr-1" />
          颜色
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowCameraDialog(true)}>
          <RotateCw className="h-4 w-4 mr-1" />
          调整相机
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowSubjectAngleDialog(true)}>
          <Users className="h-4 w-4 mr-1" />
          调整主体角度
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowPoseDialog(true)}>
          <PersonStanding className="h-4 w-4 mr-1" />
          调整动作
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

      <Dialog open={showCameraDialog} onOpenChange={setShowCameraDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>调整相机</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="shot-types" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="shot-types">镜头类型</TabsTrigger>
              <TabsTrigger value="angles">镜头角度</TabsTrigger>
            </TabsList>
            
            <TabsContent value="shot-types" className="space-y-4 py-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">基础镜头</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => handleAdjustCamera("extreme long shot (ELS)", "大远景")}>
                    大远景 (ELS)
                  </Button>
                  <Button variant="outline" onClick={() => handleAdjustCamera("long shot / wide shot (LS/WS)", "远景")}>
                    远景 (LS/WS)
                  </Button>
                  <Button variant="outline" onClick={() => handleAdjustCamera("full shot (FS)", "全身镜头")}>
                    全身镜头 (FS)
                  </Button>
                  <Button variant="outline" onClick={() => handleAdjustCamera("medium long shot / cowboy shot (MLS)", "中远景")}>
                    中远景 (MLS)
                  </Button>
                  <Button variant="outline" onClick={() => handleAdjustCamera("medium shot (MS)", "中景")}>
                    中景 (MS)
                  </Button>
                  <Button variant="outline" onClick={() => handleAdjustCamera("medium close-up (MCU)", "中近景")}>
                    中近景 (MCU)
                  </Button>
                  <Button variant="outline" onClick={() => handleAdjustCamera("close-up (CU)", "近景")}>
                    近景 (CU)
                  </Button>
                  <Button variant="outline" onClick={() => handleAdjustCamera("extreme close-up (ECU/XCU)", "大特写")}>
                    大特写 (ECU)
                  </Button>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">特殊镜头</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => handleAdjustCamera("point of view shot (POV)", "主观视角")}>
                    主观视角 (POV)
                  </Button>
                  <Button variant="outline" onClick={() => handleAdjustCamera("over the shoulder shot (OTS)", "过肩镜头")}>
                    过肩镜头 (OTS)
                  </Button>
                  <Button variant="outline" onClick={() => handleAdjustCamera("two shot", "双人镜头")}>
                    双人镜头
                  </Button>
                  <Button variant="outline" onClick={() => handleAdjustCamera("three shot", "三人镜头")}>
                    三人镜头
                  </Button>
                  <Button variant="outline" onClick={() => handleAdjustCamera("insert shot", "插入镜头")}>
                    插入镜头
                  </Button>
                  <Button variant="outline" onClick={() => handleAdjustCamera("reaction shot", "反应镜头")}>
                    反应镜头
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="angles" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => handleAdjustCamera("eye-level angle", "平视角度")}>
                  平视角度
                </Button>
                <Button variant="outline" onClick={() => handleAdjustCamera("high-angle shot", "俯视角度")}>
                  俯视角度
                </Button>
                <Button variant="outline" onClick={() => handleAdjustCamera("low-angle shot", "仰视角度")}>
                  仰视角度
                </Button>
                <Button variant="outline" onClick={() => handleAdjustCamera("worm's-eye view", "虫瞻视角")}>
                  虫瞻视角
                </Button>
                <Button variant="outline" onClick={() => handleAdjustCamera("bird's-eye view / top-down shot", "鸟瞰视角")}>
                  鸟瞰视角
                </Button>
                <Button variant="outline" onClick={() => handleAdjustCamera("dutch angle / canted angle", "荷兰式倾斜")}>
                  荷兰式倾斜
                </Button>
                <Button variant="outline" onClick={() => handleAdjustCamera("hip-level shot", "齐腰镜头")}>
                  齐腰镜头
                </Button>
                <Button variant="outline" onClick={() => handleAdjustCamera("knee-level shot", "齐膝镜头")}>
                  齐膝镜头
                </Button>
                <Button variant="outline" onClick={() => handleAdjustCamera("ground-level shot", "地面镜头")}>
                  地面镜头
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={showSubjectAngleDialog} onOpenChange={setShowSubjectAngleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>调整主体角度</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => handleAdjustSubjectAngle("the front", "正面")}>
                正面
              </Button>
              <Button variant="outline" onClick={() => handleAdjustSubjectAngle("the back", "背面")}>
                背面
              </Button>
              <Button variant="outline" onClick={() => handleAdjustSubjectAngle("the side", "侧面")}>
                侧面
              </Button>
              <Button variant="outline" onClick={() => handleAdjustSubjectAngle("three-quarter front view", "正侧面")}>
                正侧面 (3/4前)
              </Button>
              <Button variant="outline" onClick={() => handleAdjustSubjectAngle("three-quarter back view", "背侧面")}>
                背侧面 (3/4后)
              </Button>
            </div>
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
