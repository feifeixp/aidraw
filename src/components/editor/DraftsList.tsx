import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Upload, PlusCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { Canvas as FabricCanvas } from "fabric";

interface DraftsListProps {
  canvas: FabricCanvas | null;
  onLoadDraft: (draftData: string) => void;
  currentDraftId?: string;
  onDraftIdChange?: (draftId: string | undefined) => void;
  onActiveFrameIdChange?: (frameId: string | null) => void;
  onFrameCountChange?: (count: number) => void;
  onRequestInitialSetup?: () => void;
}

export const DraftsList = ({ 
  canvas, 
  onLoadDraft, 
  onDraftIdChange, 
  onActiveFrameIdChange, 
  onFrameCountChange,
  onRequestInitialSetup
}: DraftsListProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 导出当前画布为JSON文件
  const exportDraft = useCallback(() => {
    if (!canvas) {
      toast.error("画布未初始化");
      return;
    }

    try {
      // 获取画布上所有对象用于手动修复 data 属性
      const allObjects = canvas.getObjects();
      const canvasData = (canvas as any).toJSON(['data', 'name']);
      
      // 🔧 手动修复 data 和 name 属性（Fabric.js v6 序列化问题）
      if (canvasData.objects && canvasData.objects.length > 0) {
        canvasData.objects.forEach((serializedObj: any, index: number) => {
          const canvasObj = allObjects[index];
          if (canvasObj) {
            serializedObj.data = (canvasObj as any).data || {};
            serializedObj.name = (canvasObj as any).name || '';
          }
        });
      }
      
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

  // 执行清空画布的核心逻辑
  const executeClearCanvas = useCallback(() => {
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
    
    // 触发初始化设置窗口
    if (onRequestInitialSetup) {
      onRequestInitialSetup();
    }
    
    onDraftIdChange?.(undefined);
    onActiveFrameIdChange?.("1");
    onFrameCountChange?.(0);
    
    toast.success("已创建新草稿，请进行初始化设置");
  }, [canvas, onDraftIdChange, onActiveFrameIdChange, onFrameCountChange, onRequestInitialSetup]);

  // 保存并新建
  const handleSaveAndNew = useCallback(() => {
    exportDraft();
    setShowSaveDialog(false);
    executeClearCanvas();
  }, [exportDraft, executeClearCanvas]);

  // 不保存直接新建
  const handleNewWithoutSave = useCallback(() => {
    setShowSaveDialog(false);
    executeClearCanvas();
  }, [executeClearCanvas]);

  // 创建新草稿（先弹出保存提醒）
  const createNewDraft = useCallback(() => {
    if (!canvas) {
      toast.error("画布未初始化");
      return;
    }
    
    // 检查画布是否有内容
    const hasContent = canvas.getObjects().length > 0;
    if (hasContent) {
      setShowSaveDialog(true);
    } else {
      executeClearCanvas();
    }
  }, [canvas, executeClearCanvas]);

  const [showSaveDialog, setShowSaveDialog] = useState(false);

  return (
    <>
      {/* 新建草稿按钮 - 图标 */}
      <Button variant="outline" size="icon" onClick={createNewDraft} title="新建草稿">
        <PlusCircle className="h-4 w-4" />
      </Button>

      {/* 导入草稿按钮 - 图标 */}
      <Button variant="outline" size="icon" onClick={importDraft} title="导入草稿">
        <Upload className="h-4 w-4" />
      </Button>

      {/* 本地保存按钮 - 图标 */}
      <Button variant="outline" size="icon" onClick={exportDraft} title="本地保存">
        <Save className="h-4 w-4" />
      </Button>

      {/* 保存提醒对话框 */}
      <AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>是否保存当前草稿？</AlertDialogTitle>
            <AlertDialogDescription>
              创建新草稿前，建议先保存当前工作。草稿将以JSON文件保存到本地。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleNewWithoutSave}>
              不保存
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveAndNew}>
              <Save className="h-4 w-4 mr-2" />
              保存并新建
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileImport}
        className="hidden"
      />
    </>
  );
};
