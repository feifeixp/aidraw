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
  const [tool, setTool] = useState<'erase' | 'pan' | 'restore'>('erase');
  const [isExtracting, setIsExtracting] = useState(false);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const originalImageDataRef = useRef<ImageData | null>(null);
  const originalImageUrlRef = useRef<string | null>(null);

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
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
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

  const handleSmartExtract = async () => {
    if (!canvasRef.current || !ctxRef.current) return;

    setIsExtracting(true);
    try {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;

      // Get current canvas as image
      const currentDataUrl = canvas.toDataURL('image/png');
      const img = new Image();
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = currentDataUrl;
      });

      // Initialize MediaPipe segmenter
      const segmenter = new MediaPipeSegmenter();
      await segmenter.initialize();

      // Use center point for segmentation
      const centerX = img.width / 2;
      const centerY = img.height / 2;

      const result = await segmenter.segmentWithPoint(img, centerX, centerY);

      if (!result || !result.categoryMask) {
        toast.info("未检测到需要提取的物体");
        segmenter.close();
        setIsExtracting(false);
        return;
      }

      // Create source canvas
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = img.width;
      sourceCanvas.height = img.height;
      const sourceCtx = sourceCanvas.getContext('2d')!;
      sourceCtx.drawImage(img, 0, 0);

      // Extract the masked object
      const maskData = result.categoryMask.getAsUint8Array();
      const extractedCanvas = segmenter.extractMaskedImage(
        sourceCanvas,
        maskData,
        result.categoryMask.width,
        result.categoryMask.height,
        {
          dilation: -2,
          feather: 0,
          padding: 10,
          crop: false  // Don't crop in pixel editor
        }
      );

      // Draw extracted image back to main canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(extractedCanvas, 0, 0);

      // Save to history
      const newImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newImageData);
      if (newHistory.length > 50) {
        newHistory.shift();
      } else {
        setHistoryIndex(historyIndex + 1);
      }
      setHistory(newHistory);

      segmenter.close();
      toast.success("智能提取成功");
    } catch (error) {
      console.error("Smart extract error:", error);
      toast.error("智能提取失败");
    } finally {
      setIsExtracting(false);
    }
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
            使用擦除笔刷移除不需要的部分，恢复笔刷还原原始像素，或智能提取物体
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
              <ToggleGroup type="single" value={tool} onValueChange={(value) => value && setTool(value as 'erase' | 'pan' | 'restore')}>
                <ToggleGroupItem value="erase" aria-label="擦除工具" title="擦除工具">
                  <Eraser className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="restore" aria-label="恢复笔刷" title="恢复笔刷">
                  <PaintBucket className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="pan" aria-label="拖动工具" title="拖动工具">
                  <Move className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
              <div className="w-px h-6 bg-border" />
              <Button
                variant="outline"
                size="sm"
                onClick={handleSmartExtract}
                disabled={isExtracting}
                title="智能提取物体"
              >
                <Sparkles className="h-4 w-4 mr-1" />
                {isExtracting ? "提取中..." : "智能提取"}
              </Button>
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
          >
            <div 
              style={{ 
                transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                transition: isPanning ? 'none' : 'transform 0.1s ease-out'
              }}
            >
              <canvas
                ref={canvasRef}
                className={tool === 'pan' ? 'cursor-move' : tool === 'restore' ? 'cursor-pointer' : 'cursor-crosshair'}
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                onMouseDown={startErasing}
                onMouseMove={handleMouseMove}
                onMouseUp={stopErasing}
                onMouseLeave={stopErasing}
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
