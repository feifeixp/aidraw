import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { MousePointer2, Download, Undo, Redo, Sparkles, Wand2, Camera, Maximize2, Hand, Grid3x3 } from "lucide-react";
import { StoryboardFrameSettings } from "./StoryboardFrameSettings";
import { Canvas as FabricCanvas, FabricImage, Rect as FabricRect, FabricText } from "fabric";
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
  zoom: number;
  onZoomChange: (zoom: number) => void;
  activeFrameId: string | null;
  onActiveFrameChange: (frameId: string | null) => void;
  storyboardFrameCount: number;
  setStoryboardFrameCount: (count: number) => void;
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
  zoom,
  onZoomChange,
  activeFrameId,
  onActiveFrameChange,
  storyboardFrameCount,
  setStoryboardFrameCount
}: EditorToolbarProps) => {
  const [showSmartComposeDialog, setShowSmartComposeDialog] = useState(false);
  const [composeMode, setComposeMode] = useState<"compose" | "render">("compose");
  const [replaceOriginal, setReplaceOriginal] = useState(true);
  const [isComposing, setIsComposing] = useState(false);
  const [showRecomposeDialog, setShowRecomposeDialog] = useState(false);
  const [customRecomposePrompt, setCustomRecomposePrompt] = useState("");
  const [showStoryboardSettings, setShowStoryboardSettings] = useState(false);
  const [frameSize, setFrameSize] = useState({ width: 1024, height: 768 });
  const handleUndo = () => {
    undo();
  };
  const handleRedo = () => {
    redo();
  };

  // 创建分镜frame的函数
  const handleCreateStoryboardFrame = () => {
    if (!canvas) {
      toast.error("画布未初始化");
      return;
    }

    // 分镜布局配置
    const COLS = 5; // 5列
    const ROWS = 8; // 8行
    const INFINITE_CANVAS_SIZE = 10000;
    
    // 使用可配置的分镜尺寸
    const FRAME_WIDTH = frameSize.width;
    const FRAME_HEIGHT = frameSize.height;
    const SPACING = 50; // 间距
    
    // 计算整个网格的尺寸
    const totalWidth = COLS * FRAME_WIDTH + (COLS - 1) * SPACING;
    const totalHeight = ROWS * FRAME_HEIGHT + (ROWS - 1) * SPACING;
    
    // 计算起始位置（居中）
    const START_X = (INFINITE_CANVAS_SIZE - totalWidth) / 2;
    const START_Y = (INFINITE_CANVAS_SIZE - totalHeight) / 2;

    // 计算当前frame在网格中的位置
    const frameIndex = storyboardFrameCount;
    const col = frameIndex % COLS;
    const row = Math.floor(frameIndex / COLS);

    // 检查是否超过最大frame数量
    if (frameIndex >= COLS * ROWS) {
      toast.error(`已达到最大分镜数量 (${COLS * ROWS})`);
      return;
    }

    // 计算frame位置
    const x = START_X + col * (FRAME_WIDTH + SPACING);
    const y = START_Y + row * (FRAME_HEIGHT + SPACING);

    // 创建frame矩形（类似workframe，不可选择，放在底层）
    const frame = new FabricRect({
      left: x,
      top: y,
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
      fill: 'white',
      stroke: '#d1d5db',
      strokeWidth: 1,
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      hoverCursor: 'default',
      name: `storyboard-frame-${frameIndex + 1}`
    });

    // 创建frame边界线（默认不显示，只有激活时才显示）
    const frameBorder = new FabricRect({
      left: x,
      top: y,
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
      fill: 'transparent',
      stroke: '#3b82f6',
      strokeWidth: 2,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      hoverCursor: 'pointer',
      visible: false,
      name: `storyboard-border-${frameIndex + 1}`
    });

    // 创建frame编号文本（显示在分镜外左上方，与分镜左边对齐）
    const frameNumber = new FabricText(`${frameIndex + 1}`, {
      left: x,
      top: y - 20,
      fontSize: 14,
      fill: '#666666',
      selectable: false,
      evented: false,
      name: `storyboard-number-${frameIndex + 1}`
    });

    // 添加到画布，确保frame在底层
    canvas.add(frame);
    canvas.add(frameBorder);
    canvas.add(frameNumber);
    
    // 确保所有分镜frame在底层，所有border和number在顶层
    canvas.getObjects().forEach(obj => {
      const objName = (obj as any).name || '';
      if (objName.startsWith('storyboard-frame-')) {
        canvas.sendObjectToBack(obj);
      }
    });
    
    canvas.getObjects().forEach(obj => {
      const objName = (obj as any).name || '';
      if (objName.startsWith('storyboard-border-') || objName.startsWith('storyboard-number-')) {
        canvas.bringObjectToFront(obj);
      }
    });
    
    canvas.renderAll();
    saveState();

    // 更新frame计数
    setStoryboardFrameCount(frameIndex + 1);

    toast.success(`已创建分镜 ${frameIndex + 1}/${COLS * ROWS}`);
  };

  const handleRedraw = async (shouldReplaceOriginal: boolean = true) => {
    if (!canvas) {
      toast.error("画布未初始化");
      return;
    }
    
    // 根据activeFrameId查找对应的frame
    let frame, frameBorder;
    if (activeFrameId) {
      frame = canvas.getObjects().find((obj: any) => obj.name === `storyboard-frame-${activeFrameId}`);
      frameBorder = canvas.getObjects().find((obj: any) => obj.name === `storyboard-border-${activeFrameId}`);
    } else {
      // 如果没有激活的分镜，使用第一个分镜
      frame = canvas.getObjects().find((obj: any) => obj.name === 'storyboard-frame-1');
      frameBorder = canvas.getObjects().find((obj: any) => obj.name === 'storyboard-border-1');
    }
    
    if (!frame) {
      toast.error("未找到工作区域");
      return;
    }

    // 检查是否只有composite类型元素
    const nonCompositeObjects = canvas.getObjects().filter((obj: any) => {
      const objName = obj.name;
      return !objName?.startsWith('storyboard-') && 
             obj.type === 'image' && 
             (obj.data?.elementType !== 'composite' || !obj.data);
    });
    
    if (nonCompositeObjects.length === 0) {
      toast.error("画布上需要有角色或场景元素才能使用渲染功能");
      return;
    }
    
    toast.info("正在融合图层并重新绘制，请稍候...");
    try {
      // 临时隐藏frame边框
      const originalStroke = frame.stroke;
      const originalStrokeWidth = frame.strokeWidth;
      frame.set({ stroke: 'transparent', strokeWidth: 0 });
      
      // 临时隐藏frameBorder
      const originalBorderVisible = frameBorder?.visible;
      if (frameBorder) {
        frameBorder.set({ visible: false });
      }
      
      canvas.renderAll();

      // 使用Fabric.js的toDataURL导出frame区域
      const canvasDataURL = canvas.toDataURL({
        format: "png",
        quality: 1,
        multiplier: 1,
        left: frame.left || 0,
        top: frame.top || 0,
        width: frame.width || 1024,
        height: frame.height || 768,
      });

      // 恢复frame边框和frameBorder
      frame.set({ stroke: originalStroke, strokeWidth: originalStrokeWidth });
      if (frameBorder) {
        frameBorder.set({ visible: originalBorderVisible });
      }
      canvas.renderAll();
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
        
        // Only remove non-frame objects if shouldReplaceOriginal is true
        if (shouldReplaceOriginal) {
        const objects = canvas.getObjects();
        objects.forEach(obj => {
          const objName = (obj as any).name;
          if (!objName?.startsWith('storyboard-')) {
            canvas.remove(obj);
          }
        });
        }
        
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = aiData.imageUrl;
        });
        const fabricImg = new FabricImage(img, {
          left: frame.left,
          top: frame.top,
          selectable: true,
          data: { elementType: 'composite' }
        });
        const scaleX = frame.width! / fabricImg.width!;
        const scaleY = frame.height! / fabricImg.height!;
        const scale = Math.min(scaleX, scaleY);
        fabricImg.scale(scale);
        
        // Use layer sorting system
        const { insertObjectWithLayerType } = await import("@/lib/layerSorting");
        insertObjectWithLayerType(canvas, fabricImg, 'composite');
        
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
    
    // 根据activeFrameId查找对应的frame
    let frame, frameBorder;
    if (activeFrameId) {
      frame = canvas.getObjects().find((obj: any) => obj.name === `storyboard-frame-${activeFrameId}`);
      frameBorder = canvas.getObjects().find((obj: any) => obj.name === `storyboard-border-${activeFrameId}`);
    } else {
      // 如果没有激活的分镜，使用第一个分镜
      frame = canvas.getObjects().find((obj: any) => obj.name === 'storyboard-frame-1');
      frameBorder = canvas.getObjects().find((obj: any) => obj.name === 'storyboard-border-1');
    }
    
    if (!frame) {
      toast.error("未找到工作区域");
      return;
    }
    
    // 临时隐藏frameBorder
    const originalBorderVisible = frameBorder?.visible;
    if (frameBorder) {
      frameBorder.set({ visible: false });
    }
    canvas.renderAll();
    
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
    
    // 恢复frameBorder
    if (frameBorder) {
      frameBorder.set({ visible: originalBorderVisible });
    }
    canvas.renderAll();
    
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
    
    // If render mode, call handleRedraw with "create new layer" (false)
    if (composeMode === "render") {
      await handleRedraw(false);
      return;
    }

    // 根据activeFrameId查找对应的frame
    let frame;
    if (activeFrameId) {
      frame = canvas.getObjects().find((obj: any) => obj.name === `storyboard-frame-${activeFrameId}`);
    } else {
      frame = canvas.getObjects().find((obj: any) => obj.name === 'storyboard-frame-1');
    }
    
    if (!frame) {
      toast.error("未找到工作区域");
      return;
    }

    const frameLeft = frame.left || 0;
    const frameTop = frame.top || 0;
    const frameWidth = frame.width || 1024;
    const frameHeight = frame.height || 768;

    // 检查frame区域内是否有非composite类型元素
    const nonCompositeObjects = canvas.getObjects().filter((obj: any) => {
      const objName = obj.name;
      const isFrameObject = objName?.startsWith('storyboard-');
      
      if (isFrameObject) return false;
      if (obj.type === 'image' && obj.data?.elementType === 'composite') return false;
      
      // Check if object is within frame bounds
      const objLeft = obj.left || 0;
      const objTop = obj.top || 0;
      return objLeft >= frameLeft && objLeft < frameLeft + frameWidth &&
             objTop >= frameTop && objTop < frameTop + frameHeight;
    });
    
    if (nonCompositeObjects.length === 0) {
      toast.error("画布上需要有角色、场景元素或标注才能使用智能合成功能");
      return;
    }

    setIsComposing(true);
    const taskId = startTask("正在智能合成");
    const objects = canvas.getObjects();
    const textAnnotations: string[] = [];
    const shapes: string[] = [];
    let baseImage: any = null;
    
    // Only consider objects within the active frame
    objects.forEach(obj => {
      const objLeft = obj.left || 0;
      const objTop = obj.top || 0;
      const isInFrame = objLeft >= frameLeft && objLeft < frameLeft + frameWidth &&
                       objTop >= frameTop && objTop < frameTop + frameHeight;
      
      if (!isInFrame) return;
      
      if (obj.type === 'text') {
        const text = (obj as any).text;
        if (text && text !== '双击编辑文字') {
          textAnnotations.push(text);
        }
      } else if (['rect', 'circle', 'triangle', 'polygon'].includes(obj.type || '')) {
        const shapeDesc = `${obj.type} at position (${Math.round(objLeft || 0)}, ${Math.round(objTop || 0)})`;
        shapes.push(shapeDesc);
      } else if (obj.type === 'image') {
        if (!baseImage) {
          baseImage = obj;
        }
      }
    });
    let instruction = "";
    
    // Build instruction based on available content
    if (textAnnotations.length === 0 && shapes.length === 0) {
      // No annotations or shapes - use default enhancement mode
      instruction = "Enhance this image with professional lighting and shading. Fix any defects or missing areas in the image. Adjust the camera angle to make the composition more reasonable and visually appealing. Add proper shadows and highlights based on the environment.";
    } else if (textAnnotations.length > 0) {
      // Has text annotations - use them as main prompt
      instruction = textAnnotations.join(". ") + ".";
      if (shapes.length > 0) {
        instruction += ` Visual markers: ${shapes.join(", ")}.`;
      }
    } else if (shapes.length > 0) {
      // Only has shapes, no text - need a base prompt
      toast.error("请添加文字描述来指导AI生成图片，仅标记形状位置是不够的");
      setIsComposing(false);
      cancelTask();
      return;
    }
    toast.info("正在使用AI智能合成图片，请稍候...");
    try {
      // If there's a base image, always use edit mode regardless of composeMode
      if (baseImage) {
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
            scaleY: baseImage.scaleY,
            data: { elementType: 'composite' }
          });
          
          if (replaceOriginal) {
            objects.forEach(obj => {
              const objLeft = obj.left || 0;
              const objTop = obj.top || 0;
              const isInFrame = objLeft >= frameLeft && objLeft < frameLeft + frameWidth &&
                               objTop >= frameTop && objTop < frameTop + frameHeight;
              
              if (isInFrame && (obj.type === 'text' || ['rect', 'circle', 'triangle', 'polygon'].includes(obj.type || ''))) {
                canvas.remove(obj);
              }
            });
            canvas.remove(baseImage);
          }
          
          // Use layer sorting system
          const { insertObjectWithLayerType } = await import("@/lib/layerSorting");
          insertObjectWithLayerType(canvas, img, 'composite');
          canvas.setActiveObject(img);
          canvas.renderAll();
          saveState();
          completeTask(taskId);
          toast.success("图片已生成");
        }
      } else {
        // No base image - use pure generation mode
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
          const imgWidth = img.width || 1;
          const imgHeight = img.height || 1;
          const scale = Math.min(frameWidth / imgWidth, frameHeight / imgHeight, 1);
          img.scale(scale);
          img.set({
            left: frameLeft + (frameWidth - imgWidth * scale) / 2,
            top: frameTop + (frameHeight - imgHeight * scale) / 2,
            data: { elementType: 'composite' }
          });
          
          if (replaceOriginal) {
            objects.forEach(obj => {
              const objLeft = obj.left || 0;
              const objTop = obj.top || 0;
              const isInFrame = objLeft >= frameLeft && objLeft < frameLeft + frameWidth &&
                               objTop >= frameTop && objTop < frameTop + frameHeight;
              
              if (isInFrame && (obj.type === 'text' || ['rect', 'circle', 'triangle', 'polygon'].includes(obj.type || ''))) {
                canvas.remove(obj);
              }
            });
          }
          
          // Use layer sorting system
          const { insertObjectWithLayerType } = await import("@/lib/layerSorting");
          insertObjectWithLayerType(canvas, img, 'composite');
          canvas.setActiveObject(img);
          canvas.renderAll();
          saveState();
          completeTask(taskId);
          toast.success("图片已生成");
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

    // 根据activeFrameId查找对应的frame
    let frame, frameBorder;
    if (activeFrameId) {
      frame = canvas.getObjects().find((obj: any) => obj.name === `storyboard-frame-${activeFrameId}`);
      frameBorder = canvas.getObjects().find((obj: any) => obj.name === `storyboard-border-${activeFrameId}`);
    } else {
      // 如果没有激活的分镜，使用第一个分镜
      frame = canvas.getObjects().find((obj: any) => obj.name === 'storyboard-frame-1');
      frameBorder = canvas.getObjects().find((obj: any) => obj.name === 'storyboard-border-1');
    }
    
    if (!frame) {
      toast.error("未找到工作区域");
      return;
    }

    setShowRecomposeDialog(false);
    const taskId = startTask("正在重新构图");

    try {
      // 临时隐藏frame边框
      const originalStroke = frame.stroke;
      const originalStrokeWidth = frame.strokeWidth;
      frame.set({ stroke: 'transparent', strokeWidth: 0 });
      
      // 临时隐藏frameBorder
      const originalBorderVisible = frameBorder?.visible;
      if (frameBorder) {
        frameBorder.set({ visible: false });
      }
      
      canvas.renderAll();

      // 使用Fabric.js的toDataURL导出frame区域
      const canvasDataURL = canvas.toDataURL({
        format: "png",
        quality: 1,
        multiplier: 1,
        left: frame.left || 0,
        top: frame.top || 0,
        width: frame.width || 1024,
        height: frame.height || 768,
      });

      // 恢复frame边框和frameBorder
      frame.set({ stroke: originalStroke, strokeWidth: originalStrokeWidth });
      if (frameBorder) {
        frameBorder.set({ visible: originalBorderVisible });
      }
      canvas.renderAll();

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
          const objName = (obj as any).name;
          if (!objName?.startsWith('storyboard-')) {
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
          top: frame.top || 0,
          data: { elementType: 'composite' }
        });

        // Use layer sorting system
        const { insertObjectWithLayerType } = await import("@/lib/layerSorting");
        insertObjectWithLayerType(canvas, img, 'composite');
        
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

      <Button variant="outline" size="sm" onClick={() => setShowSmartComposeDialog(true)} disabled={isTaskProcessing || isComposing} className="shrink-0 whitespace-nowrap" title="智能合成">
        <Wand2 className="h-4 w-4" />
        <span className="ml-1">{isComposing ? "处理中..." : "智能合成"}</span>
      </Button>

      <Separator orientation="vertical" className="h-6 shrink-0" />

      <div className="flex items-center gap-1 shrink-0">
        <Button variant="outline" size="sm" onClick={handleCreateStoryboardFrame} className="whitespace-nowrap" title="创建分镜">
          <Grid3x3 className="h-4 w-4" />
          <span className="ml-1">创建分镜</span>
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowStoryboardSettings(true)} className="px-2" title="分镜设置">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

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

      {/* Storyboard Frame Settings Dialog */}
      <StoryboardFrameSettings
        open={showStoryboardSettings}
        onOpenChange={setShowStoryboardSettings}
        onApplyFrameSize={(width, height) => setFrameSize({ width, height })}
        currentFrameWidth={frameSize.width}
        currentFrameHeight={frameSize.height}
      />

      {/* Smart Compose Dialog */}
      <Dialog open={showSmartComposeDialog} onOpenChange={setShowSmartComposeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>智能合成</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>功能选择</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button variant={composeMode === "compose" ? "default" : "outline"} onClick={() => setComposeMode("compose")} className="w-full">
                  <Wand2 className="h-4 w-4 mr-2" />
                  智能合成
                </Button>
                <Button variant={composeMode === "render" ? "default" : "outline"} onClick={() => setComposeMode("render")} className="w-full">
                  <Sparkles className="h-4 w-4 mr-2" />
                  渲染
                </Button>
              </div>
            </div>

            {composeMode === "compose" && (
              <div className="space-y-2">
                <Label>输出选项</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={replaceOriginal ? "default" : "outline"} onClick={() => setReplaceOriginal(true)} className="w-full">
                    替换原图
                  </Button>
                  <Button variant={!replaceOriginal ? "default" : "outline"} onClick={() => setReplaceOriginal(false)} className="w-full">
                    创建新图层
                  </Button>
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Label>功能说明</Label>
              <div className="text-sm text-muted-foreground space-y-2">
                {composeMode === "compose" ? (
                  <>
                    <p>
                      <strong>智能合成</strong>会分析画布中的所有文本标注和图形元素：
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>根据文本和图形标注生成或编辑图片</li>
                      <li>支持添加文字描述想要的效果</li>
                      <li>可以标记重点区域进行智能修改</li>
                    </ul>
                  </>
                ) : (
                  <>
                    <p>
                      <strong>渲染</strong>会将画布上的所有元素融合并优化：
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>融合所有图层到单一图像</li>
                      <li>修复图像缺陷和缺失区域</li>
                      <li>优化光照、阴影和高光效果</li>
                      <li>保持原有构图和主体不变</li>
                    </ul>
                  </>
                )}
              </div>
            </div>

            <Button onClick={handleSmartCompose} className="w-full" disabled={isComposing}>
              {isComposing ? "处理中..." : composeMode === "compose" ? "开始合成" : "开始渲染"}
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