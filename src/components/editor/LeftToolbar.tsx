import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Plus, ImageOff, Palette, FlipHorizontal, RotateCw, Users, PersonStanding, Upload, Sparkles, Type, Square, Circle, Triangle, Wand2, MessageCircle, MessageSquare, Cloud, Crop, Check, X, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { Canvas as FabricCanvas, FabricText, Rect as FabricRect, Circle as FabricCircle, Triangle as FabricTriangle, Path, Group } from "fabric";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { convertMagentaToTransparent } from "@/lib/colorToTransparent";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
interface LeftToolbarProps {
  canvas: FabricCanvas | null;
  saveState: () => void;
  isTaskProcessing: boolean;
  startTask: (taskName: string) => string;
  completeTask: (taskId: string) => void;
  cancelTask: () => void;
  onActionComplete?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}
export const LeftToolbar = ({
  canvas,
  saveState,
  isTaskProcessing,
  startTask,
  completeTask,
  cancelTask,
  onActionComplete,
  isCollapsed = false,
  onToggleCollapse
}: LeftToolbarProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [originalAiImage, setOriginalAiImage] = useState<string | null>(null);
  const [featherStrength, setFeatherStrength] = useState(50);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [showSubjectAngleDialog, setShowSubjectAngleDialog] = useState(false);
  const [showPoseDialog, setShowPoseDialog] = useState(false);
  const [showRemoveBgDialog, setShowRemoveBgDialog] = useState(false);
  const [customPose, setCustomPose] = useState("");
  const [poseReferenceImage, setPoseReferenceImage] = useState<string | null>(null);
  const [isCropMode, setIsCropMode] = useState(false);
  const [showAiGenerateDialog, setShowAiGenerateDialog] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [selectedAiModel, setSelectedAiModel] = useState<"imagen" | "seedream">("imagen");

  // Add Image
  const handleUploadImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = event => {
          const imageUrl = event.target?.result as string;
          window.dispatchEvent(new CustomEvent('addImageToCanvas', {
            detail: {
              imageUrl,
              name: file.name
            }
          }));
          onActionComplete?.();
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };
  const handleGenerateImage = () => {
    setShowAiGenerateDialog(true);
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error("请输入提示词");
      return;
    }
    
    setIsGenerating(true);
    try {
      if (selectedAiModel === "imagen") {
        // 使用 Google Imagen (gemini-2.5-flash-image-preview)
        const { data, error } = await supabase.functions.invoke("ai-generate-image", {
          body: { prompt: aiPrompt }
        });
        if (error) throw error;
        if (data?.imageUrl) {
          window.dispatchEvent(new CustomEvent('addImageToCanvas', {
            detail: {
              imageUrl: data.imageUrl,
              name: "AI生成的图片"
            }
          }));
          toast.success("图片生成成功");
          setShowAiGenerateDialog(false);
          setAiPrompt("");
        }
      } else {
        // 使用 Seedream (liblib flux-dev)
        const { data, error } = await supabase.functions.invoke("liblib-generate", {
          body: {
            prompt: aiPrompt,
            modelId: "412b427ddb674b4dbab9e5abd5ae6057",
            modelName: "Flux Dev",
            aspectRatio: "1:1",
            imageCount: 1
          }
        });
        if (error) throw error;
        if (data?.taskId) {
          toast.success("图片生成任务已提交，请稍后查看历史记录");
          setShowAiGenerateDialog(false);
          setAiPrompt("");
        }
      }
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("图片生成失败");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddHistoryImageToCanvas = (imageUrl: string) => {
    window.dispatchEvent(new CustomEvent('addImageToCanvas', {
      detail: {
        imageUrl,
        name: "历史图片"
      }
    }));
    toast.success("图片已添加到画布");
    setShowAiGenerateDialog(false);
  };

  // Add Text
  const handleAddText = () => {
    if (!canvas) return;
    const text = new FabricText("双击编辑文字", {
      left: 100,
      top: 100,
      fontSize: 40,
      fill: "#000000"
    });
    canvas.add(text);
    canvas.bringObjectToFront(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    saveState();
    toast.success("文字已添加");
    onActionComplete?.();
  };

  // Add Shapes
  const handleAddRectangle = () => {
    if (!canvas) return;
    const rect = new FabricRect({
      left: 100,
      top: 100,
      fill: "#3b82f6",
      width: 200,
      height: 150
    });
    canvas.add(rect);
    canvas.bringObjectToFront(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
    saveState();
    toast.success("矩形已添加");
    onActionComplete?.();
  };
  const handleAddCircle = () => {
    if (!canvas) return;
    const circle = new FabricCircle({
      left: 100,
      top: 100,
      fill: "#10b981",
      radius: 75
    });
    canvas.add(circle);
    canvas.bringObjectToFront(circle);
    canvas.setActiveObject(circle);
    canvas.renderAll();
    saveState();
    toast.success("圆形已添加");
    onActionComplete?.();
  };
  const handleAddTriangle = () => {
    if (!canvas) return;
    const triangle = new FabricTriangle({
      left: 100,
      top: 100,
      fill: "#f59e0b",
      width: 150,
      height: 130
    });
    canvas.add(triangle);
    canvas.bringObjectToFront(triangle);
    canvas.setActiveObject(triangle);
    canvas.renderAll();
    saveState();
    toast.success("三角形已添加");
    onActionComplete?.();
  };

  // Add Speech Bubbles
  const handleAddRoundBubble = () => {
    if (!canvas) return;

    // Create round speech bubble using SVG path
    const bubblePath = "M 10 40 Q 10 10, 40 10 L 160 10 Q 190 10, 190 40 L 190 90 Q 190 120, 160 120 L 80 120 L 60 145 L 65 120 L 40 120 Q 10 120, 10 90 Z";
    const bubble = new Path(bubblePath, {
      left: 100,
      top: 100,
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 2
    });
    canvas.add(bubble);
    canvas.bringObjectToFront(bubble);
    canvas.setActiveObject(bubble);
    canvas.renderAll();
    saveState();
    toast.success("圆形对话泡泡已添加");
    onActionComplete?.();
  };
  const handleAddSquareBubble = () => {
    if (!canvas) return;

    // Create square speech bubble using SVG path
    const bubblePath = "M 10 10 L 190 10 L 190 120 L 80 120 L 60 145 L 65 120 L 10 120 Z";
    const bubble = new Path(bubblePath, {
      left: 100,
      top: 100,
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 2
    });
    canvas.add(bubble);
    canvas.bringObjectToFront(bubble);
    canvas.setActiveObject(bubble);
    canvas.renderAll();
    saveState();
    toast.success("方形对话泡泡已添加");
    onActionComplete?.();
  };
  const handleAddThoughtBubble = () => {
    if (!canvas) return;

    // Create thought bubble using SVG path (cloud shape)
    const cloudPath = "M 50 60 Q 30 60, 30 40 Q 30 25, 45 20 Q 50 5, 70 5 Q 85 5, 95 15 Q 110 10, 120 15 Q 135 15, 140 30 Q 155 35, 155 50 Q 155 65, 140 70 L 60 70 Q 45 70, 50 60 Z";
    const smallCircle = "M 35 95 Q 35 85, 45 85 Q 55 85, 55 95 Q 55 105, 45 105 Q 35 105, 35 95 Z";
    const tinyCircle = "M 20 115 Q 20 110, 25 110 Q 30 110, 30 115 Q 30 120, 25 120 Q 20 120, 20 115 Z";
    const mainCloud = new Path(cloudPath, {
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 2
    });
    const small = new Path(smallCircle, {
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 2
    });
    const tiny = new Path(tinyCircle, {
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 2
    });
    const thoughtBubble = new Group([mainCloud, small, tiny], {
      left: 100,
      top: 100
    });
    canvas.add(thoughtBubble);
    canvas.bringObjectToFront(thoughtBubble);
    canvas.setActiveObject(thoughtBubble);
    canvas.renderAll();
    saveState();
    toast.success("思考泡泡已添加");
    onActionComplete?.();
  };
  const handleAddSharpBubble = () => {
    if (!canvas) return;

    // Create sharp/spiky speech bubble using SVG path
    const bubblePath = "M 15 15 L 185 15 L 185 115 L 75 115 L 55 145 L 60 115 L 15 115 Z";
    const bubble = new Path(bubblePath, {
      left: 100,
      top: 100,
      fill: "#ffeb3b",
      stroke: "#000000",
      strokeWidth: 3
    });
    canvas.add(bubble);
    canvas.bringObjectToFront(bubble);
    canvas.setActiveObject(bubble);
    canvas.renderAll();
    saveState();
    toast.success("尖角对话泡泡已添加");
    onActionComplete?.();
  };

  // Remove Background
  const handleRemoveBackground = async () => {
    const activeObject = canvas?.getActiveObject();
    if (!canvas || !activeObject || activeObject.type !== 'image') {
      toast.error("请先选择画布上的图片");
      return;
    }
    if (isTaskProcessing) {
      toast.error("当前有任务正在处理，请等待完成");
      return;
    }
    setShowRemoveBgDialog(false);
    const taskId = startTask("正在移除背景");
    try {
      const imageDataURL = (activeObject as any).toDataURL({
        format: 'png',
        quality: 1
      });
      const {
        data: aiData,
        error: aiError
      } = await supabase.functions.invoke('ai-remove-background', {
        body: {
          imageUrl: imageDataURL
        }
      });
      if (aiError) throw aiError;
      if (aiData?.imageUrl) {
        setOriginalAiImage(aiData.imageUrl);
        toast.info("正在处理透明通道...");
        const transparentUrl = await convertMagentaToTransparent(aiData.imageUrl, featherStrength);
        const {
          FabricImage
        } = await import("fabric");
        const img = await FabricImage.fromURL(transparentUrl, {
          crossOrigin: 'anonymous'
        });
        img.set({
          left: activeObject.left,
          top: activeObject.top,
          scaleX: activeObject.scaleX,
          scaleY: activeObject.scaleY
        });
        canvas.remove(activeObject);
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        saveState();
        completeTask(taskId);
        toast.success("背景已去除");
      } else {
        throw new Error('No image returned from AI');
      }
    } catch (error) {
      console.error("Remove background error:", error);
      toast.error("去除背景失败");
      cancelTask();
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

  // Crop functionality
  const handleCrop = () => {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (!activeObject || activeObject.type !== 'image') {
      toast.error("请先选择一张图片");
      return;
    }

    // Enter crop mode
    setIsCropMode(true);

    // Create a semi-transparent overlay to show crop area
    const image = activeObject as any;
    const cropRect = new FabricRect({
      left: image.left || 0,
      top: image.top || 0,
      width: (image.width || 100) * (image.scaleX || 1),
      height: (image.height || 100) * (image.scaleY || 1),
      fill: 'transparent',
      stroke: '#3b82f6',
      strokeWidth: 2,
      strokeDashArray: [5, 5],
      cornerColor: '#3b82f6',
      cornerSize: 10,
      transparentCorners: false,
      lockRotation: true,
      hasControls: true,
      hasBorders: true,
      selectable: true,
      evented: true,
      data: {
        isCropRect: true,
        targetImage: image
      }
    });

    // Disable the image while cropping
    image.selectable = false;
    image.evented = false;
    canvas.add(cropRect);
    canvas.setActiveObject(cropRect);
    canvas.renderAll();
    toast.success("调整裁剪框，然后点击「应用裁剪」或「取消」", {
      duration: 3000
    });
    onActionComplete?.();
  };

  const handleApplyCrop = () => {
    if (!canvas) return;
    const cropRect = canvas.getActiveObject() as any;
    if (!cropRect || !cropRect.data?.isCropRect) {
      toast.error("请先进入裁剪模式");
      return;
    }
    const image = cropRect.data.targetImage;
    if (!image) {
      toast.error("找不到目标图片");
      return;
    }

    // Calculate crop dimensions relative to the image
    const imgLeft = image.left || 0;
    const imgTop = image.top || 0;
    const imgScaleX = image.scaleX || 1;
    const imgScaleY = image.scaleY || 1;
    const cropLeft = (cropRect.left || 0) - imgLeft;
    const cropTop = (cropRect.top || 0) - imgTop;
    const cropWidth = (cropRect.width || 0) * (cropRect.scaleX || 1);
    const cropHeight = (cropRect.height || 0) * (cropRect.scaleY || 1);

    // Create a new canvas to crop the image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropWidth;
    tempCanvas.height = cropHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
      toast.error("裁剪失败");
      return;
    }

    // Get the image element
    const imgElement = (image as any).getElement();

    // Draw the cropped portion
    tempCtx.drawImage(imgElement, cropLeft / imgScaleX, cropTop / imgScaleY, cropWidth / imgScaleX, cropHeight / imgScaleY, 0, 0, cropWidth, cropHeight);

    // Convert to data URL and create new image
    const croppedDataUrl = tempCanvas.toDataURL('image/png');
    import("fabric").then(({ FabricImage }) => {
      FabricImage.fromURL(croppedDataUrl, {
        crossOrigin: 'anonymous'
      }).then(newImg => {
        if (!newImg) return;
        newImg.set({
          left: cropRect.left,
          top: cropRect.top
        });

        // Remove the crop rect and old image
        canvas.remove(cropRect);
        canvas.remove(image);

        // Add the new cropped image
        canvas.add(newImg);
        canvas.setActiveObject(newImg);
        canvas.renderAll();
        saveState();
        setIsCropMode(false);
        toast.success("裁剪成功");
      }).catch(error => {
        console.error('Error creating cropped image:', error);
        toast.error("裁剪失败");
      });
    });
  };

  const handleCancelCrop = () => {
    if (!canvas) return;
    const cropRect = canvas.getActiveObject() as any;
    if (!cropRect || !cropRect.data?.isCropRect) {
      return;
    }
    const image = cropRect.data.targetImage;
    if (image) {
      image.selectable = true;
      image.evented = true;
    }
    canvas.remove(cropRect);
    if (image) {
      canvas.setActiveObject(image);
    }
    canvas.renderAll();
    setIsCropMode(false);
    toast.info("已取消裁剪");
  };
  const handleAdjustCamera = async (setting: string, description: string) => {
    const activeObject = canvas?.getActiveObject();
    if (!canvas || !activeObject || activeObject.type !== 'image') {
      toast.error("请先选择画布上的图片");
      return;
    }
    if (isTaskProcessing) {
      toast.error("当前有任务正在处理，请等待完成");
      return;
    }
    setShowCameraDialog(false);
    const taskId = startTask(`正在调整镜头：${description}`);
    try {
      const imageDataURL = (activeObject as any).toDataURL({
        format: 'png',
        quality: 1
      });
      const instruction = `Transform this image to use ${setting}. Keep the subject's appearance, clothing, and style exactly the same, only change the camera framing or angle as specified.`;
      const {
        data: aiData,
        error: aiError
      } = await supabase.functions.invoke('ai-edit-image', {
        body: {
          imageUrl: imageDataURL,
          instruction
        }
      });
      if (aiError) throw aiError;
      if (aiData?.imageUrl) {
        const {
          FabricImage
        } = await import("fabric");
        const img = await FabricImage.fromURL(aiData.imageUrl, {
          crossOrigin: 'anonymous'
        });
        img.set({
          left: activeObject.left,
          top: activeObject.top,
          scaleX: activeObject.scaleX,
          scaleY: activeObject.scaleY
        });
        canvas.remove(activeObject);
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        saveState();
        completeTask(taskId);
        toast.success("镜头调整完成");
      } else {
        throw new Error('No image returned from AI');
      }
    } catch (error) {
      console.error("Adjust camera error:", error);
      toast.error("镜头调整失败");
      cancelTask();
    }
  };
  const handleAdjustPose = async (pose: string, referenceImage?: string) => {
    const activeObject = canvas?.getActiveObject();
    if (!canvas || !activeObject || activeObject.type !== 'image') {
      toast.error("请先选择画布上的图片");
      return;
    }
    if (isTaskProcessing) {
      toast.error("当前有任务正在处理，请等待完成");
      return;
    }
    setShowPoseDialog(false);
    const taskId = startTask("正在调整姿势");
    try {
      const imageDataURL = (activeObject as any).toDataURL({
        format: 'png',
        quality: 1
      });
      let instruction = `Change this character's pose to: ${pose}. Keep the character's appearance, clothing, style, and background exactly the same, only change the body pose and position.`;
      if (referenceImage) {
        instruction = `Change this character's pose to match the pose shown in the reference image. Keep the character's appearance, clothing, style, and background exactly the same, only change the body pose and position to match the reference pose.`;
      }
      const requestBody: any = {
        imageUrl: imageDataURL,
        instruction
      };
      if (referenceImage) {
        requestBody.referenceImageUrl = referenceImage;
      }
      const {
        data: aiData,
        error: aiError
      } = await supabase.functions.invoke('ai-edit-image', {
        body: requestBody
      });
      if (aiError) throw aiError;
      if (aiData?.imageUrl) {
        const {
          FabricImage
        } = await import("fabric");
        const img = await FabricImage.fromURL(aiData.imageUrl, {
          crossOrigin: 'anonymous'
        });
        img.set({
          left: activeObject.left,
          top: activeObject.top,
          scaleX: activeObject.scaleX,
          scaleY: activeObject.scaleY
        });
        canvas.remove(activeObject);
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        saveState();
        completeTask(taskId);
        toast.success("姿势调整完成");
        setPoseReferenceImage(null);
        setCustomPose("");
      } else {
        throw new Error('No image returned from AI');
      }
    } catch (error) {
      console.error("Adjust pose error:", error);
      toast.error("姿势调整失败");
      cancelTask();
    }
  };
  const handleUploadPoseReference = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = event => {
          const imageUrl = event.target?.result as string;
          setPoseReferenceImage(imageUrl);
          toast.success("姿势参考线稿已上传");
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };
  const handleCustomPoseSubmit = () => {
    if (!customPose.trim()) {
      toast.error("请输入自定义动作描述");
      return;
    }
    handleAdjustPose(customPose, poseReferenceImage || undefined);
  };
  const handleAdjustSubjectAngle = async (angle: string, description: string) => {
    const activeObject = canvas?.getActiveObject();
    if (!canvas || !activeObject || activeObject.type !== 'image') {
      toast.error("请先选择画布上的图片");
      return;
    }
    if (isTaskProcessing) {
      toast.error("当前有任务正在处理，请等待完成");
      return;
    }
    setShowSubjectAngleDialog(false);
    const taskId = startTask(`正在调整为${description}`);
    try {
      const imageDataURL = (activeObject as any).toDataURL({
        format: 'png',
        quality: 1
      });
      const instruction = `Rotate this subject to show them from ${angle}. Keep the subject's appearance, clothing, style, pose, and background exactly the same, only rotate the subject's body orientation to face ${angle}.`;
      const {
        data: aiData,
        error: aiError
      } = await supabase.functions.invoke('ai-edit-image', {
        body: {
          imageUrl: imageDataURL,
          instruction
        }
      });
      if (aiError) throw aiError;
      if (aiData?.imageUrl) {
        const {
          FabricImage
        } = await import("fabric");
        const img = await FabricImage.fromURL(aiData.imageUrl, {
          crossOrigin: 'anonymous'
        });
        img.set({
          left: activeObject.left,
          top: activeObject.top,
          scaleX: activeObject.scaleX,
          scaleY: activeObject.scaleY
        });
        canvas.remove(activeObject);
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        saveState();
        completeTask(taskId);
        toast.success("主体角度调整完成");
      } else {
        throw new Error('No image returned from AI');
      }
    } catch (error) {
      console.error("Adjust subject angle error:", error);
      toast.error("主体角度调整失败");
      cancelTask();
    }
  };
  return <>
      <div className="flex flex-col gap-2 p-2 border-r border-border bg-background h-full">
        {/* Collapse Toggle Button */}
        {onToggleCollapse && (
          <Button 
            variant="ghost" 
            size="sm" 
            className={`${isCollapsed ? 'w-full px-0' : 'w-full justify-start'}`}
            onClick={onToggleCollapse}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                收起
              </>
            )}
          </Button>
        )}
        
        <Separator />

        {/* Add Element */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={`${isCollapsed ? 'w-full px-0' : 'w-full justify-start'}`} disabled={isGenerating || isTaskProcessing}>
              <Plus className="h-4 w-4" />
              {!isCollapsed && <span className="ml-2">添加元素</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={handleUploadImage}>
              <Upload className="h-4 w-4 mr-2" />
              上传图片
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleGenerateImage} disabled={isTaskProcessing}>
              <Sparkles className="h-4 w-4 mr-2" />
              AI生成图片
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
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleAddRoundBubble}>
              <MessageCircle className="h-4 w-4 mr-2" />
              圆形对话泡泡
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddSquareBubble}>
              <MessageSquare className="h-4 w-4 mr-2" />
              方形对话泡泡
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddThoughtBubble}>
              <Cloud className="h-4 w-4 mr-2" />
              思考泡泡
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddSharpBubble}>
              <Wand2 className="h-4 w-4 mr-2" />
              尖角对话泡泡
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator />

        {/* Image Editing */}
        {isCropMode ? (
          <>
            <Button variant="outline" size="sm" className={`${isCollapsed ? 'w-full px-0' : 'w-full justify-start'} text-green-600 hover:text-green-700`} onClick={handleApplyCrop}>
              <Check className="h-4 w-4" />
              {!isCollapsed && <span className="ml-2">应用裁剪</span>}
            </Button>
            <Button variant="outline" size="sm" className={`${isCollapsed ? 'w-full px-0' : 'w-full justify-start'} text-red-600 hover:text-red-700`} onClick={handleCancelCrop}>
              <X className="h-4 w-4" />
              {!isCollapsed && <span className="ml-2">取消</span>}
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" className={`${isCollapsed ? 'w-full px-0' : 'w-full justify-start'}`} onClick={handleCrop} disabled={isTaskProcessing}>
            <Crop className="h-4 w-4" />
            {!isCollapsed && <span className="ml-2">裁剪</span>}
          </Button>
        )}

        <Button variant="outline" size="sm" className={`${isCollapsed ? 'w-full px-0' : 'w-full justify-start'}`} onClick={() => setShowRemoveBgDialog(true)} disabled={isTaskProcessing}>
          <ImageOff className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">去背景</span>}
        </Button>

        <Button variant="outline" size="sm" className={`${isCollapsed ? 'w-full px-0' : 'w-full justify-start'}`} onClick={handleFlip}>
          <FlipHorizontal className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">镜像</span>}
        </Button>

        <Separator />

        {/* AI Adjustments */}
        <Button variant="outline" size="sm" className={`${isCollapsed ? 'w-full px-0' : 'w-full justify-start'}`} onClick={() => setShowCameraDialog(true)} disabled={isTaskProcessing}>
          <RotateCw className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">场景调整</span>}
        </Button>

        <Button variant="outline" size="sm" className={`${isCollapsed ? 'w-full px-0' : 'w-full justify-start'}`} onClick={() => setShowSubjectAngleDialog(true)} disabled={isTaskProcessing}>
          <Users className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">主体角度</span>}
        </Button>

        <Button variant="outline" size="sm" className={`${isCollapsed ? 'w-full px-0' : 'w-full justify-start'}`} onClick={() => setShowPoseDialog(true)} disabled={isTaskProcessing}>
          <PersonStanding className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">调整动作</span>}
        </Button>
      </div>

      {/* Camera Dialog - Scene Adjustment */}
      <Dialog open={showCameraDialog} onOpenChange={setShowCameraDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>场景调整</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="distance" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="distance">拍摄距离</TabsTrigger>
              <TabsTrigger value="angle">镜头角度</TabsTrigger>
            </TabsList>
            <TabsContent value="distance" className="space-y-2">
              <Button onClick={() => handleAdjustCamera("a full shot showing the entire subject from head to toe", "全景镜头")} className="w-full">全景镜头 (Full Shot)</Button>
              <Button onClick={() => handleAdjustCamera("a medium shot from waist up", "中景镜头")} className="w-full">中景镜头 (Medium Shot)</Button>
              <Button onClick={() => handleAdjustCamera("a close shot showing head and shoulders", "近景镜头")} className="w-full">近景镜头 (Close Shot)</Button>
              <Button onClick={() => handleAdjustCamera("a wide angle shot with ultra wide lens", "大广角")} className="w-full">大广角 (Wide Angle)</Button>
              <Button onClick={() => handleAdjustCamera("pull back the camera to increase distance from subject", "拉远")} className="w-full">拉远 (Pull Back)</Button>
              <Button onClick={() => handleAdjustCamera("push in the camera closer to the subject", "推进")} className="w-full">推进 (Push In)</Button>
            </TabsContent>
            <TabsContent value="angle" className="space-y-2">
              <Button onClick={() => handleAdjustCamera("an up shot from a low angle looking upward", "仰视镜头")} className="w-full">仰视镜头 (Up Shot)</Button>
              <Button onClick={() => handleAdjustCamera("a down shot from a high angle looking downward", "俯视镜头")} className="w-full">俯视镜头 (Down Shot)</Button>
              <Button onClick={() => handleAdjustCamera("an eye level shot at the subject's eye level", "平视镜头")} className="w-full">平视镜头 (Eye Level)</Button>
              <Button onClick={() => handleAdjustCamera("rotate the camera view 30 degrees to the left", "左转30度")} className="w-full">左转30度 (Rotate Left 30°)</Button>
              <Button onClick={() => handleAdjustCamera("rotate the camera view 30 degrees to the right", "右转30度")} className="w-full">右转30度 (Rotate Right 30°)</Button>
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>调整动作姿势</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="preset" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="preset">预设动作</TabsTrigger>
              <TabsTrigger value="custom">自定义</TabsTrigger>
              <TabsTrigger value="reference">线稿参考</TabsTrigger>
            </TabsList>
            
            <TabsContent value="preset" className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => handleAdjustPose("standing")} className="w-full">站立</Button>
                <Button onClick={() => handleAdjustPose("sitting")} className="w-full">坐着</Button>
                <Button onClick={() => handleAdjustPose("walking")} className="w-full">行走</Button>
                <Button onClick={() => handleAdjustPose("running")} className="w-full">跑步</Button>
                <Button onClick={() => handleAdjustPose("jumping")} className="w-full">跳跃</Button>
                <Button onClick={() => handleAdjustPose("lying down")} className="w-full">躺下</Button>
                <Button onClick={() => handleAdjustPose("kneeling")} className="w-full">跪下</Button>
                <Button onClick={() => handleAdjustPose("crouching")} className="w-full">蹲下</Button>
                <Button onClick={() => handleAdjustPose("raising arms")} className="w-full">举手</Button>
                <Button onClick={() => handleAdjustPose("waving")} className="w-full">挥手</Button>
                <Button onClick={() => handleAdjustPose("pointing")} className="w-full">指向</Button>
                <Button onClick={() => handleAdjustPose("dancing")} className="w-full">跳舞</Button>
                <Button onClick={() => handleAdjustPose("fighting stance")} className="w-full">战斗姿态</Button>
                <Button onClick={() => handleAdjustPose("meditation pose")} className="w-full">冥想姿势</Button>
                <Button onClick={() => handleAdjustPose("yoga pose")} className="w-full">瑜伽姿势</Button>
                <Button onClick={() => handleAdjustPose("thinking pose with hand on chin")} className="w-full">思考姿势</Button>
                <Button onClick={() => handleAdjustPose("superhero pose")} className="w-full">超级英雄姿势</Button>
                <Button onClick={() => handleAdjustPose("praying")} className="w-full">祈祷</Button>
              </div>
            </TabsContent>
            
            <TabsContent value="custom" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom-pose">输入自定义动作描述</Label>
                <Input id="custom-pose" placeholder="例如：双手抱胸站立、单膝跪地、伸展双臂..." value={customPose} onChange={e => setCustomPose(e.target.value)} onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleCustomPoseSubmit();
                }
              }} />
                <p className="text-sm text-muted-foreground">
                  用自然语言描述你想要的动作姿势，AI将尝试理解并调整角色姿势
                </p>
              </div>
              <Button onClick={handleCustomPoseSubmit} className="w-full">
                应用自定义动作
              </Button>
            </TabsContent>
            
            <TabsContent value="reference" className="space-y-4">
              <div className="space-y-2">
                <Label>上传姿势参考线稿</Label>
                {poseReferenceImage ? <div className="space-y-2">
                    <div className="relative w-full aspect-square border rounded-lg overflow-hidden bg-muted">
                      <img src={poseReferenceImage} alt="姿势参考" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleUploadPoseReference} className="flex-1">
                        重新上传
                      </Button>
                      <Button variant="outline" onClick={() => setPoseReferenceImage(null)} className="flex-1">
                        清除
                      </Button>
                    </div>
                  </div> : <Button variant="outline" onClick={handleUploadPoseReference} className="w-full h-32 border-dashed">
                    <Upload className="h-8 w-8 mr-2" />
                    点击上传姿势线稿
                  </Button>}
                <p className="text-sm text-muted-foreground">
                  上传一张姿势线稿或参考图片，AI将让选中的角色模仿该姿势
                </p>
              </div>
              {poseReferenceImage && <>
                  <div className="space-y-2">
                    <Label htmlFor="reference-pose-desc">补充描述（可选）</Label>
                    <Input id="reference-pose-desc" placeholder="例如：注意手部细节、保持平衡感..." value={customPose} onChange={e => setCustomPose(e.target.value)} />
                  </div>
                  <Button onClick={() => handleAdjustPose(customPose || "match the reference pose", poseReferenceImage)} className="w-full">
                    应用参考姿势
                  </Button>
                </>}
            </TabsContent>
          </Tabs>
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
              <Slider id="feather-strength" min={0} max={100} step={1} value={[featherStrength]} onValueChange={value => setFeatherStrength(value[0])} className="w-full" />
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

      {/* AI Generate Dialog */}
      <Dialog open={showAiGenerateDialog} onOpenChange={setShowAiGenerateDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>AI生成图片</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="generate" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="generate">直接生成</TabsTrigger>
              <TabsTrigger value="history">历史记录</TabsTrigger>
            </TabsList>
            
            <TabsContent value="generate" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ai-prompt">输入提示词</Label>
                  <Textarea
                    id="ai-prompt"
                    placeholder="描述你想生成的图片..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="min-h-[100px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.ctrlKey) {
                        handleAiGenerate();
                      }
                    }}
                  />
                  <p className="text-sm text-muted-foreground">
                    按 Ctrl+Enter 快速生成
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>选择模型</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={selectedAiModel === "imagen" ? "default" : "outline"}
                      onClick={() => setSelectedAiModel("imagen")}
                      className="w-full"
                    >
                      Google Imagen 4
                    </Button>
                    <Button
                      variant={selectedAiModel === "seedream" ? "default" : "outline"}
                      onClick={() => setSelectedAiModel("seedream")}
                      className="w-full"
                    >
                      Seedream 4.0
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedAiModel === "imagen" 
                      ? "Google Imagen 4: 快速生成，适合各种风格" 
                      : "Seedream 4.0: 高质量，更多细节"}
                  </p>
                </div>

                <Button 
                  onClick={handleAiGenerate} 
                  disabled={isGenerating || !aiPrompt.trim()}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      生成图片
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <HistoryImageGrid onSelectImage={handleAddHistoryImageToCanvas} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>;
};

// History Image Grid Component for AI Generate Dialog
const HistoryImageGrid = ({ onSelectImage }: { onSelectImage: (url: string) => void }) => {
  const { data: history, isLoading } = useQuery({
    queryKey: ["generation-history-dialog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generation_history")
        .select("*")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-8">
        <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
        <p className="text-muted-foreground">还没有生成记录</p>
        <p className="text-sm text-muted-foreground mt-2">前往「图片生成」页面生成图片</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        {history.map((item) => {
          const images = (item as any).images || (item.image_url ? [item.image_url] : []);
          const imageUrl = images[0];
          
          if (!imageUrl) return null;

          return (
            <div
              key={item.id}
              className="group relative aspect-square rounded-lg overflow-hidden border border-border hover:border-primary cursor-pointer transition-all"
              onClick={() => onSelectImage(imageUrl)}
            >
              <img
                src={imageUrl}
                alt={item.prompt}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Plus className="h-8 w-8 text-white" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-xs text-white line-clamp-2">{item.prompt}</p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};