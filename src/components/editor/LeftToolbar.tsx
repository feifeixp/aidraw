import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  ImageOff,
  Palette,
  FlipHorizontal,
  RotateCw,
  Users,
  PersonStanding,
  Upload,
  Sparkles,
  Type,
  Square,
  Circle,
  Triangle,
} from "lucide-react";
import { Canvas as FabricCanvas, FabricText, Rect, Circle as FabricCircle, Triangle as FabricTriangle } from "fabric";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { convertMagentaToTransparent } from "@/lib/colorToTransparent";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

interface LeftToolbarProps {
  canvas: FabricCanvas | null;
  saveState: () => void;
}

export const LeftToolbar = ({ canvas, saveState }: LeftToolbarProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [originalAiImage, setOriginalAiImage] = useState<string | null>(null);
  const [featherStrength, setFeatherStrength] = useState(50);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [showSubjectAngleDialog, setShowSubjectAngleDialog] = useState(false);
  const [showPoseDialog, setShowPoseDialog] = useState(false);

  // Add Image
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

  // Add Text
  const handleAddText = () => {
    if (!canvas) return;
    
    const text = new FabricText("双击编辑文字", {
      left: 100,
      top: 100,
      fontSize: 40,
      fill: "#000000",
    });
    
    canvas.add(text);
    canvas.bringObjectToFront(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    saveState();
    toast.success("文字已添加");
  };

  // Add Shapes
  const handleAddRectangle = () => {
    if (!canvas) return;
    
    const rect = new Rect({
      left: 100,
      top: 100,
      fill: "#3b82f6",
      width: 200,
      height: 150,
    });
    
    canvas.add(rect);
    canvas.bringObjectToFront(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
    saveState();
    toast.success("矩形已添加");
  };

  const handleAddCircle = () => {
    if (!canvas) return;
    
    const circle = new FabricCircle({
      left: 100,
      top: 100,
      fill: "#10b981",
      radius: 75,
    });
    
    canvas.add(circle);
    canvas.bringObjectToFront(circle);
    canvas.setActiveObject(circle);
    canvas.renderAll();
    saveState();
    toast.success("圆形已添加");
  };

  const handleAddTriangle = () => {
    if (!canvas) return;
    
    const triangle = new FabricTriangle({
      left: 100,
      top: 100,
      fill: "#f59e0b",
      width: 150,
      height: 130,
    });
    
    canvas.add(triangle);
    canvas.bringObjectToFront(triangle);
    canvas.setActiveObject(triangle);
    canvas.renderAll();
    saveState();
    toast.success("三角形已添加");
  };

  // Remove Background
  const handleRemoveBackground = async () => {
    const activeObject = canvas?.getActiveObject();
    if (!canvas || !activeObject || activeObject.type !== 'image') {
      toast.error("请先选择画布上的图片");
      return;
    }

    toast.info("正在使用 AI 去除背景，请稍候...");
    try {
      const imageDataURL = (activeObject as any).toDataURL({
        format: 'png',
        quality: 1,
      });

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
        
        const { FabricImage } = await import("fabric");
        const img = await FabricImage.fromURL(transparentUrl, { crossOrigin: 'anonymous' });
        
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

  return (
    <>
      <div className="flex flex-col gap-2 p-2 border-r border-border bg-background h-full">
        {/* Add Element */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-start" disabled={isGenerating}>
              <Plus className="h-4 w-4 mr-2" />
              添加元素
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={handleUploadImage}>
              <Upload className="h-4 w-4 mr-2" />
              上传图片
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleGenerateImage} disabled={isGenerating}>
              <Sparkles className="h-4 w-4 mr-2" />
              {isGenerating ? "生成中..." : "AI生成图片"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleAddText}>
              <Type className="h-4 w-4 mr-2" />
              添加文字
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleAddRectangle}>
              <Square className="h-4 w-4 mr-2" />
              矩形
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddCircle}>
              <Circle className="h-4 w-4 mr-2" />
              圆形
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddTriangle}>
              <Triangle className="h-4 w-4 mr-2" />
              三角形
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator />

        {/* Image Editing */}
        <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleRemoveBackground}>
          <ImageOff className="h-4 w-4 mr-2" />
          去背景
        </Button>

        <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleColorAdjust}>
          <Palette className="h-4 w-4 mr-2" />
          颜色
        </Button>

        <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleFlip}>
          <FlipHorizontal className="h-4 w-4 mr-2" />
          镜像
        </Button>

        <Separator />

        {/* AI Adjustments */}
        <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setShowCameraDialog(true)}>
          <RotateCw className="h-4 w-4 mr-2" />
          调整相机
        </Button>

        <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setShowSubjectAngleDialog(true)}>
          <Users className="h-4 w-4 mr-2" />
          主体角度
        </Button>

        <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setShowPoseDialog(true)}>
          <PersonStanding className="h-4 w-4 mr-2" />
          调整动作
        </Button>
      </div>

      {/* Camera Dialog */}
      <Dialog open={showCameraDialog} onOpenChange={setShowCameraDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>调整镜头</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="angle" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="angle">镜头角度</TabsTrigger>
              <TabsTrigger value="distance">拍摄距离</TabsTrigger>
            </TabsList>
            <TabsContent value="angle" className="space-y-2">
              <Button onClick={() => handleAdjustCamera("a low angle shot looking up", "低角度仰拍")} className="w-full">低角度仰拍</Button>
              <Button onClick={() => handleAdjustCamera("a high angle shot looking down", "高角度俯拍")} className="w-full">高角度俯拍</Button>
              <Button onClick={() => handleAdjustCamera("an eye level shot", "平视角度")} className="w-full">平视角度</Button>
            </TabsContent>
            <TabsContent value="distance" className="space-y-2">
              <Button onClick={() => handleAdjustCamera("a close-up shot", "特写镜头")} className="w-full">特写镜头</Button>
              <Button onClick={() => handleAdjustCamera("a medium shot", "中景镜头")} className="w-full">中景镜头</Button>
              <Button onClick={() => handleAdjustCamera("a wide shot", "远景镜头")} className="w-full">远景镜头</Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Subject Angle Dialog */}
      <Dialog open={showSubjectAngleDialog} onOpenChange={setShowSubjectAngleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>调整主体角度</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Button onClick={() => handleAdjustSubjectAngle("the front", "正面")} className="w-full">正面</Button>
            <Button onClick={() => handleAdjustSubjectAngle("the left side", "左侧面")} className="w-full">左侧面</Button>
            <Button onClick={() => handleAdjustSubjectAngle("the right side", "右侧面")} className="w-full">右侧面</Button>
            <Button onClick={() => handleAdjustSubjectAngle("the back", "背面")} className="w-full">背面</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pose Dialog */}
      <Dialog open={showPoseDialog} onOpenChange={setShowPoseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>调整动作姿势</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Button onClick={() => handleAdjustPose("standing")} className="w-full">站立</Button>
            <Button onClick={() => handleAdjustPose("sitting")} className="w-full">坐着</Button>
            <Button onClick={() => handleAdjustPose("walking")} className="w-full">行走</Button>
            <Button onClick={() => handleAdjustPose("running")} className="w-full">跑步</Button>
            <Button onClick={() => handleAdjustPose("jumping")} className="w-full">跳跃</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};