import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Eraser, Undo, Redo } from "lucide-react";
import { FabricImage } from "fabric";

interface ImagePixelEraserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageObject: FabricImage | null;
  onSave: (imageDataUrl: string) => void;
}

export const ImagePixelEraser = ({ open, onOpenChange, imageObject, onSave }: ImagePixelEraserProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [brushSize, setBrushSize] = useState(20);
  const [isErasing, setIsErasing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    if (!open || !canvasRef.current || !imageObject) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctxRef.current = ctx;

    // 获取图片元素
    const imgElement = imageObject.getElement() as HTMLImageElement;
    
    // 设置画布尺寸匹配图片
    canvas.width = imgElement.naturalWidth || imgElement.width;
    canvas.height = imgElement.naturalHeight || imgElement.height;

    // 绘制图片到画布
    ctx.drawImage(imgElement, 0, 0);

    // 保存初始状态到历史
    const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([initialState]);
    setHistoryIndex(0);
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
    setIsErasing(true);
    erase(e);
  };

  const stopErasing = () => {
    if (isErasing) {
      setIsErasing(false);
      saveToHistory();
    }
  };

  const erase = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isErasing && e.type !== 'mousedown') return;
    if (!canvasRef.current || !ctxRef.current) return;

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // 计算鼠标在画布上的实际位置
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eraser className="h-5 w-5" />
            像素擦除工具
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-auto">
          <div className="flex items-center gap-4">
            <div className="flex-1">
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
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={undo}
                disabled={historyIndex <= 0}
              >
                <Undo className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
              >
                <Redo className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="border rounded-lg overflow-auto max-h-[60vh] bg-checkered p-4 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-full cursor-crosshair"
              onMouseDown={startErasing}
              onMouseMove={erase}
              onMouseUp={stopErasing}
              onMouseLeave={stopErasing}
            />
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
