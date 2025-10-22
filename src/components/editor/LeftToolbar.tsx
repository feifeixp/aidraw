import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Plus, Palette, FlipHorizontal, Upload, Sparkles, Type, Square, Circle, Triangle, Wand2, MessageCircle, MessageSquare, Cloud, Crop, Check, X, ChevronLeft, ChevronRight, ImageIcon, Copy, User, Box, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, Lock, Unlock, Scissors, Settings, Eraser } from "lucide-react";
import { Canvas as FabricCanvas, FabricText, Rect as FabricRect, Circle as FabricCircle, Triangle as FabricTriangle, Path, Group } from "fabric";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { convertMagentaToTransparent } from "@/lib/colorToTransparent";
import { moveObjectToEdgeInLayer, moveObjectInLayer } from "@/lib/layerSorting";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  onSmartExtract?: () => Promise<void>;
  activeTool?: string;
  setActiveTool?: (tool: string) => void;
  eraserBrushSize?: number;
  setEraserBrushSize?: (size: number) => void;
  activeFrameId?: string | null;
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
  onToggleCollapse,
  onSmartExtract,
  activeTool,
  setActiveTool,
  eraserBrushSize = 20,
  setEraserBrushSize,
  activeFrameId
}: LeftToolbarProps) => {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [originalAiImage, setOriginalAiImage] = useState<string | null>(null);
  const [featherStrength, setFeatherStrength] = useState(50);
  const [isCropMode, setIsCropMode] = useState(false);
  const [showExtractDialog, setShowExtractDialog] = useState(false);
  const [extractDilation, setExtractDilation] = useState(0);
  const [extractFeather, setExtractFeather] = useState(0);
  const [extractPadding, setExtractPadding] = useState(10);
  const [extractMode, setExtractMode] = useState<'auto' | 'scribble'>('auto');
  const [isScribbling, setIsScribbling] = useState(false);
  const [scribblePoints, setScribblePoints] = useState<Array<{ x: number; y: number }>>([]);
  const scribbleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showAiGenerateDialog, setShowAiGenerateDialog] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showSaveConfirmDialog, setShowSaveConfirmDialog] = useState(false);
  const [showAddElementDialog, setShowAddElementDialog] = useState(false);
  const [selectedElementType, setSelectedElementType] = useState<'character' | 'scene' | 'prop' | 'effect' | null>(null);
  const [isObjectLocked, setIsObjectLocked] = useState(false);
  const [showEraserSettings, setShowEraserSettings] = useState(false);
  const activeFrameIdRef = useRef(activeFrameId);

  // Update activeFrameIdRef when activeFrameId changes
  useEffect(() => {
    activeFrameIdRef.current = activeFrameId;
  }, [activeFrameId]);

  // Update lock state when selection changes
  useEffect(() => {
    if (!canvas) return;
    
    const updateLockState = () => {
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        setIsObjectLocked(activeObject.lockMovementX || false);
      } else {
        setIsObjectLocked(false);
      }
    };
    
    canvas.on('selection:created', updateLockState);
    canvas.on('selection:updated', updateLockState);
    canvas.on('selection:cleared', () => setIsObjectLocked(false));
    
    return () => {
      canvas.off('selection:created', updateLockState);
      canvas.off('selection:updated', updateLockState);
      canvas.off('selection:cleared', () => setIsObjectLocked(false));
    };
  }, [canvas]);


  // Helper function to get the active frame (storyboard or default canvas)
  const getActiveFrame = () => {
    if (!canvas) return null;
    
    if (activeFrameIdRef.current) {
      const storyboardFrame = canvas.getObjects().find(
        obj => (obj as any).name === `storyboard-frame-${activeFrameIdRef.current}`
      );
      if (storyboardFrame) return storyboardFrame;
    }
    
    // Fall back to first storyboard frame
    const firstFrame = canvas.getObjects().find(
      obj => (obj as any).name === 'storyboard-frame-1'
    );
    return firstFrame || null;
  };

  const handleAddElement = () => {
    setSelectedElementType(null);
    setShowAddElementDialog(true);
  };

  const handleSelectElementType = (type: 'character' | 'scene' | 'prop' | 'effect') => {
    setSelectedElementType(type);
  };

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
          if (selectedElementType) {
            window.dispatchEvent(new CustomEvent('addImageToCanvas', {
              detail: {
                imageUrl,
                name: file.name,
                elementType: selectedElementType
              }
            }));
            setShowAddElementDialog(false);
            setSelectedElementType(null);
            onActionComplete?.();
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };
  const handleGenerateImage = () => {
    if (!selectedElementType) {
      toast.error("请先选择元素类型");
      return;
    }
    setShowAddElementDialog(false);
    setShowAiGenerateDialog(true);
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error("请输入提示词");
      return;
    }

    if (!selectedElementType) {
      toast.error("请先选择元素类型");
      return;
    }

    setIsGenerating(true);
    try {
      console.log("开始生成图片，提示词:", aiPrompt);
      
      const { data, error } = await supabase.functions.invoke('ai-generate-image', {
        body: { prompt: aiPrompt }
      });

      console.log("Edge function 响应:", { data, error });

      if (error) {
        console.error("Edge function 错误:", error);
        throw error;
      }

      if (data?.imageUrl) {
        console.log("收到图片 URL，长度:", data.imageUrl.length);
        
        // 验证是否为有效的 base64 图片
        if (!data.imageUrl.startsWith('data:image/')) {
          throw new Error("返回的不是有效的图片格式");
        }

        window.dispatchEvent(new CustomEvent('addImageToCanvas', {
          detail: {
            imageUrl: data.imageUrl,
            name: "AI生成的图片",
            elementType: selectedElementType
          }
        }));
        setShowAiGenerateDialog(false);
        setSelectedElementType(null);
        setAiPrompt("");
        onActionComplete?.();
      } else {
        console.error("响应中没有 imageUrl");
        toast.error("未生成图片，请稍后重试");
      }
    } catch (error: any) {
      console.error("AI generation error:", error);
      
      // 更详细的错误处理
      if (error.message?.includes("Load failed")) {
        toast.error("网络请求失败，请检查网络连接后重试");
      } else if (error.message?.includes("429") || error.context?.status === 429) {
        toast.error("请求过于频繁，请稍后再试");
      } else if (error.message?.includes("402") || error.context?.status === 402) {
        toast.error("需要充值，请前往设置添加余额");
      } else {
        toast.error(error.message || "图片生成失败，请重试");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNavigateToGenerate = () => {
    setShowSaveConfirmDialog(true);
  };

  const handleConfirmNavigate = () => {
    // Save canvas state (exclude frame elements)
    if (canvas) {
      const allObjects = canvas.getObjects();
      const jsonObj = (canvas as any).toJSON(['data', 'name']);
      
      // 🔧 手动修复 data 和 name 属性（Fabric.js v6 序列化问题）
      if (jsonObj.objects && jsonObj.objects.length > 0) {
        jsonObj.objects.forEach((serializedObj: any, index: number) => {
          const canvasObj = allObjects[index];
          if (canvasObj) {
            serializedObj.data = (canvasObj as any).data || {};
            serializedObj.name = (canvasObj as any).name || '';
          }
        });
      }
      
      // 过滤掉框架元素
      if (jsonObj.objects) {
        jsonObj.objects = jsonObj.objects.filter((obj: any) => !obj.data?.isFrameElement);
      }
      const canvasJson = JSON.stringify(jsonObj);
      localStorage.setItem('editor-draft', canvasJson);
      localStorage.setItem('editor-draft-timestamp', Date.now().toString());
      toast.success("草稿已保存");
    }
    setShowSaveConfirmDialog(false);
    setShowAiGenerateDialog(false);
    navigate('/generate');
  };

  const handleAddHistoryImageToCanvas = (imageUrl: string) => {
    if (selectedElementType) {
      window.dispatchEvent(new CustomEvent('addImageToCanvas', {
        detail: {
          imageUrl,
          name: "历史图片",
          elementType: selectedElementType
        }
      }));
      setShowAddElementDialog(false);
      setShowAiGenerateDialog(false);
      setSelectedElementType(null);
      onActionComplete?.();
    }
  };

  // Add Text
  const handleAddText = () => {
    if (!canvas) return;
    const frame = getActiveFrame();
    const frameLeft = frame?.left || 0;
    const frameTop = frame?.top || 0;
    const frameWidth = frame?.width || 1024;
    const frameHeight = frame?.height || 768;
    
    const text = new FabricText("双击编辑文字", {
      left: frameLeft + frameWidth / 2 - 100,
      top: frameTop + frameHeight / 2 - 20,
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
    const frame = getActiveFrame();
    const frameLeft = frame?.left || 0;
    const frameTop = frame?.top || 0;
    const frameWidth = frame?.width || 1024;
    const frameHeight = frame?.height || 768;
    
    const rect = new FabricRect({
      left: frameLeft + frameWidth / 2 - 100,
      top: frameTop + frameHeight / 2 - 75,
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
    const frame = getActiveFrame();
    const frameLeft = frame?.left || 0;
    const frameTop = frame?.top || 0;
    const frameWidth = frame?.width || 1024;
    const frameHeight = frame?.height || 768;
    
    const circle = new FabricCircle({
      left: frameLeft + frameWidth / 2 - 75,
      top: frameTop + frameHeight / 2 - 75,
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
    const frame = getActiveFrame();
    const frameLeft = frame?.left || 0;
    const frameTop = frame?.top || 0;
    const frameWidth = frame?.width || 1024;
    const frameHeight = frame?.height || 768;
    
    const triangle = new FabricTriangle({
      left: frameLeft + frameWidth / 2 - 75,
      top: frameTop + frameHeight / 2 - 65,
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
    const frame = getActiveFrame();
    const frameLeft = frame?.left || 0;
    const frameTop = frame?.top || 0;
    const frameWidth = frame?.width || 1024;
    const frameHeight = frame?.height || 768;

    // Create round speech bubble using SVG path
    const bubblePath = "M 10 40 Q 10 10, 40 10 L 160 10 Q 190 10, 190 40 L 190 90 Q 190 120, 160 120 L 80 120 L 60 145 L 65 120 L 40 120 Q 10 120, 10 90 Z";
    const bubble = new Path(bubblePath, {
      left: frameLeft + frameWidth / 2 - 100,
      top: frameTop + frameHeight / 2 - 75,
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
    const frame = getActiveFrame();
    const frameLeft = frame?.left || 0;
    const frameTop = frame?.top || 0;
    const frameWidth = frame?.width || 1024;
    const frameHeight = frame?.height || 768;

    // Create square speech bubble using SVG path
    const bubblePath = "M 10 10 L 190 10 L 190 120 L 80 120 L 60 145 L 65 120 L 10 120 Z";
    const bubble = new Path(bubblePath, {
      left: frameLeft + frameWidth / 2 - 100,
      top: frameTop + frameHeight / 2 - 75,
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
    const frame = getActiveFrame();
    const frameLeft = frame?.left || 0;
    const frameTop = frame?.top || 0;
    const frameWidth = frame?.width || 1024;
    const frameHeight = frame?.height || 768;

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
      left: frameLeft + frameWidth / 2 - 80,
      top: frameTop + frameHeight / 2 - 60
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
    const frame = getActiveFrame();
    const frameLeft = frame?.left || 0;
    const frameTop = frame?.top || 0;
    const frameWidth = frame?.width || 1024;
    const frameHeight = frame?.height || 768;

    // Create sharp/spiky speech bubble using SVG path
    const bubblePath = "M 15 15 L 185 15 L 185 115 L 75 115 L 55 145 L 60 115 L 15 115 Z";
    const bubble = new Path(bubblePath, {
      left: frameLeft + frameWidth / 2 - 100,
      top: frameTop + frameHeight / 2 - 75,
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

  // Smart Extract - 智能提取
  const handleSmartExtract = async () => {
    const activeObject = canvas?.getActiveObject();
    if (!canvas || !activeObject || activeObject.type !== 'image') {
      toast.error("请先选择画布上的图片");
      return;
    }
    if (isTaskProcessing) {
      toast.error("当前有任务正在处理，请等待完成");
      return;
    }
    
    setShowExtractDialog(true);
  };
  
  const startScribbleMode = () => {
    setShowExtractDialog(false);
    setIsScribbling(true);
    setScribblePoints([]);
    toast.info("请在图片上涂抹需要提取的区域");
  };
  
  const cancelScribbleMode = () => {
    setIsScribbling(false);
    setScribblePoints([]);
    if (scribbleCanvasRef.current) {
      const ctx = scribbleCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, scribbleCanvasRef.current.width, scribbleCanvasRef.current.height);
      }
    }
  };

  const executeSmartExtract = async () => {
    const activeObject = canvas?.getActiveObject();
    if (!canvas || !activeObject || activeObject.type !== 'image') return;
    
    // 检查是否需要涂抹模式
    if (extractMode === 'scribble' && scribblePoints.length === 0) {
      setShowExtractDialog(false);
      startScribbleMode();
      return;
    }
    
    setShowExtractDialog(false);
    setIsScribbling(false);
    const taskId = startTask("正在智能提取");
    try {
      // Get original image dimensions and calculate multiplier to maintain quality
      const fabricImage = activeObject as any;
      const originalWidth = fabricImage.width;
      const originalHeight = fabricImage.height;
      const scaleX = fabricImage.scaleX || 1;
      const scaleY = fabricImage.scaleY || 1;
      
      // Calculate multiplier to export at original resolution
      const multiplier = 1 / Math.min(scaleX, scaleY);
      
      // Convert image to data URL at original resolution
      const imageDataURL = fabricImage.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: multiplier,
        enableRetinaScaling: false
      });
      
      // Load image
      const img = await loadImageFromDataURL(imageDataURL);
      
      // Initialize MediaPipe segmenter
      toast.info("正在加载分割模型...");
      const { MediaPipeSegmenter } = await import("@/lib/mediapipe/interactiveSegmenter");
      const segmenter = new MediaPipeSegmenter();
      await segmenter.initialize();
      
      // 根据模式进行分割
      let result;
      if (extractMode === 'scribble' && scribblePoints.length > 0) {
        // 涂抹模式：使用涂抹的点
        toast.info("正在根据涂抹区域分析图片...");
        
        // 将涂抹点坐标转换到原始图片坐标系
        const scaledPoints = scribblePoints.map(point => ({
          x: point.x * img.width,
          y: point.y * img.height
        }));
        
        result = await segmenter.segmentWithScribbles(img, scaledPoints);
      } else {
        // 自动模式：使用中心点
        const centerX = img.width / 2;
        const centerY = img.height / 2;
        
        toast.info("正在分析图片...");
        result = await segmenter.segmentWithPoint(img, centerX, centerY);
      }
      
      // 清空涂抹点
      setScribblePoints([]);
      
      if (!result || !result.categoryMask) {
        toast.error("未检测到主要物体");
        cancelTask();
        segmenter.close();
        return;
      }
      
      // Create source canvas
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = img.width;
      sourceCanvas.height = img.height;
      const ctx = sourceCanvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      
      // Extract the masked object with dilation and feathering
      toast.info("正在提取物体...");
      const maskData = result.categoryMask.getAsUint8Array();
      const extractedCanvas = segmenter.extractMaskedImage(
        sourceCanvas,
        maskData,
        result.categoryMask.width,
        result.categoryMask.height,
        {
          dilation: extractDilation,
          feather: extractFeather,
          padding: extractPadding,
          crop: true
        }
      );
      
      // Convert to blob for classification
      const blob = await new Promise<Blob>((resolve, reject) => {
        extractedCanvas.toBlob(
          (b) => b ? resolve(b) : reject(new Error('Failed to create blob')),
          'image/png'
        );
      });
      
      // Classify the object
      toast.info("正在识别物体类型...");
      const elementType = await classifyExtractedObject(blob);
      
      // Convert extracted canvas to data URL
      const extractedDataURL = extractedCanvas.toDataURL('image/png');
      
      // Create new fabric image
      const { FabricImage } = await import("fabric");
      const newImg = await FabricImage.fromURL(extractedDataURL, {
        crossOrigin: 'anonymous'
      });
      
      newImg.set({
        left: activeObject.left,
        top: activeObject.top,
        scaleX: activeObject.scaleX,
        scaleY: activeObject.scaleY,
        data: {
          ...(activeObject as any).data,
          elementType: elementType
        }
      });
      
      canvas.remove(activeObject);
      canvas.add(newImg);
      canvas.setActiveObject(newImg);
      canvas.renderAll();
      saveState();
      
      segmenter.close();
      completeTask(taskId);
      toast.success(`已提取物体 (${elementType})`);
    } catch (error) {
      console.error("Smart extract error:", error);
      toast.error("智能提取失败");
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
  
  const handleDuplicate = async () => {
    const activeObject = canvas?.getActiveObject();
    if (!activeObject) {
      toast.error("请先选择一个对象");
      return;
    }

    try {
      const cloned = await activeObject.clone();
      
      // 🔧 确保 data 和 name 属性被正确复制
      const originalData = (activeObject as any).data;
      const originalName = (activeObject as any).name;
      
      cloned.set({
        left: (cloned.left || 0) + 10,
        top: (cloned.top || 0) + 10,
        data: originalData ? { ...originalData } : undefined,
        name: originalName
      });
      
      canvas?.add(cloned);
      canvas?.setActiveObject(cloned);
      canvas?.renderAll();
      saveState();
      toast.success("已复制元素");
    } catch (error) {
      console.error("Clone error:", error);
      toast.error("复制失败");
    }
  };
  
  // Layer order functions
  const handleBringToFront = () => {
    const activeObject = canvas?.getActiveObject();
    if (!activeObject || !canvas) {
      toast.error("请先选择一个对象");
      return;
    }
    moveObjectToEdgeInLayer(canvas, activeObject, 'top');
    saveState();
    toast.success("已置于同类型顶层");
  };

  const handleSendToBack = () => {
    const activeObject = canvas?.getActiveObject();
    if (!activeObject || !canvas) {
      toast.error("请先选择一个对象");
      return;
    }
    moveObjectToEdgeInLayer(canvas, activeObject, 'bottom');
    saveState();
    toast.success("已置于同类型底层");
  };

  const handleBringForward = () => {
    const activeObject = canvas?.getActiveObject();
    if (!activeObject || !canvas) {
      toast.error("请先选择一个对象");
      return;
    }
    moveObjectInLayer(canvas, activeObject, 'up');
    saveState();
    toast.success("已上移一层");
  };

  const handleSendBackwards = () => {
    const activeObject = canvas?.getActiveObject();
    if (!activeObject || !canvas) {
      toast.error("请先选择一个对象");
      return;
    }
    moveObjectInLayer(canvas, activeObject, 'down');
    saveState();
    toast.success("已下移一层");
  };

  const handleToggleLock = () => {
    const activeObject = canvas?.getActiveObject();
    if (!activeObject) {
      toast.error("请先选择一个对象");
      return;
    }
    const isLocked = activeObject.lockMovementX || false;
    activeObject.set({
      lockMovementX: !isLocked,
      lockMovementY: !isLocked,
      lockRotation: !isLocked,
      lockScalingX: !isLocked,
      lockScalingY: !isLocked,
      selectable: isLocked, // If locked, make unselectable; if unlocked, make selectable
    });
    setIsObjectLocked(!isLocked);
    canvas?.renderAll();
    saveState();
    toast.success(isLocked ? "已解锁" : "已锁定");
  };

  const handleUnlockAll = () => {
    if (!canvas) return;
    
    const objects = canvas.getObjects();
    let unlockedCount = 0;
    
    objects.forEach(obj => {
      // 跳过工作区域frame
      if ((obj as any).name?.startsWith('storyboard-frame-')) return;
      
      // 如果对象被锁定，则解锁
      if (!obj.selectable || !obj.evented) {
        obj.set({
          selectable: true,
          evented: true,
          lockMovementX: false,
          lockMovementY: false,
          lockRotation: false,
          lockScalingX: false,
          lockScalingY: false,
        });
        unlockedCount++;
      }
    });
    
    canvas.renderAll();
    saveState();
    
    if (unlockedCount > 0) {
      toast.success(`已解锁 ${unlockedCount} 个对象`);
    } else {
      toast.info("没有被锁定的对象");
    }
  };
  

  const handleColorAdjust = () => {
    toast.info("颜色调整功能开发中");
  };

  // Helper functions
  const loadImageFromDataURL = (dataUrl: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  };

  const classifyExtractedObject = async (imageBlob: Blob): Promise<'character' | 'prop' | 'scene'> => {
    try {
      const reader = new FileReader();
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
      });
      
      const { data, error } = await supabase.functions.invoke('classify-object', {
        body: { imageUrl: imageDataUrl }
      });
      
      if (error) throw error;
      return data.elementType;
    } catch (error) {
      console.error('Classification error:', error);
      return 'prop';
    }
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
          top: cropRect.top,
          data: image.data // 保留原始图片的所有 data 属性，包括 elementType
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
        <Button variant="outline" size="sm" className={`${isCollapsed ? 'w-full px-0' : 'w-full justify-start'}`} onClick={handleAddElement} disabled={isGenerating || isTaskProcessing}>
          <Plus className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">添加元素</span>}
        </Button>

        {/* Add Text */}
        <Button variant="outline" size="sm" className={`${isCollapsed ? 'w-full px-0' : 'w-full justify-start'}`} onClick={handleAddText}>
          <Type className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">添加文字</span>}
        </Button>

        {/* Add Shapes */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={`${isCollapsed ? 'w-full px-0' : 'w-full justify-start'}`}>
              <Square className="h-4 w-4" />
              {!isCollapsed && <span className="ml-2">添加形状</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
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

        {/* Add Speech Bubbles */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={`${isCollapsed ? 'w-full px-0' : 'w-full justify-start'}`}>
              <MessageCircle className="h-4 w-4" />
              {!isCollapsed && <span className="ml-2">添加对话框</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
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

        <div className={`flex gap-1 ${isCollapsed ? 'flex-col' : ''}`}>
          <Button 
            variant="outline" 
            size="sm" 
            className={`${isCollapsed ? 'w-full px-0' : 'flex-1 justify-start'}`} 
            onClick={executeSmartExtract}
            disabled={isTaskProcessing}
          >
            <Scissors className="h-4 w-4" />
            {!isCollapsed && <span className="ml-2">智能提取</span>}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className={`${isCollapsed ? 'w-full px-0' : ''}`}
            onClick={() => setShowExtractDialog(true)}
            disabled={isTaskProcessing}
            title="提取设置"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        <div className={`flex gap-1 ${isCollapsed ? 'flex-col' : ''}`}>
          <Button 
            variant={activeTool === "eraser" ? "default" : "outline"}
            size="sm" 
            className={`${isCollapsed ? 'w-full px-0' : 'flex-1 justify-start'}`} 
            onClick={() => setActiveTool?.("eraser")}
            title="擦除工具"
          >
            <Eraser className="h-4 w-4" />
            {!isCollapsed && <span className="ml-2">擦除</span>}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className={`${isCollapsed ? 'w-full px-0' : ''}`}
            onClick={() => setShowEraserSettings(true)}
            title="擦除设置"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" size="sm" className={`${isCollapsed ? 'w-full px-0' : 'w-full justify-start'}`} onClick={handleFlip}>
          <FlipHorizontal className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">镜像</span>}
        </Button>

        <Button variant="outline" size="sm" className={`${isCollapsed ? 'w-full px-0' : 'w-full justify-start'}`} onClick={handleDuplicate}>
          <Copy className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">复制</span>}
        </Button>

        <Separator />

        {/* Layer Order */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={`${isCollapsed ? 'w-full px-0' : 'w-full justify-start'}`}>
              <ChevronsUp className="h-4 w-4" />
              {!isCollapsed && <span className="ml-2">图层顺序</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={handleBringToFront}>
              <ChevronsUp className="h-4 w-4 mr-2" />
              置于顶层
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleBringForward}>
              <ArrowUp className="h-4 w-4 mr-2" />
              上移一层
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSendBackwards}>
              <ArrowDown className="h-4 w-4 mr-2" />
              下移一层
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSendToBack}>
              <ChevronsDown className="h-4 w-4 mr-2" />
              置于底层
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Lock/Unlock */}
        <Button 
          variant="outline" 
          size="sm" 
          className={`${isCollapsed ? 'w-full px-0' : 'w-full justify-start'}`} 
          onClick={handleToggleLock}
        >
          {isObjectLocked ? (
            <>
              <Unlock className="h-4 w-4" />
              {!isCollapsed && <span className="ml-2">解锁</span>}
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              {!isCollapsed && <span className="ml-2">锁定</span>}
            </>
          )}
        </Button>

        {/* Unlock All */}
        <Button 
          variant="outline" 
          size="sm" 
          className={`${isCollapsed ? 'w-full px-0' : 'w-full justify-start'}`} 
          onClick={handleUnlockAll}
        >
          <Unlock className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">解锁全部</span>}
        </Button>


      </div>

      {/* Smart Extract Dialog */}
      <Dialog open={showExtractDialog} onOpenChange={setShowExtractDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>智能提取设置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>提取模式</Label>
              <div className="flex gap-2">
                <Button
                  variant={extractMode === 'auto' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setExtractMode('auto')}
                  className="flex-1"
                >
                  自动提取
                </Button>
                <Button
                  variant={extractMode === 'scribble' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setExtractMode('scribble')}
                  className="flex-1"
                >
                  涂抹选择
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {extractMode === 'auto' 
                  ? '自动识别图片中心的主要物体' 
                  : '手动涂抹需要提取的区域，更精确'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="extract-padding">裁剪边距: {extractPadding} 像素</Label>
              <Slider 
                id="extract-padding" 
                min={0} 
                max={50} 
                step={5} 
                value={[extractPadding]} 
                onValueChange={value => setExtractPadding(value[0])} 
                className="w-full" 
              />
              <p className="text-sm text-muted-foreground">
                减小此值可以让裁剪更紧凑，增加此值可以保留更多边距空间
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="extract-dilation">边缘扩张: {extractDilation} 像素</Label>
              <Slider 
                id="extract-dilation" 
                min={0} 
                max={10} 
                step={1} 
                value={[extractDilation]} 
                onValueChange={value => setExtractDilation(value[0])} 
                className="w-full" 
              />
              <p className="text-sm text-muted-foreground">
                增加此值可以包含更多主体边缘区域，避免丢失细节
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="extract-feather">边缘羽化: {extractFeather} 像素</Label>
              <Slider 
                id="extract-feather" 
                min={0} 
                max={10} 
                step={1} 
                value={[extractFeather]} 
                onValueChange={value => setExtractFeather(value[0])} 
                className="w-full" 
              />
              <p className="text-sm text-muted-foreground">
                增加此值可以使边缘更加柔和自然
              </p>
            </div>
            <Button onClick={executeSmartExtract} className="w-full">
              {extractMode === 'scribble' ? '下一步：涂抹区域' : '开始提取'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scribble Overlay - 使用 Portal 渲染到 body */}
      {isScribbling && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-2 backdrop-blur-sm"
          onClick={(e) => {
            // 点击背景关闭
            if (e.target === e.currentTarget) {
              cancelScribbleMode();
            }
          }}
        >
          <div className="bg-background rounded-xl shadow-2xl max-w-[95vw] w-full max-h-[95vh] flex flex-col border-2 border-primary/20">
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b bg-muted/50">
              <div>
                <h3 className="text-xl font-semibold">涂抹需要提取的区域</h3>
                <p className="text-sm text-muted-foreground mt-1">在图片上用鼠标涂抹出想要提取的物体</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setScribblePoints([]);
                    if (scribbleCanvasRef.current) {
                      const ctx = scribbleCanvasRef.current.getContext('2d');
                      if (ctx) {
                        ctx.clearRect(0, 0, scribbleCanvasRef.current.width, scribbleCanvasRef.current.height);
                      }
                    }
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  清除
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelScribbleMode}
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={executeSmartExtract}
                  disabled={scribblePoints.length === 0}
                  className="min-w-[100px]"
                >
                  <Check className="h-4 w-4 mr-2" />
                  确认提取
                </Button>
              </div>
            </div>
            
            {/* 画布区域 */}
            <div className="flex-1 overflow-auto p-4">
              <ScribbleCanvas
                canvas={canvas}
                scribbleCanvasRef={scribbleCanvasRef}
                scribblePoints={scribblePoints}
                setScribblePoints={setScribblePoints}
              />
            </div>
            
            {/* 底部提示 */}
            <div className="p-3 border-t bg-muted/30 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-4 h-4 bg-green-500 rounded-full opacity-70"></div>
                <span>绿色轨迹表示涂抹区域</span>
              </div>
              <div className="text-muted-foreground">
                已涂抹点数: <span className="font-semibold text-foreground">{scribblePoints.length}</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Eraser Settings Dialog */}
      <Dialog open={showEraserSettings} onOpenChange={setShowEraserSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>擦除设置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="eraser-brush-size">笔刷大小: {eraserBrushSize} 像素</Label>
              <Slider 
                id="eraser-brush-size" 
                min={5} 
                max={100} 
                step={5} 
                value={[eraserBrushSize]} 
                onValueChange={value => setEraserBrushSize?.(value[0])} 
                className="w-full" 
              />
              <p className="text-sm text-muted-foreground">
                调节擦除笔刷的大小以控制擦除范围
              </p>
            </div>
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
              <TabsTrigger value="professional">专业生成</TabsTrigger>
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
                    className="min-h-[120px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.ctrlKey) {
                        handleAiGenerate();
                      }
                    }}
                  />
                  <p className="text-sm text-muted-foreground">
                    使用 Google Imagen 4 生成 · 按 Ctrl+Enter 快速生成
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

            <TabsContent value="professional" className="space-y-4">
              <ProfessionalGenerateGrid 
                onSelectImage={handleAddHistoryImageToCanvas}
                onCreateNew={handleNavigateToGenerate}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Save Confirm Dialog */}
      <AlertDialog open={showSaveConfirmDialog} onOpenChange={setShowSaveConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认跳转到图片生成？</AlertDialogTitle>
            <AlertDialogDescription>
              当前编辑的内容将自动保存为草稿。您可以随时返回继续编辑。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmNavigate}>
              保存并跳转
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Element Dialog */}
      <Dialog open={showAddElementDialog} onOpenChange={(open) => {
        setShowAddElementDialog(open);
        if (!open) setSelectedElementType(null);
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedElementType 
                ? `添加${selectedElementType === 'character' ? '角色' : selectedElementType === 'scene' ? '场景' : selectedElementType === 'prop' ? '道具' : '特效'}`
                : '选择元素类型'
              }
            </DialogTitle>
          </DialogHeader>
          
          {!selectedElementType ? (
            <div className="grid grid-cols-2 gap-4 py-8">
              <Button
                variant="outline"
                className="h-32 flex flex-col gap-2"
                onClick={() => handleSelectElementType('character')}
              >
                <User className="h-8 w-8" />
                <span className="text-lg">角色</span>
              </Button>
              <Button
                variant="outline"
                className="h-32 flex flex-col gap-2"
                onClick={() => handleSelectElementType('scene')}
              >
                <ImageIcon className="h-8 w-8" />
                <span className="text-lg">场景</span>
              </Button>
              <Button
                variant="outline"
                className="h-32 flex flex-col gap-2"
                onClick={() => handleSelectElementType('prop')}
              >
                <Box className="h-8 w-8" />
                <span className="text-lg">道具</span>
              </Button>
              <Button
                variant="outline"
                className="h-32 flex flex-col gap-2"
                onClick={() => handleSelectElementType('effect')}
              >
                <Sparkles className="h-8 w-8" />
                <span className="text-lg">特效</span>
              </Button>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[400px] pr-4">
                <div className="grid grid-cols-3 gap-4">
                  {/* Show history images - filtered by type if needed */}
                  <AddElementHistoryGrid 
                    elementType={selectedElementType} 
                    onSelectImage={handleAddHistoryImageToCanvas} 
                  />
                </div>
              </ScrollArea>
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setSelectedElementType(null)}
                  className="flex-1"
                >
                  返回
                </Button>
                <Button
                  onClick={handleUploadImage}
                  className="flex-1"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  上传图片
                </Button>
                <Button
                  onClick={handleGenerateImage}
                  className="flex-1"
                  disabled={isTaskProcessing}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI生成
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>;
};

// Professional Generate Grid Component with Create New button
const ProfessionalGenerateGrid = ({ 
  onSelectImage, 
  onCreateNew 
}: { 
  onSelectImage: (url: string) => void;
  onCreateNew: () => void;
}) => {
  const { data: history, isLoading } = useQuery({
    queryKey: ["generation-history-professional"],
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

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        {/* Create New Button */}
        <div
          className="group relative aspect-square rounded-lg overflow-hidden border-2 border-dashed border-primary/50 hover:border-primary cursor-pointer transition-all bg-muted/50 hover:bg-muted flex items-center justify-center"
          onClick={onCreateNew}
        >
          <div className="flex flex-col items-center gap-2">
            <Plus className="h-12 w-12 text-primary" />
            <p className="text-sm font-medium text-primary">创建新图</p>
          </div>
        </div>

        {/* History Images */}
        {history && history.length > 0 && history.map((item) => {
          const images = (item as any).images || (item.image_url ? [item.image_url] : []);
          const imageUrl = images[0];
          
          if (!imageUrl) return null;

          return (
            <div
              key={item.id}
              className="group relative aspect-square rounded-lg overflow-hidden border border-border hover:border-primary cursor-pointer transition-all bg-muted"
              onClick={() => onSelectImage(imageUrl)}
            >
              <img
                src={imageUrl}
                alt={item.prompt}
                className="w-100 h-100 object-cover"
                loading="lazy"
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

        {(!history || history.length === 0) && (
          <div className="col-span-2 md:col-span-2 text-center py-8">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">还没有生成记录</p>
            <p className="text-sm text-muted-foreground mt-2">点击「创建新图」开始生成</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

// Add Element History Grid Component
const AddElementHistoryGrid = ({ 
  elementType,
  onSelectImage
}: { 
  elementType: 'character' | 'scene' | 'prop' | 'effect' | null;
  onSelectImage: (url: string) => void;
}) => {
  const { data: history, isLoading } = useQuery({
    queryKey: ["generation-history-add-element", elementType],
    queryFn: async () => {
      let query = supabase
        .from("generation_history")
        .select("*")
        .eq("status", "completed")
        .not("element_name", "is", null);
      
      if (elementType) {
        query = query.eq("element_type", elementType);
      }
      
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="col-span-3 text-center py-8">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="col-span-3 text-center py-8">
        <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
        <p className="text-muted-foreground">还没有历史图片</p>
        <p className="text-sm text-muted-foreground mt-2">点击下方按钮上传或生成新图片</p>
      </div>
    );
  }

  return (
    <>
      {history.map((item) => {
        const images = (item as any).images || (item.image_url ? [item.image_url] : []);
        const imageUrl = images[0];
        
        if (!imageUrl) return null;

        return (
          <div
            key={item.id}
            className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
            onClick={() => onSelectImage(imageUrl)}
          >
            <img
              src={imageUrl}
              alt={item.prompt || '历史图片'}
              className="w-full h-full object-cover"
            />
          </div>
        );
      })}
    </>
  );
};

// Scribble Canvas Component for interactive extraction
interface ScribbleCanvasProps {
  canvas: FabricCanvas | null;
  scribbleCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  scribblePoints: Array<{ x: number; y: number }>;
  setScribblePoints: React.Dispatch<React.SetStateAction<Array<{ x: number; y: number }>>>;
}

const ScribbleCanvas = ({ canvas, scribbleCanvasRef, scribblePoints, setScribblePoints }: ScribbleCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const activeObject = canvas?.getActiveObject();
    if (!activeObject || activeObject.type !== 'image') return;

    const fabricImage = activeObject as any;
    const dataURL = fabricImage.toDataURL({
      format: 'png',
      quality: 1,
      enableRetinaScaling: false
    });
    setImageData(dataURL);
  }, [canvas]);

  // 初始化 canvas 尺寸
  useEffect(() => {
    if (!imageData || !imageRef.current || !scribbleCanvasRef.current) return;

    const img = imageRef.current;
    const canvasEl = scribbleCanvasRef.current;
    
    const updateCanvasSize = () => {
      const rect = img.getBoundingClientRect();
      canvasEl.width = rect.width;
      canvasEl.height = rect.height;
      setCanvasSize({ width: rect.width, height: rect.height });
      
      // 清空画布
      const ctx = canvasEl.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, rect.width, rect.height);
      }
    };

    // 图片加载完成后设置尺寸
    if (img.complete) {
      updateCanvasSize();
    } else {
      img.onload = updateCanvasSize;
    }

    // 监听窗口大小变化
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [imageData, scribbleCanvasRef]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvasEl = scribbleCanvasRef.current;
    if (!canvasEl) return null;
    
    const rect = canvasEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 归一化坐标 [0, 1]
    const normalizedX = x / rect.width;
    const normalizedY = y / rect.height;
    
    return { x: normalizedX, y: normalizedY, canvasX: x, canvasY: y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e);
    if (!coords) return;
    
    setIsDrawing(true);
    setScribblePoints([...scribblePoints, { x: coords.x, y: coords.y }]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const coords = getCanvasCoordinates(e);
    if (!coords) return;
    
    const canvasEl = scribbleCanvasRef.current;
    if (!canvasEl) return;
    
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    
    // 绘制涂抹轨迹
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.7;
    
    if (scribblePoints.length > 0) {
      const lastPoint = scribblePoints[scribblePoints.length - 1];
      const lastX = lastPoint.x * canvasSize.width;
      const lastY = lastPoint.y * canvasSize.height;
      
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(coords.canvasX, coords.canvasY);
      ctx.stroke();
    }
    
    setScribblePoints([...scribblePoints, { x: coords.x, y: coords.y }]);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  if (!imageData) return <div className="text-center py-8">加载中...</div>;

  return (
    <div ref={containerRef} className="relative w-full bg-muted rounded-lg overflow-hidden">
      <div className="relative w-full max-h-[80vh] flex items-center justify-center">
        <img
          ref={imageRef}
          src={imageData}
          alt="提取对象"
          className="max-w-full max-h-[80vh] object-contain"
        />
        <canvas
          ref={scribbleCanvasRef}
          className="absolute cursor-crosshair"
          style={{ 
            touchAction: 'none',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
      <div className="p-2 text-sm text-muted-foreground text-center">
        在图片上涂抹需要提取的区域（绿色轨迹） | 已涂抹点数: {scribblePoints.length}
      </div>
    </div>
  );
};