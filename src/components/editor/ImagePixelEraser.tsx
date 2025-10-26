import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Eraser, Undo, Redo, ZoomIn, ZoomOut, Move, PaintBucket, Sparkles } from "lucide-react";
import { FabricImage } from "fabric";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MediaPipeSegmenter } from "@/lib/mediapipe/interactiveSegmenter";
import { toast } from "sonner";

interface ImagePixelEraserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageObject: FabricImage | null;
  onSave: (imageDataUrl: string) => void;
}

type BackgroundMode = 'checkered' | 'light' | 'dark';

export const ImagePixelEraser = ({ open, onOpenChange, imageObject, onSave }: ImagePixelEraserProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [brushSize, setBrushSize] = useState(20);
  const [isErasing, setIsErasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [zoom, setZoom] = useState(1);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('checkered');
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<'erase' | 'pan' | 'restore' | 'preview'>('erase');
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [tempPanning, setTempPanning] = useState(false);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const originalImageDataRef = useRef<ImageData | null>(null);
  const originalImageUrlRef = useRef<string | null>(null);
  
  // 预览相关状态
  const [previewMask, setPreviewMask] = useState<Uint8Array | null>(null);
  const [previewMaskSize, setPreviewMaskSize] = useState<{width: number, height: number} | null>(null);
  const [previewPoints, setPreviewPoints] = useState<Array<{x: number, y: number}>>([]);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open || !imageObject) {
      return;
    }

    // 等待 canvas ref 准备好
    const initCanvas = async () => {
      // 给 Dialog 一点时间完成渲染
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = canvasRef.current;
      if (!canvas) {
        console.error('ImagePixelEraser: Canvas ref not ready');
        return;
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: true });
      if (!ctx) {
        console.error('ImagePixelEraser: Could not get canvas context');
        return;
      }

      ctxRef.current = ctx;

      try {
        // 检查是否已经保存了原始图片URL (方案B)
        const savedOriginalUrl = (imageObject as any).originalImageDataUrl;
        
        // 获取当前图片数据URL
        const imgDataUrl = imageObject.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: 1
        });

        // 如果没有保存原始URL，则保存当前URL作为原始数据
        if (!savedOriginalUrl) {
          (imageObject as any).originalImageDataUrl = imgDataUrl;
          originalImageUrlRef.current = imgDataUrl;
        } else {
          originalImageUrlRef.current = savedOriginalUrl;
        }

        console.log('ImagePixelEraser: Got image data URL');

        const img = new Image();
        img.onload = () => {
          const width = img.width;
          const height = img.height;

          console.log('ImagePixelEraser: Image dimensions:', width, height);

          // 设置画布尺寸
          canvas.width = width;
          canvas.height = height;

          // 清除画布并确保透明背景
          ctx.clearRect(0, 0, width, height);
          
          // 绘制图片到画布，保留透明通道
          ctx.drawImage(img, 0, 0, width, height);
          console.log('ImagePixelEraser: Image drawn successfully');
          
          // 同步预览canvas尺寸
          if (previewCanvasRef.current) {
            previewCanvasRef.current.width = width;
            previewCanvasRef.current.height = height;
            console.log('ImagePixelEraser: Preview canvas initialized');
          }

          // 保存初始状态到历史
          const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
          setHistory([initialState]);
          setHistoryIndex(0);
          
          // 加载原始图片数据用于恢复笔刷
          if (originalImageUrlRef.current) {
            const originalImg = new Image();
            originalImg.onload = () => {
              const tempCanvas = document.createElement('canvas');
              const tempCtx = tempCanvas.getContext('2d');
              if (tempCtx) {
                tempCanvas.width = originalImg.width;
                tempCanvas.height = originalImg.height;
                tempCtx.drawImage(originalImg, 0, 0);
                originalImageDataRef.current = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                console.log('ImagePixelEraser: Original image data loaded for restore');
              }
            };
            originalImg.src = originalImageUrlRef.current;
          }
          
          console.log('ImagePixelEraser: History initialized');
        };

        img.onerror = (error) => {
          console.error('ImagePixelEraser: Error loading image:', error);
        };

        img.src = imgDataUrl;
      } catch (error) {
        console.error('ImagePixelEraser: Error loading image:', error);
      }
    };

    initCanvas();
  }, [open, imageObject]);

  // 监听空格键
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressed) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(false);
        setTempPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [open, isSpacePressed]);

  const saveToHistory = () => {
    if (!canvasRef.current || !ctxRef.current) return;

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // 删除当前索引之后的历史
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(imageData);

    // 限制历史记录数量
    if (newHistory.length > 50) {
      newHistory.shift();
    } else {
      setHistoryIndex(historyIndex + 1);
    }

    setHistory(newHistory);
  };

  const undo = () => {
    if (historyIndex <= 0 || !canvasRef.current || !ctxRef.current) return;

    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    ctxRef.current.putImageData(history[newIndex], 0, 0);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1 || !canvasRef.current || !ctxRef.current) return;

    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    ctxRef.current.putImageData(history[newIndex], 0, 0);
  };

  const startErasing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // 阻止中键点击的默认行为
    if (e.button === 1) {
      e.preventDefault();
    }
    
    if (tool === 'preview') {
      // 在预览模式下不启动擦除或其他编辑操作
      return;
    }
    
    // 空格键临时平移或鼠标中键平移
    if (isSpacePressed || e.button === 1) {
      e.preventDefault();
      setTempPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }
    
    if (tool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    } else if (tool === 'restore') {
      setIsRestoring(true);
      restore(e);
    } else {
      setIsErasing(true);
      erase(e);
    }
  };

  const stopErasing = () => {
    if (isErasing) {
      setIsErasing(false);
      saveToHistory();
    }
    if (isRestoring) {
      setIsRestoring(false);
      saveToHistory();
    }
    if (isPanning) {
      setIsPanning(false);
    }
    if (tempPanning) {
      setTempPanning(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // 临时平移优先级最高
    if (tempPanning) {
      const newOffset = {
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      };
      setPanOffset(newOffset);
      return;
    }
    
    if (tool === 'preview') {
      // 在预览模式下不处理鼠标移动事件
      return;
    }
    
    if (isPanning && tool === 'pan') {
      const newOffset = {
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      };
      setPanOffset(newOffset);
    } else if (tool === 'restore') {
      restore(e);
    } else {
      erase(e);
    }
  };

  const erase = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isErasing && e.type !== 'mousedown') return;
    if (!canvasRef.current || !ctxRef.current) return;

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // 计算鼠标在画布上的实际位置
    // rect.width/height 已经是缩放后的显示尺寸，直接映射到画布坐标即可
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 将显示坐标转换为实际画布坐标
    const x = (mouseX / rect.width) * canvas.width;
    const y = (mouseY / rect.height) * canvas.height;

    // 使用 destination-out 混合模式来擦除像素
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  };

  const restore = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isRestoring && e.type !== 'mousedown') return;
    if (!canvasRef.current || !ctxRef.current || !originalImageDataRef.current) return;

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // 计算鼠标在画布上的实际位置
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const x = (mouseX / rect.width) * canvas.width;
    const y = (mouseY / rect.height) * canvas.height;

    // 从原始图像中恢复像素区域
    const brushRadius = brushSize / 2;
    const startX = Math.max(0, Math.floor(x - brushRadius));
    const startY = Math.max(0, Math.floor(y - brushRadius));
    const endX = Math.min(canvas.width, Math.ceil(x + brushRadius));
    const endY = Math.min(canvas.height, Math.ceil(y + brushRadius));
    
    // 遍历笔刷覆盖区域的每个像素
    const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const originalImageData = originalImageDataRef.current;
    
    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        const dx = px - x;
        const dy = py - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 只处理在笔刷半径内的像素
        if (distance <= brushRadius) {
          const idx = (py * canvas.width + px) * 4;
          
          // 从原始图像复制像素数据（包括 alpha 通道）
          currentImageData.data[idx] = originalImageData.data[idx];         // R
          currentImageData.data[idx + 1] = originalImageData.data[idx + 1]; // G
          currentImageData.data[idx + 2] = originalImageData.data[idx + 2]; // B
          currentImageData.data[idx + 3] = originalImageData.data[idx + 3]; // A
        }
      }
    }
    
    ctx.putImageData(currentImageData, 0, 0);
  };

  const generatePreview = async (clickX: number, clickY: number, isSubtract: boolean = false) => {
    if (!canvasRef.current || !previewCanvasRef.current) return;
    
    setIsGeneratingPreview(true);
    
    try {
      const canvas = canvasRef.current;
      
      // 获取当前canvas图像
      const img = new Image();
      img.src = canvas.toDataURL('image/png');
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
      });
      
      // 初始化 MediaPipe segmenter
      const segmenter = new MediaPipeSegmenter();
      await segmenter.initialize();
      
      // 记录点击点
      const newPoints = [...previewPoints, { x: clickX, y: clickY }];
      setPreviewPoints(newPoints);
      
      // 使用单点或多点进行分割
      let result;
      if (newPoints.length === 1) {
        result = await segmenter.segmentWithPoint(img, clickX, clickY);
      } else {
        result = await segmenter.segmentWithScribbles(img, newPoints);
      }
      
      if (result?.categoryMask) {
        const maskData = result.categoryMask.getAsUint8Array();
        const maskWidth = result.categoryMask.width;
        const maskHeight = result.categoryMask.height;
        
        // 如果已有预览掩码，进行合并或减选
        if (previewMask && previewMaskSize) {
          const mergedMask = new Uint8Array(maskData.length);
          for (let i = 0; i < maskData.length; i++) {
            // MediaPipe: 0 = 前景（要提取的区域），非0 = 背景
            if (isSubtract) {
              // 减选：从现有选区中移除新掩码的前景部分
              // 如果原来是前景(0)且新掩码也是前景(0)，则变成背景(1)
              // 否则保持原有状态
              mergedMask[i] = (previewMask[i] === 0 && maskData[i] === 0) ? 1 : previewMask[i];
            } else {
              // 添加：两个掩码只要有一个是前景(0)，结果就是前景(0)
              mergedMask[i] = (maskData[i] === 0 || previewMask[i] === 0) ? 0 : 1;
            }
          }
          setPreviewMask(mergedMask);
        } else {
          setPreviewMask(maskData);
        }
        
        setPreviewMaskSize({ width: maskWidth, height: maskHeight });
        
        // 绘制预览
        drawPreviewMask(maskData, maskWidth, maskHeight);
        
        if (isSubtract) {
          toast.success(`已减少选择区域 (${newPoints.length}个点)`);
        } else {
          toast.success(`已添加选择区域 (${newPoints.length}个点)`);
        }
      } else {
        toast.info("未检测到物体");
      }
      
      segmenter.close();
    } catch (error) {
      console.error('Preview generation error:', error);
      toast.error('预览生成失败');
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const drawPreviewMask = (maskData?: Uint8Array, maskWidth?: number, maskHeight?: number) => {
    const mask = maskData || previewMask;
    const size = (maskWidth && maskHeight) ? { width: maskWidth, height: maskHeight } : previewMaskSize;
    
    if (!previewCanvasRef.current || !mask || !size) return;
    
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 清空预览canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 创建半透明红色遮罩
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;
    
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        // 将canvas坐标映射到mask坐标
        const maskX = Math.floor((x / canvas.width) * size.width);
        const maskY = Math.floor((y / canvas.height) * size.height);
        const maskIdx = maskY * size.width + maskX;
        
        // MediaPipe: 0 = 前景（要提取的区域）
        if (mask[maskIdx] === 0) {
          const idx = (y * canvas.width + x) * 4;
          data[idx] = 255;      // R - 红色
          data[idx + 1] = 0;    // G
          data[idx + 2] = 0;    // B
          data[idx + 3] = 128;  // A - 50%透明度
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  };

  const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== 'preview' || isGeneratingPreview) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const x = (mouseX / rect.width) * canvas.width;
    const y = (mouseY / rect.height) * canvas.height;
    
    // 检测是否按下Shift键进行减选
    const isSubtract = e.shiftKey;
    await generatePreview(x, y, isSubtract);
  };

  const applyExtraction = () => {
    if (!canvasRef.current || !ctxRef.current || !previewMask || !previewMaskSize) {
      toast.error('没有可应用的预览');
      return;
    }
    
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    
    // 应用掩码到主canvas的alpha通道
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const maskX = Math.floor((x / canvas.width) * previewMaskSize.width);
        const maskY = Math.floor((y / canvas.height) * previewMaskSize.height);
        const maskIdx = maskY * previewMaskSize.width + maskX;
        const idx = (y * canvas.width + x) * 4;
        
        // MediaPipe: 0 = 前景（保留），非0 = 背景（删除）
        if (previewMask[maskIdx] !== 0) {
          data[idx + 3] = 0; // 设置为透明
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // 清除预览
    clearPreview();
    
    // 保存到历史
    saveToHistory();
    
    // 切换回擦除工具
    setTool('erase');
    
    toast.success('智能提取已应用');
  };

  const clearPreview = () => {
    setPreviewMask(null);
    setPreviewMaskSize(null);
    setPreviewPoints([]);
    
    if (previewCanvasRef.current) {
      const ctx = previewCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
      }
    }
    
    toast.info('预览已清除');
  };

  const handleSave = () => {
    if (!canvasRef.current) return;

    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSave(dataUrl);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    // 滚轮向上缩小，向下放大
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };

  const getBackgroundClass = () => {
    switch (backgroundMode) {
      case 'checkered':
        return 'bg-checkered';
      case 'light':
        return 'bg-white';
      case 'dark':
        return 'bg-gray-900';
      default:
        return 'bg-checkered';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eraser className="h-5 w-5" />
            像素编辑工具
          </DialogTitle>
          <DialogDescription>
            使用擦除笔刷移除不需要的部分，恢复笔刷还原原始像素，或点击智能提取预览模式选择要保留的区域（按住Shift键可减选区域）。提示：按住空格键或鼠标中键拖动可平移视图，鼠标滚轮可缩放视图
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-auto">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label>画笔大小: {brushSize}px</Label>
              <Slider
                value={[brushSize]}
                onValueChange={(value) => setBrushSize(value[0])}
                min={1}
                max={100}
                step={1}
                className="mt-2"
              />
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <ToggleGroup type="single" value={tool} onValueChange={(value) => value && setTool(value as typeof tool)}>
                <ToggleGroupItem value="erase" aria-label="擦除工具" title="擦除工具">
                  <Eraser className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="restore" aria-label="恢复笔刷" title="恢复笔刷">
                  <PaintBucket className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="pan" aria-label="拖动工具" title="拖动工具">
                  <Move className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="preview" aria-label="智能提取预览" title="智能提取预览">
                  <Sparkles className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
              {tool === 'preview' && (
                <>
                  <div className="w-px h-6 bg-border" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={applyExtraction}
                    disabled={!previewMask || isGeneratingPreview}
                    title="应用智能提取"
                  >
                    ✓ 应用提取
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearPreview}
                    disabled={!previewMask || isGeneratingPreview}
                    title="清除预览重新选择"
                  >
                    ✕ 清除预览
                  </Button>
                  {isGeneratingPreview && (
                    <span className="text-sm text-muted-foreground">生成预览中...</span>
                  )}
                </>
              )}
              <div className="w-px h-6 bg-border" />
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                title="缩小"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                title="放大"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-border" />
              <Button
                variant="outline"
                size="sm"
                onClick={undo}
                disabled={historyIndex <= 0}
                title="撤销"
              >
                <Undo className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                title="重做"
              >
                <Redo className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Label>背景:</Label>
            <ToggleGroup type="single" value={backgroundMode} onValueChange={(value) => value && setBackgroundMode(value as BackgroundMode)}>
              <ToggleGroupItem value="checkered" aria-label="棋盘格" title="棋盘格">
                棋盘格
              </ToggleGroupItem>
              <ToggleGroupItem value="light" aria-label="亮色" title="亮色">
                亮色
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" aria-label="暗色" title="暗色">
                暗色
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div 
            ref={containerRef}
            className={`border rounded-lg overflow-hidden max-h-[60vh] ${getBackgroundClass()} p-4 flex items-center justify-center relative`}
            onWheel={handleWheel}
          >
            <div 
              style={{ 
                transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                position: 'relative'
              }}
            >
              {/* 主Canvas - 编辑层 */}
              <canvas
                ref={canvasRef}
                className={
                  tempPanning || isSpacePressed ? 'cursor-move' :
                  tool === 'pan' ? 'cursor-move' : 
                  tool === 'restore' ? 'cursor-pointer' : 
                  tool === 'preview' ? 'cursor-crosshair' : 
                  'cursor-crosshair'
                }
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                onMouseDown={startErasing}
                onMouseMove={handleMouseMove}
                onMouseUp={stopErasing}
                onMouseLeave={stopErasing}
                onClick={handleCanvasClick}
                onContextMenu={(e) => e.preventDefault()}
              />
              
              {/* 预览Canvas - 叠加层 */}
              <canvas
                ref={previewCanvasRef}
                className="absolute top-0 left-0 pointer-events-none"
                style={{ 
                  transform: `scale(${zoom})`, 
                  transformOrigin: 'center center',
                  opacity: tool === 'preview' ? 1 : 0
                }}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            取消
          </Button>
          <Button onClick={handleSave}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
