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
  Wand2,
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
import { Slider } from "@/components/ui/slider";

interface LeftToolbarProps {
  canvas: FabricCanvas | null;
  saveState: () => void;
  onActionComplete?: () => void;
}

export const LeftToolbar = ({ canvas, saveState, onActionComplete }: LeftToolbarProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [originalAiImage, setOriginalAiImage] = useState<string | null>(null);
  const [featherStrength, setFeatherStrength] = useState(50);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [showSubjectAngleDialog, setShowSubjectAngleDialog] = useState(false);
  const [showPoseDialog, setShowPoseDialog] = useState(false);
  const [showRemoveBgDialog, setShowRemoveBgDialog] = useState(false);
  const [showSmartComposeDialog, setShowSmartComposeDialog] = useState(false);
  const [composeMode, setComposeMode] = useState<"generate" | "edit">("generate");
  const [isComposing, setIsComposing] = useState(false);

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
          
          setTimeout(() => {
            toast.success("图片已添加");
            onActionComplete?.();
          }, 100);
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
    
    // Delay callbacks to ensure canvas operations complete
    setTimeout(() => {
      toast.success("文字已添加");
      onActionComplete?.();
    }, 100);
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
    
    setTimeout(() => {
      toast.success("矩形已添加");
      onActionComplete?.();
    }, 100);
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
    
    setTimeout(() => {
      toast.success("圆形已添加");
      onActionComplete?.();
    }, 100);
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
    
    setTimeout(() => {
      toast.success("三角形已添加");
      onActionComplete?.();
    }, 100);
  };

  // Remove Background
  const handleRemoveBackground = async () => {
    const activeObject = canvas?.getActiveObject();
    if (!canvas || !activeObject || activeObject.type !== 'image') {
      toast.error("请先选择画布上的图片");
      return;
    }

    setShowRemoveBgDialog(false);
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

  // Smart Compose - Extract canvas annotations and generate/edit image
  const handleSmartCompose = async () => {
    if (!canvas) {
      toast.error("画布未初始化");
      return;
    }

    setShowSmartComposeDialog(false);
    setIsComposing(true);

    // Extract all text elements as instructions
    const objects = canvas.getObjects();
    const textAnnotations: string[] = [];
    const shapes: string[] = [];
    let baseImage: any = null;

    objects.forEach((obj) => {
      if (obj.type === 'text') {
        const text = (obj as any).text;
        if (text && text !== '双击编辑文字') {
          textAnnotations.push(text);
        }
      } else if (['rect', 'circle', 'triangle', 'polygon'].includes(obj.type || '')) {
        const shapeDesc = `${obj.type} at position (${Math.round(obj.left || 0)}, ${Math.round(obj.top || 0)})`;
        shapes.push(shapeDesc);
      } else if (obj.type === 'image') {
        if (!baseImage) {
          baseImage = obj;
        }
      }
    });

    if (textAnnotations.length === 0 && shapes.length === 0) {
      toast.error("画布中没有文本标注或图形，无法生成提示");
      setIsComposing(false);
      return;
    }

    // Build instruction from annotations
    let instruction = "";
    if (textAnnotations.length > 0) {
      instruction += textAnnotations.join(". ") + ".";
    }
    if (shapes.length > 0) {
      instruction += ` Visual markers: ${shapes.join(", ")}.`;
    }

    toast.info(`正在使用AI ${composeMode === "generate" ? "生成" : "编辑"}图片，请稍候...`);
    console.log("Smart compose instruction:", instruction);

    try {
      if (composeMode === "generate") {
        // Generate new image from scratch
        const { data, error } = await supabase.functions.invoke('ai-generate-image', {
          body: { prompt: instruction }
        });

        if (error) throw error;

        if (data?.imageUrl) {
          const { FabricImage } = await import("fabric");
          const img = await FabricImage.fromURL(data.imageUrl, { crossOrigin: 'anonymous' });
          
          const canvasWidth = canvas.width || 1024;
          const canvasHeight = canvas.height || 768;
          const imgWidth = img.width || 1;
          const imgHeight = img.height || 1;
          const scale = Math.min(canvasWidth / imgWidth, canvasHeight / imgHeight, 1);
          
          img.scale(scale);
          img.set({
            left: (canvasWidth - imgWidth * scale) / 2,
            top: (canvasHeight - imgHeight * scale) / 2,
          });
          
          // Remove all text and shape annotations
          objects.forEach((obj) => {
            if (obj.type === 'text' || ['rect', 'circle', 'triangle', 'polygon'].includes(obj.type || '')) {
              canvas.remove(obj);
            }
          });
          
          canvas.add(img);
          canvas.sendObjectToBack(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
          saveState();
          toast.success("图片已生成");
        }
      } else {
        // Edit existing image
        if (!baseImage) {
          toast.error("画布中没有图片可以编辑");
          setIsComposing(false);
          return;
        }

        const imageDataURL = baseImage.toDataURL({
          format: 'png',
          quality: 1,
        });

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
            left: baseImage.left,
            top: baseImage.top,
            scaleX: baseImage.scaleX,
            scaleY: baseImage.scaleY,
          });
          
          // Remove all text and shape annotations
          objects.forEach((obj) => {
            if (obj.type === 'text' || ['rect', 'circle', 'triangle', 'polygon'].includes(obj.type || '')) {
              canvas.remove(obj);
            }
          });
          
          canvas.remove(baseImage);
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
          
          saveState();
          toast.success("图片已编辑");
        }
      }
    } catch (error) {
      console.error("Smart compose error:", error);
      toast.error("智能合成失败");
    } finally {
      setIsComposing(false);
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
        <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setShowRemoveBgDialog(true)}>
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

        <Separator />

        {/* Smart Compose */}
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-start" 
          onClick={() => setShowSmartComposeDialog(true)}
          disabled={isComposing}
        >
          <Wand2 className="h-4 w-4 mr-2" />
          {isComposing ? "处理中..." : "智能合成"}
        </Button>
      </div>

      {/* Camera Dialog */}
      <Dialog open={showCameraDialog} onOpenChange={setShowCameraDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>调整镜头</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="distance" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="distance">拍摄距离</TabsTrigger>
              <TabsTrigger value="angle">镜头角度</TabsTrigger>
              <TabsTrigger value="special">特殊镜头</TabsTrigger>
            </TabsList>
            <TabsContent value="distance" className="space-y-2">
              <Button onClick={() => handleAdjustCamera("an establishing shot showing the full environment and context", "建立镜头")} className="w-full">建立镜头 (Establishing Shot)</Button>
              <Button onClick={() => handleAdjustCamera("a full shot showing the entire subject from head to toe", "全景镜头")} className="w-full">全景镜头 (Full Shot)</Button>
              <Button onClick={() => handleAdjustCamera("a medium shot from waist up", "中景镜头")} className="w-full">中景镜头 (Medium Shot)</Button>
              <Button onClick={() => handleAdjustCamera("a close shot showing head and shoulders", "近景镜头")} className="w-full">近景镜头 (Close Shot)</Button>
              <Button onClick={() => handleAdjustCamera("an extreme close-up shot focusing on facial details or specific features", "特写镜头")} className="w-full">特写镜头 (Extreme Close Shot)</Button>
            </TabsContent>
            <TabsContent value="angle" className="space-y-2">
              <Button onClick={() => handleAdjustCamera("an up shot from a low angle looking upward", "仰视镜头")} className="w-full">仰视镜头 (Up Shot)</Button>
              <Button onClick={() => handleAdjustCamera("a down shot from a high angle looking downward", "俯视镜头")} className="w-full">俯视镜头 (Down Shot)</Button>
              <Button onClick={() => handleAdjustCamera("an eye level shot at the subject's eye level", "平视镜头")} className="w-full">平视镜头 (Eye Level)</Button>
            </TabsContent>
            <TabsContent value="special" className="space-y-2">
              <Button onClick={() => handleAdjustCamera("an over-the-shoulder shot looking past one person's shoulder at another", "肩上镜头")} className="w-full">肩上镜头 (Over The Shoulder)</Button>
              <Button onClick={() => handleAdjustCamera("a two-shot framing two subjects in the same frame", "双人镜头")} className="w-full">双人镜头 (Two-Shot)</Button>
              <Button onClick={() => handleAdjustCamera("a POV shot from the subject's point of view perspective", "主观视角")} className="w-full">主观视角 (POV Shot)</Button>
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

      {/* Remove Background Dialog */}
      <Dialog open={showRemoveBgDialog} onOpenChange={setShowRemoveBgDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>去除背景设置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feather-strength">透明通道羽化强度: {featherStrength}</Label>
              <Slider
                id="feather-strength"
                min={0}
                max={100}
                step={1}
                value={[featherStrength]}
                onValueChange={(value) => setFeatherStrength(value[0])}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">
                较低的值会产生更锐利的边缘，较高的值会产生更柔和的过渡
              </p>
            </div>
            <Button onClick={handleRemoveBackground} className="w-full">
              开始去除背景
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Smart Compose Dialog */}
      <Dialog open={showSmartComposeDialog} onOpenChange={setShowSmartComposeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>智能合成</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>合成模式</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={composeMode === "generate" ? "default" : "outline"}
                  onClick={() => setComposeMode("generate")}
                  className="w-full"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  生成新图
                </Button>
                <Button
                  variant={composeMode === "edit" ? "default" : "outline"}
                  onClick={() => setComposeMode("edit")}
                  className="w-full"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  编辑现有图
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>功能说明</Label>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>智能合成</strong>会分析画布中的所有文本标注和图形元素：
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong>生成新图</strong>：根据文本和图形标注生成全新的图片</li>
                  <li><strong>编辑现有图</strong>：基于画布中的图片，按照标注进行智能修改</li>
                </ul>
                <p className="mt-2">
                  提示：在画布中添加文本描述你想要的效果，添加图形标记重点区域，然后点击开始合成。
                </p>
              </div>
            </div>

            <Button onClick={handleSmartCompose} className="w-full" disabled={isComposing}>
              {isComposing ? "处理中..." : "开始合成"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};