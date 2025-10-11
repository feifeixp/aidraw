import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { MousePointer2, Download, Undo, Redo, Sparkles, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, Wand2, Camera, Maximize2, Hand } from "lucide-react";
import { CanvasSizeSettings } from "./CanvasSizeSettings";
import { Canvas as FabricCanvas, FabricImage } from "fabric";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  canvasSize: { width: number; height: number };
  onCanvasSizeChange: (size: { width: number; height: number }) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
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
  cancelTask,
  canvasSize,
  onCanvasSizeChange,
  zoom,
  onZoomChange
}: EditorToolbarProps) => {
  const [showSmartComposeDialog, setShowSmartComposeDialog] = useState(false);
  const [composeMode, setComposeMode] = useState<"generate" | "edit">("generate");
  const [isComposing, setIsComposing] = useState(false);
  const [showRecomposeDialog, setShowRecomposeDialog] = useState(false);
  const [customRecomposePrompt, setCustomRecomposePrompt] = useState("");
  const [showCanvasSizeDialog, setShowCanvasSizeDialog] = useState(false);
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
    
    // 查找frame对象
    const frame = canvas.getObjects().find((obj: any) => obj.name === 'workframe');
    if (!frame) {
      toast.error("未找到工作区域");
      return;
    }
    
    toast.info("正在融合图层并重新绘制，请稍候...");
    try {
      // 临时创建一个新canvas来渲染frame区域
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) {
        throw new Error('无法创建临时画布');
      }

      // 设置临时画布尺寸为frame尺寸
      tempCanvas.width = frame.width || 1024;
      tempCanvas.height = frame.height || 768;

      // 获取主画布的实际canvas元素
      const mainCanvasElement = canvas.getElement();
      
      // 将frame区域绘制到临时画布
      ctx.drawImage(
        mainCanvasElement,
        frame.left || 0,
        frame.top || 0,
        frame.width || 1024,
        frame.height || 768,
        0,
        0,
        tempCanvas.width,
        tempCanvas.height
      );

      // 从临时画布导出
      const canvasDataURL = tempCanvas.toDataURL('image/png', 1.0);
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
        
        // 先移除画布上所有非frame的对象
        const objects = canvas.getObjects();
        objects.forEach(obj => {
          if ((obj as any).name !== 'workframe') {
            canvas.remove(obj);
          }
        });
        
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = aiData.imageUrl;
        });
        const fabricImg = new FabricImage(img, {
          left: frame.left,
          top: frame.top,
          selectable: true
        });
        const scaleX = frame.width! / fabricImg.width!;
        const scaleY = frame.height! / fabricImg.height!;
        const scale = Math.min(scaleX, scaleY);
        fabricImg.scale(scale);
        canvas.add(fabricImg);
        
        // 确保frame保持在底层
        canvas.sendObjectToBack(frame as any);
        
        canvas.setActiveObject(fabricImg);
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
    
    // 查找frame对象
    const frame = canvas.getObjects().find((obj: any) => obj.name === 'workframe');
    if (!frame) {
      toast.error("未找到工作区域");
      return;
    }
    
    // 只导出frame区域内的内容
    const dataURL = canvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 1,
      left: frame.left,
      top: frame.top,
      width: frame.width,
      height: frame.height,
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

  const handleRecompose = async (instruction: string) => {
    if (!canvas) {
      toast.error("画布未初始化");
      return;
    }
    if (isTaskProcessing) {
      toast.error("当前有任务正在处理，请等待完成");
      return;
    }

    // 查找frame对象
    const frame = canvas.getObjects().find((obj: any) => obj.name === 'workframe');
    if (!frame) {
      toast.error("未找到工作区域");
      return;
    }

    setShowRecomposeDialog(false);
    const taskId = startTask("正在重新构图");

    try {
      // 临时创建一个新canvas来渲染frame区域
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) {
        throw new Error('无法创建临时画布');
      }

      // 设置临时画布尺寸为frame尺寸
      tempCanvas.width = frame.width || 1024;
      tempCanvas.height = frame.height || 768;

      // 获取主画布的实际canvas元素
      const mainCanvasElement = canvas.getElement();
      
      // 将frame区域绘制到临时画布
      ctx.drawImage(
        mainCanvasElement,
        frame.left || 0,
        frame.top || 0,
        frame.width || 1024,
        frame.height || 768,
        0,
        0,
        tempCanvas.width,
        tempCanvas.height
      );

      // 从临时画布导出
      const canvasDataURL = tempCanvas.toDataURL('image/png', 1.0);

      const { data: aiData, error: aiError } = await supabase.functions.invoke('ai-edit-image', {
        body: {
          imageUrl: canvasDataURL,
          instruction
        }
      });

      if (aiError) throw aiError;

      if (aiData?.imageUrl) {
        const { FabricImage } = await import("fabric");
        
        // 先移除画布上所有非frame的对象
        const objects = canvas.getObjects();
        objects.forEach(obj => {
          if ((obj as any).name !== 'workframe') {
            canvas.remove(obj);
          }
        });
        
        const img = await FabricImage.fromURL(aiData.imageUrl, {
          crossOrigin: 'anonymous'
        });

        const frameWidth = frame.width || 1024;
        const frameHeight = frame.height || 768;
        const imgWidth = img.width || 1;
        const imgHeight = img.height || 1;
        const scale = Math.min(frameWidth / imgWidth, frameHeight / imgHeight, 1);

        img.scale(scale);
        img.set({
          left: frame.left || 0,
          top: frame.top || 0
        });

        canvas.add(img);
        
        // 确保frame保持在底层
        canvas.sendObjectToBack(frame as any);
        
        canvas.setActiveObject(img);
        canvas.renderAll();
        saveState();
        completeTask(taskId);
        toast.success("重新构图完成");
        setCustomRecomposePrompt("");
      } else {
        throw new Error('AI未返回图片');
      }
    } catch (error) {
      console.error("Recompose error:", error);
      toast.error("重新构图失败");
      cancelTask();
    }
  };

  return <div className="flex items-center gap-2 flex-nowrap">
      <Button variant={activeTool === "select" ? "default" : "outline"} size="sm" onClick={() => setActiveTool("select")} className="bg-white hover:bg-white/90 shrink-0" title="选择工具">
        <MousePointer2 className="h-4 w-4" />
        <span className="ml-1">选择</span>
      </Button>
      <Button variant={activeTool === "pan" ? "default" : "outline"} size="sm" onClick={() => setActiveTool("pan")} className="shrink-0" title="平移画布 (H)">
        <Hand className="h-4 w-4" />
        <span className="ml-1">平移</span>
      </Button>

      <Separator orientation="vertical" className="h-6 shrink-0" />

      <Button variant="outline" size="sm" onClick={handleUndo} disabled={!canUndo} className="shrink-0" title="撤销">
        <Undo className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={handleRedo} disabled={!canRedo} className="shrink-0" title="重做">
        <Redo className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 shrink-0" />

      <Button variant="outline" size="sm" onClick={handleRedraw} disabled={isTaskProcessing} className="shrink-0 whitespace-nowrap" title="重绘">
        <Sparkles className="h-4 w-4" />
        <span className="ml-1">重绘</span>
      </Button>
      <Button variant="outline" size="sm" onClick={() => setShowSmartComposeDialog(true)} disabled={isTaskProcessing || isComposing} className="shrink-0 whitespace-nowrap" title="智能合成">
        <Wand2 className="h-4 w-4" />
        <span className="ml-1">{isComposing ? "处理中..." : "智能合成"}</span>
      </Button>
      <Button variant="outline" size="sm" onClick={() => setShowRecomposeDialog(true)} disabled={isTaskProcessing} className="shrink-0 whitespace-nowrap" title="重新构图">
        <Camera className="h-4 w-4" />
        <span className="ml-1">重新构图</span>
      </Button>

      <Separator orientation="vertical" className="h-6 shrink-0" />

      <Button variant="outline" size="sm" onClick={handleBringToFront} title="移到最前" className="shrink-0">
        <ChevronsUp className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={handleBringForward} title="向前一层" className="shrink-0">
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={handleSendBackwards} title="向后一层" className="shrink-0">
        <ArrowDown className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={handleSendToBack} title="移到最后" className="shrink-0">
        <ChevronsDown className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 shrink-0" />

      <Button variant="outline" size="sm" onClick={() => setShowCanvasSizeDialog(true)} className="shrink-0 whitespace-nowrap" title="画布尺寸">
        <Maximize2 className="h-4 w-4" />
        <span className="ml-1">画布尺寸</span>
      </Button>

      <Separator orientation="vertical" className="h-6 shrink-0" />

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm text-muted-foreground whitespace-nowrap">缩放</span>
        <Slider
          value={[zoom]}
          onValueChange={(values) => onZoomChange(values[0])}
          min={10}
          max={200}
          step={10}
          className="w-32"
        />
        <span className="text-sm text-muted-foreground whitespace-nowrap min-w-[3rem] text-right">{zoom}%</span>
      </div>

      <Separator orientation="vertical" className="h-6 shrink-0" />

      <Button variant="outline" size="sm" onClick={handleExport} className="shrink-0 whitespace-nowrap" title="导出">
        <Download className="h-4 w-4" />
        <span className="ml-1">导出</span>
      </Button>

      {/* Canvas Size Settings Dialog */}
      <CanvasSizeSettings
        open={showCanvasSizeDialog}
        onOpenChange={setShowCanvasSizeDialog}
        onApply={(width, height) => onCanvasSizeChange({ width, height })}
        currentWidth={canvasSize?.width || 1024}
        currentHeight={canvasSize?.height || 768}
      />

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

      {/* Recompose Dialog */}
      <Dialog open={showRecomposeDialog} onOpenChange={setShowRecomposeDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>重新构图</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="preset" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="preset">镜头类型</TabsTrigger>
              <TabsTrigger value="composition">构图类型</TabsTrigger>
              <TabsTrigger value="custom">自定义</TabsTrigger>
            </TabsList>

            <TabsContent value="preset" className="space-y-4">
              <div className="space-y-2">
                <Label>拍摄距离</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => handleRecompose("Transform this image to use an establishing shot showing the full environment and context")} className="w-full">建立镜头</Button>
                  <Button onClick={() => handleRecompose("Transform this image to use a full shot showing the entire subject from head to toe")} className="w-full">全景镜头</Button>
                  <Button onClick={() => handleRecompose("Transform this image to use a medium shot from waist up")} className="w-full">中景镜头</Button>
                  <Button onClick={() => handleRecompose("Transform this image to use a close shot showing head and shoulders")} className="w-full">近景镜头</Button>
                  <Button onClick={() => handleRecompose("Transform this image to use an extreme close-up shot focusing on facial details")} className="w-full">特写镜头</Button>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>镜头角度</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => handleRecompose("Transform this image to use an up shot from a low angle looking upward")} className="w-full">仰视镜头</Button>
                  <Button onClick={() => handleRecompose("Transform this image to use a down shot from a high angle looking downward")} className="w-full">俯视镜头</Button>
                  <Button onClick={() => handleRecompose("Transform this image to use an eye level shot at the subject's eye level")} className="w-full">平视镜头</Button>
                  <Button onClick={() => handleRecompose("Transform this image to use a bird's eye view from directly above")} className="w-full">鸟瞰镜头</Button>
                  <Button onClick={() => handleRecompose("Transform this image to use a worm's eye view from ground level looking up")} className="w-full">虫视镜头</Button>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>特殊镜头</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => handleRecompose("Transform this image to use an over-the-shoulder shot")} className="w-full">肩上镜头</Button>
                  <Button onClick={() => handleRecompose("Transform this image to use a two-shot framing two subjects")} className="w-full">双人镜头</Button>
                  <Button onClick={() => handleRecompose("Transform this image to use a POV shot from the subject's perspective")} className="w-full">主观视角</Button>
                  <Button onClick={() => handleRecompose("Transform this image to use a Dutch angle with tilted camera")} className="w-full">荷兰角度</Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="composition" className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => handleRecompose("Recompose this image using the rule of thirds with key elements at intersection points")} className="w-full">三分法构图</Button>
                <Button onClick={() => handleRecompose("Recompose this image with centered composition placing the main subject in the center")} className="w-full">中心构图</Button>
                <Button onClick={() => handleRecompose("Recompose this image with symmetrical composition creating perfect balance")} className="w-full">对称构图</Button>
                <Button onClick={() => handleRecompose("Recompose this image using leading lines to guide the viewer's eye")} className="w-full">引导线构图</Button>
                <Button onClick={() => handleRecompose("Recompose this image with diagonal composition creating dynamic energy")} className="w-full">对角线构图</Button>
                <Button onClick={() => handleRecompose("Recompose this image using frame within frame composition")} className="w-full">框架构图</Button>
                <Button onClick={() => handleRecompose("Recompose this image with golden ratio composition following the spiral")} className="w-full">黄金比例构图</Button>
                <Button onClick={() => handleRecompose("Recompose this image using negative space for minimalist impact")} className="w-full">留白构图</Button>
              </div>
            </TabsContent>

            <TabsContent value="custom" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom-recompose">自定义构图描述</Label>
                <Textarea
                  id="custom-recompose"
                  placeholder="例如：使用低角度仰视拍摄，突出主体的高大感；或使用浅景深模糊背景，突出前景主体..."
                  value={customRecomposePrompt}
                  onChange={(e) => setCustomRecomposePrompt(e.target.value)}
                  rows={4}
                />
                <p className="text-sm text-muted-foreground">
                  用自然语言描述你想要的镜头、角度和构图效果
                </p>
              </div>
              <Button 
                onClick={() => {
                  if (!customRecomposePrompt.trim()) {
                    toast.error("请输入构图描述");
                    return;
                  }
                  handleRecompose(customRecomposePrompt);
                }} 
                className="w-full"
              >
                应用自定义构图
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>;
};