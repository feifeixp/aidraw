import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MousePointer2, Crop, Scissors, Download, Undo, Redo, Sparkles, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, Wand2, Check, X } from "lucide-react";
import { Canvas as FabricCanvas, FabricImage, Rect } from "fabric";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
interface EditorToolbarProps {
  canvas: FabricCanvas | null;
  activeTool: string;
  setActiveTool: (tool: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveState: () => void;
  isTaskProcessing: boolean;
  startTask: (taskName: string) => string;
  completeTask: (taskId: string) => void;
  cancelTask: () => void;
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
  isTaskProcessing,
  startTask,
  completeTask,
  cancelTask
}: EditorToolbarProps) => {
  const [showSmartComposeDialog, setShowSmartComposeDialog] = useState(false);
  const [composeMode, setComposeMode] = useState<"generate" | "edit">("generate");
  const [isComposing, setIsComposing] = useState(false);
  const [isCropMode, setIsCropMode] = useState(false);
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
    const cropRect = new Rect({
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
        multiplier: 1
      });
      const instruction = `Redraw this image with professional lighting and shading. Enhance the lighting, add proper shadows and highlights based on the environment and composition. Make it look more polished and professionally lit while keeping all subjects and elements in their exact positions.`;
      const {
        data: aiData,
        error: aiError
      } = await supabase.functions.invoke('ai-edit-image', {
        body: {
          imageUrl: canvasDataURL,
          instruction
        }
      });
      if (aiError) {
        console.error("AI service error:", aiError);
        throw new Error(`AI服务错误: ${aiError.message || '未知错误'}`);
      }
      if (aiData?.imageUrl) {
        const {
          FabricImage
        } = await import("fabric");
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = aiData.imageUrl;
        });
        const fabricImg = new FabricImage(img, {
          left: 0,
          top: 0,
          selectable: true
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
      multiplier: 1
    });
    const link = document.createElement("a");
    link.download = `artwork-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    toast.success("已导出画布");
  };
  const handleSmartCompose = async () => {
    if (!canvas) {
      toast.error("画布未初始化");
      return;
    }
    if (isTaskProcessing) {
      toast.error("当前有任务正在处理，请等待完成");
      return;
    }
    setShowSmartComposeDialog(false);
    setIsComposing(true);
    const taskId = startTask(composeMode === "generate" ? "正在生成图像" : "正在编辑图像");
    const objects = canvas.getObjects();
    const textAnnotations: string[] = [];
    const shapes: string[] = [];
    let baseImage: any = null;
    objects.forEach(obj => {
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
    let instruction = "";
    
    // If no annotations or shapes, use default redraw mode
    if (textAnnotations.length === 0 && shapes.length === 0) {
      instruction = "Enhance this image with professional lighting and shading. Fix any defects or missing areas in the image. Adjust the camera angle to make the composition more reasonable and visually appealing. Add proper shadows and highlights based on the environment.";
    } else {
      // Use annotations and shapes to build instruction
      if (textAnnotations.length > 0) {
        instruction += textAnnotations.join(". ") + ".";
      }
      if (shapes.length > 0) {
        instruction += ` Visual markers: ${shapes.join(", ")}.`;
      }
    }
    toast.info(`正在使用AI ${composeMode === "generate" ? "生成" : "编辑"}图片，请稍候...`);
    try {
      if (composeMode === "generate") {
        const {
          data,
          error
        } = await supabase.functions.invoke('ai-generate-image', {
          body: {
            prompt: instruction
          }
        });
        if (error) throw error;
        if (data?.imageUrl) {
          const {
            FabricImage
          } = await import("fabric");
          const img = await FabricImage.fromURL(data.imageUrl, {
            crossOrigin: 'anonymous'
          });
          const canvasWidth = canvas.width || 1024;
          const canvasHeight = canvas.height || 768;
          const imgWidth = img.width || 1;
          const imgHeight = img.height || 1;
          const scale = Math.min(canvasWidth / imgWidth, canvasHeight / imgHeight, 1);
          img.scale(scale);
          img.set({
            left: (canvasWidth - imgWidth * scale) / 2,
            top: (canvasHeight - imgHeight * scale) / 2
          });
          objects.forEach(obj => {
            if (obj.type === 'text' || ['rect', 'circle', 'triangle', 'polygon'].includes(obj.type || '')) {
              canvas.remove(obj);
            }
          });
          canvas.add(img);
          canvas.sendObjectToBack(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
          saveState();
          completeTask(taskId);
          toast.success("图片已生成");
        }
      } else {
        if (!baseImage) {
          toast.error("画布中没有图片可以编辑");
          setIsComposing(false);
          return;
        }
        const imageDataURL = baseImage.toDataURL({
          format: 'png',
          quality: 1
        });
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
            left: baseImage.left,
            top: baseImage.top,
            scaleX: baseImage.scaleX,
            scaleY: baseImage.scaleY
          });
          objects.forEach(obj => {
            if (obj.type === 'text' || ['rect', 'circle', 'triangle', 'polygon'].includes(obj.type || '')) {
              canvas.remove(obj);
            }
          });
          canvas.remove(baseImage);
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
          saveState();
          completeTask(taskId);
          toast.success("图片已编辑");
        }
      }
    } catch (error) {
      console.error("Smart compose error:", error);
      toast.error("智能合成失败");
      cancelTask();
    } finally {
      setIsComposing(false);
    }
  };
  return <div className="flex items-center gap-2">
      <Button variant={activeTool === "select" ? "default" : "outline"} size="sm" onClick={() => setActiveTool("select")} className="bg-white hover:bg-white/90">
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

      {isCropMode ? <>
          <Button variant="outline" size="sm" onClick={handleApplyCrop} className="text-green-600 hover:text-green-700">
            <Check className="h-4 w-4 mr-1" />
            应用裁剪
          </Button>
          <Button variant="outline" size="sm" onClick={handleCancelCrop} className="text-red-600 hover:text-red-700">
            <X className="h-4 w-4 mr-1" />
            取消
          </Button>
        </> : <Button variant="outline" size="sm" onClick={handleCrop} disabled={isTaskProcessing}>
          <Crop className="h-4 w-4 mr-1" />
          裁剪
        </Button>}
      
      <Button variant="outline" size="sm" onClick={handleRedraw} disabled={isTaskProcessing}>
        <Sparkles className="h-4 w-4 mr-1" />
        重绘
      </Button>
      <Button variant="outline" size="sm" onClick={() => setShowSmartComposeDialog(true)} disabled={isTaskProcessing || isComposing}>
        <Wand2 className="h-4 w-4 mr-1" />
        {isComposing ? "处理中..." : "智能合成"}
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
                <Button variant={composeMode === "generate" ? "default" : "outline"} onClick={() => setComposeMode("generate")} className="w-full">
                  <Sparkles className="h-4 w-4 mr-2" />
                  生成新图
                </Button>
                <Button variant={composeMode === "edit" ? "default" : "outline"} onClick={() => setComposeMode("edit")} className="w-full">
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
    </div>;
};