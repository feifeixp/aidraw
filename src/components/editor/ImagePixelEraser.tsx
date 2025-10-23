import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Eraser, Undo, Redo, ZoomIn, ZoomOut, Move } from "lucide-react";
import { FabricImage } from "fabric";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [zoom, setZoom] = useState(1);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('checkered');
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<'erase' | 'pan'>('erase');
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

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
        // 获取图片数据URL
        const imgDataUrl = imageObject.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: 1
        });

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
            像素擦除工具
          </DialogTitle>
          <DialogDescription>
            使用画笔擦除图片中不需要的部分
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
              <ToggleGroup type="single" value={tool} onValueChange={(value) => value && setTool(value as 'erase' | 'pan')}>
                <ToggleGroupItem value="erase" aria-label="擦除工具" title="擦除工具">
                  <Eraser className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="pan" aria-label="拖动工具" title="拖动工具">
                  <Move className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
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
                className={tool === 'pan' ? 'cursor-move' : 'cursor-crosshair'}
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
