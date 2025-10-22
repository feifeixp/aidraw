import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { MousePointer2, Download, Undo, Redo, Sparkles, Wand2, Camera, Maximize2, Hand, Grid3x3, HelpCircle } from "lucide-react";
import { StoryboardFrameSettings } from "./StoryboardFrameSettings";
import { Canvas as FabricCanvas, FabricImage, Rect as FabricRect, FabricText } from "fabric";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  defaultStyle?: string;
  defaultFrameWidth?: number;
  defaultFrameHeight?: number;
  onShowTutorial?: () => void;
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
  setStoryboardFrameCount,
  defaultStyle = "auto",
  defaultFrameWidth = 1024,
  defaultFrameHeight = 768,
  onShowTutorial
}: EditorToolbarProps) => {
  const [showSmartComposeDialog, setShowSmartComposeDialog] = useState(false);
  const [composeMode, setComposeMode] = useState<"compose" | "render">("compose");
  const [replaceOriginal, setReplaceOriginal] = useState(true);
  const [isComposing, setIsComposing] = useState(false);
  const [showRecomposeDialog, setShowRecomposeDialog] = useState(false);
  const [customRecomposePrompt, setCustomRecomposePrompt] = useState("");
  const [showStoryboardSettings, setShowStoryboardSettings] = useState(false);
  const [frameSize, setFrameSize] = useState({ width: defaultFrameWidth, height: defaultFrameHeight });
  const [showAiStoryboardDialog, setShowAiStoryboardDialog] = useState(false);
  const [scriptText, setScriptText] = useState("");
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [isGeneratingStoryboards, setIsGeneratingStoryboards] = useState(false);
  const [storyboardStyle, setStoryboardStyle] = useState(defaultStyle);
  const [customStyle, setCustomStyle] = useState("");
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

    // 分镜布局配置 - 纵向单列排列
    const MAX_FRAMES = 12; // 最大分镜数量
    const INFINITE_CANVAS_SIZE = 10000;
    
    // 使用可配置的分镜尺寸
    const FRAME_WIDTH = frameSize.width;
    const FRAME_HEIGHT = frameSize.height;
    const SPACING = 50; // 间距
    
    // 计算起始位置（水平居中，垂直从顶部开始）
    const START_X = (INFINITE_CANVAS_SIZE - FRAME_WIDTH) / 2;
    const START_Y = 100; // 从顶部开始，留出一些空间

    // 计算当前frame的索引
    const frameIndex = storyboardFrameCount;

    // 检查是否超过最大frame数量
    if (frameIndex >= MAX_FRAMES) {
      toast.error(`已达到最大分镜数量 (${MAX_FRAMES})`);
      return;
    }

    // 计算frame位置 - 纵向排列
    const x = START_X;
    const y = START_Y + frameIndex * (FRAME_HEIGHT + SPACING);

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
      name: `storyboard-frame-${frameIndex + 1}`,
      data: {
        isFrameElement: true,
        objectType: 'storyboard-frame',
        frameId: `${frameIndex + 1}`,
        objectName: `storyboard-frame-${frameIndex + 1}`
      }
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
      name: `storyboard-border-${frameIndex + 1}`,
      data: {
        isFrameElement: true,
        objectType: 'storyboard-border',
        frameId: `${frameIndex + 1}`,
        objectName: `storyboard-border-${frameIndex + 1}`
      }
    });

    // 创建frame编号文本（显示在分镜外左上方，与分镜左边对齐）
    const frameNumber = new FabricText(`Shot-${String(frameIndex + 1).padStart(2, '0')}`, {
      left: x,
      top: y - 20,
      fontSize: 14,
      fill: '#666666',
      selectable: false,
      evented: false,
      name: `storyboard-number-${frameIndex + 1}`,
      data: {
        isFrameElement: true,
        objectType: 'storyboard-number',
        frameId: `${frameIndex + 1}`,
        objectName: `storyboard-number-${frameIndex + 1}`
      }
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

    toast.success(`已创建分镜 ${frameIndex + 1}/${MAX_FRAMES}`);
  };

  // AI 多分镜生成函数
  const handleAiStoryboardGeneration = async () => {
    if (!canvas) {
      toast.error("画布未初始化");
      return;
    }

    if (!scriptText.trim()) {
      toast.error("请输入剧本文本");
      return;
    }

    if (scriptText.length > 3500) {
      toast.error("剧本文本不能超过3500字");
      return;
    }

    if (referenceImages.length === 0) {
      toast.error("请至少上传1张参考图片");
      return;
    }

    if (referenceImages.length > 4) {
      toast.error("最多只能上传4张参考图片");
      return;
    }

    setShowAiStoryboardDialog(false);
    setIsGeneratingStoryboards(true);
    const taskId = startTask("正在生成AI分镜");

    try {
      toast.info("正在分析剧本和参考图片...");
      
      // 将图片转换为 base64
      const imagePromises = referenceImages.map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const imageDataUrls = await Promise.all(imagePromises);

      // 调用 edge function 生成分镜
      const { data, error } = await supabase.functions.invoke('ai-generate-storyboards', {
        body: {
          scriptText,
          referenceImages: imageDataUrls,
          style: storyboardStyle === 'custom' ? customStyle : storyboardStyle
        }
      });

      if (error) throw error;

      if (!data || !data.images || data.images.length === 0) {
        throw new Error("未生成任何分镜图片");
      }

      toast.success(`成功生成 ${data.images.length} 张分镜！`);
      
      // 批量创建分镜框架和添加图片
      const COLS = 5;
      const ROWS = 8;
      const INFINITE_CANVAS_SIZE = 10000;
      const FRAME_WIDTH = frameSize.width;
      const FRAME_HEIGHT = frameSize.height;
      const SPACING = 50;
      const totalWidth = COLS * FRAME_WIDTH + (COLS - 1) * SPACING;
      const START_X = (INFINITE_CANVAS_SIZE - totalWidth) / 2;
      const totalHeight = ROWS * FRAME_HEIGHT + (ROWS - 1) * SPACING;
      const START_Y = (INFINITE_CANVAS_SIZE - totalHeight) / 2;
      
      // 记录初始的分镜数量
      const initialFrameCount = storyboardFrameCount;
      
      // 批量加载所有图片
      const imageLoadPromises = data.images.map((imageUrl: string) => 
        FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' })
      );
      const loadedImages = await Promise.all(imageLoadPromises);
      
      // 为每张图片创建分镜框架并添加图片
      for (let i = 0; i < loadedImages.length; i++) {
        const img = loadedImages[i];
        const currentFrameIndex = initialFrameCount + i;
        const frameId = `${currentFrameIndex + 1}`;
        
        // 检查是否超过最大frame数量
        if (currentFrameIndex >= COLS * ROWS) {
          toast.error(`已达到最大分镜数量 (${COLS * ROWS})`);
          break;
        }
        
        // 计算frame在网格中的位置
        const col = currentFrameIndex % COLS;
        const row = Math.floor(currentFrameIndex / COLS);
        const frameLeft = START_X + col * (FRAME_WIDTH + SPACING);
        const frameTop = START_Y + row * (FRAME_HEIGHT + SPACING);
        
        // 创建分镜框架
        const frame = new FabricRect({
          left: frameLeft,
          top: frameTop,
          width: FRAME_WIDTH,
          height: FRAME_HEIGHT,
          fill: 'white',
          selectable: false,
          evented: false,
          name: `storyboard-frame-${frameId}`
        });
        
        // 创建边框
        const frameBorder = new FabricRect({
          left: frameLeft,
          top: frameTop,
          width: FRAME_WIDTH,
          height: FRAME_HEIGHT,
          fill: 'transparent',
          stroke: '#666',
          strokeWidth: 2,
          selectable: false,
          evented: false,
          name: `storyboard-border-${frameId}`
        });
        
        // 创建帧编号标签
        const frameLabel = new FabricText(`${frameId}`, {
          left: frameLeft + 10,
          top: frameTop + 10,
          fontSize: 16,
          fill: '#333',
          selectable: false,
          evented: false,
          name: `storyboard-label-${frameId}`
        });
        
        // 添加frame和border到canvas
        canvas.add(frame);
        canvas.add(frameBorder);
        canvas.add(frameLabel);
        
        // 缩放图片以适应分镜框架
        const scale = Math.min(
          FRAME_WIDTH / img.width,
          FRAME_HEIGHT / img.height
        );
        
        // 设置图片位置和大小，居中放置在分镜框架中
        img.set({
          left: frameLeft + (FRAME_WIDTH - img.width * scale) / 2,
          top: frameTop + (FRAME_HEIGHT - img.height * scale) / 2,
          scaleX: scale,
          scaleY: scale,
          data: {
            elementType: 'storyboard-reference',
            frameId: frameId
          }
        });
        
        canvas.add(img);
        
        toast.info(`已添加分镜 ${i + 1}/${data.images.length}`);
      }
      
      // 更新分镜计数
      setStoryboardFrameCount(initialFrameCount + loadedImages.length);
      
      canvas.renderAll();
      saveState();
      
      completeTask(taskId);
      
      // 清空表单
      setScriptText("");
      setReferenceImages([]);
      setStoryboardStyle("blackWhiteSketch");
      setCustomStyle("");
      
    } catch (error) {
      console.error("AI分镜生成错误:", error);
      toast.error(error instanceof Error ? error.message : "AI分镜生成失败");
      cancelTask();
    } finally {
      setIsGeneratingStoryboards(false);
    }
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
        // 清理边缘不干净的像素
        toast.info("正在优化边缘...");
        const { cleanImageEdges } = await import("@/lib/edgeCleanup");
        const cleanedImageUrl = await cleanImageEdges(aiData.imageUrl, {
          threshold: 30,      // 边缘检测阈值
          smoothRadius: 2,    // 平滑半径
          colorTolerance: 25, // 颜色容差
          featherWidth: 2     // 羽化宽度
        });
        
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
          img.src = cleanedImageUrl;
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
  const handleExport = async () => {
    if (!canvas) return;
    
    // 根据activeFrameId查找对应的frame
    let frame, frameBorder, frameNumber;
    if (activeFrameId) {
      frame = canvas.getObjects().find((obj: any) => obj.name === `storyboard-frame-${activeFrameId}`);
      frameBorder = canvas.getObjects().find((obj: any) => obj.name === `storyboard-border-${activeFrameId}`);
      frameNumber = canvas.getObjects().find((obj: any) => obj.name === `storyboard-number-${activeFrameId}`);
    } else {
      // 如果没有激活的分镜，使用第一个分镜
      frame = canvas.getObjects().find((obj: any) => obj.name === 'storyboard-frame-1');
      frameBorder = canvas.getObjects().find((obj: any) => obj.name === 'storyboard-border-1');
      frameNumber = canvas.getObjects().find((obj: any) => obj.name === 'storyboard-number-1');
    }
    
    if (!frame) {
      toast.error("未找到工作区域");
      return;
    }
    
    // 临时隐藏frameBorder和frameNumber
    const originalBorderVisible = frameBorder?.visible;
    const originalNumberVisible = frameNumber?.visible;
    if (frameBorder) {
      frameBorder.set({ visible: false });
    }
    if (frameNumber) {
      frameNumber.set({ visible: false });
    }
    canvas.renderAll();
    
    // 等待一小段时间确保渲染完成
    await new Promise(resolve => setTimeout(resolve, 100));
    
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
    
    // 恢复frameBorder和frameNumber
    if (frameBorder) {
      frameBorder.set({ visible: originalBorderVisible });
    }
    if (frameNumber) {
      frameNumber.set({ visible: originalNumberVisible });
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
    
    // 收集frame区域内的文字标注作为提示词
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
      }
    });
    
    // 构建AI指令：文字标注作为提示词，形状通过图像传递
    let instruction = "";
    if (textAnnotations.length > 0) {
      instruction = textAnnotations.join(". ") + ". Generate an image based on the visual content and this description.";
    } else {
      instruction = "Generate an image based on the visual elements shown, enhancing with professional lighting, shading, and composition.";
    }
    
    toast.info("正在使用AI智能合成图片，请稍候...");
    try {
      // 临时隐藏frame边框
      const frameBorder = canvas.getObjects().find((obj: any) => obj.name === `storyboard-border-${activeFrameId || '1'}`);
      const originalBorderVisible = frameBorder?.visible;
      if (frameBorder) {
        frameBorder.set({ visible: false });
      }
      
      // 临时隐藏所有文字标注
      const hiddenTexts: any[] = [];
      objects.forEach(obj => {
        const objLeft = obj.left || 0;
        const objTop = obj.top || 0;
        const isInFrame = objLeft >= frameLeft && objLeft < frameLeft + frameWidth &&
                         objTop >= frameTop && objTop < frameTop + frameHeight;
        
        if (isInFrame && obj.type === 'text') {
          hiddenTexts.push({ obj, visible: obj.visible });
          obj.set({ visible: false });
        }
      });
      
      canvas.renderAll();
      
      // 将frame区域的所有内容（图像+形状）导出为一张完整图像
      const imageDataURL = canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 1,
        left: frameLeft,
        top: frameTop,
        width: frameWidth,
        height: frameHeight,
      });
      
      // 恢复frameBorder和文字
      if (frameBorder) {
        frameBorder.set({ visible: originalBorderVisible });
      }
      hiddenTexts.forEach(({ obj, visible }) => {
        obj.set({ visible });
      });
      canvas.renderAll();
      
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
        // 清理边缘不干净的像素
        toast.info("正在优化边缘...");
        const { cleanImageEdges } = await import("@/lib/edgeCleanup");
        const cleanedImageUrl = await cleanImageEdges(aiData.imageUrl, {
          threshold: 30,      // 边缘检测阈值
          smoothRadius: 2,    // 平滑半径
          colorTolerance: 25, // 颜色容差
          featherWidth: 2     // 羽化宽度
        });
        
        const {
          FabricImage
        } = await import("fabric");
        const img = await FabricImage.fromURL(cleanedImageUrl, {
          crossOrigin: 'anonymous'
        });
        
        const imgWidth = img.width || 1;
        const imgHeight = img.height || 1;
        const scale = Math.min(frameWidth / imgWidth, frameHeight / imgHeight, 1);
        
        img.scale(scale);
        img.set({
          left: frameLeft,
          top: frameTop,
          data: { elementType: 'composite' }
        });
        
        if (replaceOriginal) {
          objects.forEach(obj => {
            const objLeft = obj.left || 0;
            const objTop = obj.top || 0;
            const isInFrame = objLeft >= frameLeft && objLeft < frameLeft + frameWidth &&
                             objTop >= frameTop && objTop < frameTop + frameHeight;
            
            if (isInFrame && !((obj as any).name?.startsWith('storyboard-'))) {
              canvas.remove(obj);
            }
          });
        } else {
          // 只移除文本和形状标注
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
        // 清理边缘不干净的像素
        toast.info("正在优化边缘...");
        const { cleanImageEdges } = await import("@/lib/edgeCleanup");
        const cleanedImageUrl = await cleanImageEdges(aiData.imageUrl, {
          threshold: 30,      // 边缘检测阈值
          smoothRadius: 2,    // 平滑半径
          colorTolerance: 25, // 颜色容差
          featherWidth: 2     // 羽化宽度
        });
        
        const { FabricImage } = await import("fabric");
        
        // 先移除画布上所有非frame的对象
        const objects = canvas.getObjects();
        objects.forEach(obj => {
          const objName = (obj as any).name;
          if (!objName?.startsWith('storyboard-')) {
            canvas.remove(obj);
          }
        });
        
        const img = await FabricImage.fromURL(cleanedImageUrl, {
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
        <Button 
          variant="default" 
          size="sm" 
          onClick={() => setShowAiStoryboardDialog(true)} 
          className="whitespace-nowrap bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg" 
          title="AI智能多分镜生成"
          disabled={isGeneratingStoryboards}
        >
          <Sparkles className="h-4 w-4" />
          <span className="ml-1">{isGeneratingStoryboards ? "生成中..." : "智能多分镜"}</span>
        </Button>
        
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

      <Separator orientation="vertical" className="h-6 shrink-0" />

      <Button 
        variant="outline" 
        size="sm" 
        onClick={onShowTutorial}
        className="shrink-0 whitespace-nowrap" 
        title="显示帮助教程"
      >
        <HelpCircle className="h-4 w-4" />
        <span className="ml-1">帮助</span>
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

      {/* AI 多分镜生成对话框 */}
      <Dialog open={showAiStoryboardDialog} onOpenChange={setShowAiStoryboardDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI 智能多分镜生成
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* 剧本文本输入 */}
            <div className="space-y-2">
              <Label htmlFor="script-text" className="text-base font-semibold">
                剧本文本 <span className="text-sm text-muted-foreground">({scriptText.length}/3500字)</span>
              </Label>
              <Textarea
                id="script-text"
                placeholder="输入您的剧本内容，AI将根据剧本生成分镜画面..."
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                rows={8}
                className="resize-none"
                maxLength={3500}
              />
              <p className="text-sm text-muted-foreground">
                描述场景、角色动作和情绪，AI会自动生成对应的分镜线稿
              </p>
            </div>

            {/* 参考图片上传 */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">
                参考图片 <span className="text-sm text-muted-foreground">(最多4张)</span>
              </Label>
              <div className="border-2 border-dashed rounded-lg p-6 bg-muted/50">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length + referenceImages.length > 4) {
                      toast.error("最多只能上传4张图片");
                      return;
                    }
                    setReferenceImages([...referenceImages, ...files]);
                  }}
                  className="hidden"
                  id="reference-images"
                />
                <label
                  htmlFor="reference-images"
                  className="flex flex-col items-center justify-center cursor-pointer"
                >
                  <Camera className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    点击或拖拽上传角色参考图片
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    AI会识别图片中的角色特征，保持画风一致
                  </p>
                </label>
              </div>

              {/* 已上传图片预览 */}
              {referenceImages.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-4">
                  {referenceImages.map((file, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`参考图 ${index + 1}`}
                        className="w-full h-24 object-cover rounded border"
                      />
                      <button
                        onClick={() => {
                          setReferenceImages(referenceImages.filter((_, i) => i !== index));
                        }}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <span className="sr-only">删除</span>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 自定义风格输入（仅当选择自定义时显示） */}
            {storyboardStyle === 'custom' && (
              <div className="space-y-2">
                <Label className="text-sm">自定义风格描述</Label>
                <Input
                  placeholder="输入自定义风格描述，如：水彩风格、油画风格等"
                  value={customStyle}
                  onChange={(e) => setCustomStyle(e.target.value)}
                />
              </div>
            )}

            {/* 生成说明 */}
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2 text-blue-900 dark:text-blue-100">AI 生成说明</h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• 根据选择的风格生成相应的分镜画面</li>
                <li>• 自动识别参考图片中的角色特征</li>
                <li>• 保持角色画风和造型一致性</li>
                <li>• 根据剧本自动生成多个分镜场景</li>
                <li>• 支持自定义风格描述</li>
              </ul>
            </div>

            {/* 风格选择和生成按钮 */}
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <Select value={storyboardStyle} onValueChange={setStoryboardStyle}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择生成风格" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">自动风格（根据参考图）</SelectItem>
                    <SelectItem value="blackWhiteSketch">黑白线稿</SelectItem>
                    <SelectItem value="blackWhiteComic">黑白漫画</SelectItem>
                    <SelectItem value="japaneseAnime">日式动漫</SelectItem>
                    <SelectItem value="americanComic">美式漫画</SelectItem>
                    <SelectItem value="chineseAnime">国风动漫</SelectItem>
                    <SelectItem value="3dCartoon">3D卡通</SelectItem>
                    <SelectItem value="3dUnreal">虚幻引擎</SelectItem>
                    <SelectItem value="cinematic">电影写实</SelectItem>
                    <SelectItem value="custom">自定义</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => setShowAiStoryboardDialog(false)}
                variant="outline"
              >
                取消
              </Button>
              <Button
                onClick={handleAiStoryboardGeneration}
                disabled={!scriptText.trim() || referenceImages.length === 0 || isGeneratingStoryboards}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {isGeneratingStoryboards ? "生成中..." : "开始生成分镜"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>;
};