import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Download, Upload, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { Canvas as FabricCanvas, Rect, FabricText } from "fabric";

interface DraftsListProps {
  canvas: FabricCanvas | null;
  onLoadDraft: (draftData: string) => void;
  currentDraftId?: string;
  onDraftIdChange?: (draftId: string | undefined) => void;
  onActiveFrameIdChange?: (frameId: string | null) => void;
  onFrameCountChange?: (count: number) => void;
}

export const DraftsList = ({ 
  canvas, 
  onLoadDraft, 
  onDraftIdChange, 
  onActiveFrameIdChange, 
  onFrameCountChange 
}: DraftsListProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 导出当前画布为JSON文件
  const exportDraft = useCallback(() => {
    if (!canvas) {
      toast.error("画布未初始化");
      return;
    }

    try {
      const canvasData = (canvas as any).toJSON(['data', 'name']);
      const timestamp = Date.now();
      
      const exportData = {
        id: timestamp.toString(),
        timestamp,
        canvasData,
        exportedAt: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `storyboard-draft-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("草稿已导出为JSON文件");
    } catch (error) {
      console.error("导出草稿失败:", error);
      toast.error("导出草稿失败");
    }
  }, [canvas]);

  // 导入JSON文件
  const importDraft = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedData = JSON.parse(content);
        
        // 验证数据格式
        if (!importedData.canvasData) {
          toast.error("无效的草稿文件格式");
          return;
        }

        // 加载草稿
        const canvasDataStr = JSON.stringify(importedData.canvasData);
        onLoadDraft(canvasDataStr);
        onDraftIdChange?.(importedData.id);

        // 从草稿数据中提取分镜信息
        const objects = importedData.canvasData.objects || [];
        const frames = objects.filter((obj: any) => obj.name && obj.name.startsWith('storyboard-frame-'));
        const frameCount = frames.length;
        
        if (frameCount > 0) {
          const firstFrameId = frames[0].name.replace('storyboard-frame-', '');
          onActiveFrameIdChange?.(firstFrameId);
          onFrameCountChange?.(frameCount);
        }
        
        toast.success("草稿已导入");
      } catch (error) {
        console.error("导入草稿失败:", error);
        toast.error("导入草稿失败，请检查文件格式");
      }
    };

    reader.readAsText(file);
    
    // 重置input以允许重复导入同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onLoadDraft, onDraftIdChange, onActiveFrameIdChange, onFrameCountChange]);

  // 创建新草稿（清除所有缓存和画布）
  const createNewDraft = useCallback(() => {
    if (!canvas) {
      toast.error("画布未初始化");
      return;
    }
    
    // 清除所有localStorage缓存
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('editor-') || key.startsWith('canvas-'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`已清除 ${keysToRemove.length} 个缓存项`);
    } catch (error) {
      console.error("清除缓存失败:", error);
    }
    
    // 清空整个画布
    canvas.clear();
    
    // 重新创建默认第一个分镜
    const INFINITE_CANVAS_SIZE = 10000;
    const COLS = 5;
    const ROWS = 8;
    const DEFAULT_FRAME_WIDTH = 1024;
    const DEFAULT_FRAME_HEIGHT = 768;
    const SPACING = 50;
    
    const totalWidth = COLS * DEFAULT_FRAME_WIDTH + (COLS - 1) * SPACING;
    const totalHeight = ROWS * DEFAULT_FRAME_HEIGHT + (ROWS - 1) * SPACING;
    
    const START_X = (INFINITE_CANVAS_SIZE - totalWidth) / 2;
    const START_Y = (INFINITE_CANVAS_SIZE - totalHeight) / 2;
    
    const frameLeft = START_X;
    const frameTop = START_Y;

    // 创建背景方形
    const frame = new Rect({
      left: frameLeft,
      top: frameTop,
      width: DEFAULT_FRAME_WIDTH,
      height: DEFAULT_FRAME_HEIGHT,
      fill: "#ffffff",
      stroke: "#d1d5db",
      strokeWidth: 1,
      selectable: false,
      evented: true,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      hoverCursor: 'pointer',
      name: 'storyboard-frame-1',
    });
    (frame as any).data = { isFrameElement: true };

    canvas.add(frame);
    canvas.sendObjectToBack(frame);
    
    // 创建边框
    const frameBorder = new Rect({
      left: frameLeft,
      top: frameTop,
      width: DEFAULT_FRAME_WIDTH,
      height: DEFAULT_FRAME_HEIGHT,
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
      hoverCursor: 'default',
      name: 'storyboard-border-1',
      visible: true,
    });
    (frameBorder as any).data = { isFrameElement: true };
    
    canvas.add(frameBorder);
    
    // 创建编号
    const frameNumber = new FabricText('Shot-01', {
      left: frameLeft,
      top: frameTop - 20,
      fontSize: 14,
      fill: '#666666',
      selectable: false,
      evented: false,
      name: 'storyboard-number-1'
    });
    (frameNumber as any).data = { isFrameElement: true };
    
    canvas.add(frameNumber);
    
    canvas.discardActiveObject();
    canvas.renderAll();
    
    onDraftIdChange?.(undefined);
    onActiveFrameIdChange?.("1");
    onFrameCountChange?.(1);
    
    toast.success("已创建新草稿，所有缓存已清除");
  }, [canvas, onDraftIdChange, onActiveFrameIdChange, onFrameCountChange]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-2" />
          草稿
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>草稿管理</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            使用JSON文件管理您的草稿，无需云端存储或缓存。
          </p>
          
          <div className="flex flex-col gap-2">
            <Button onClick={exportDraft} className="w-full justify-start">
              <Download className="h-4 w-4 mr-2" />
              导出当前草稿为JSON文件
            </Button>
            
            <Button onClick={importDraft} variant="outline" className="w-full justify-start">
              <Upload className="h-4 w-4 mr-2" />
              从JSON文件导入草稿
            </Button>
            
            <Button onClick={createNewDraft} variant="secondary" className="w-full justify-start">
              <PlusCircle className="h-4 w-4 mr-2" />
              创建新草稿（清除所有缓存）
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileImport}
            className="hidden"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
