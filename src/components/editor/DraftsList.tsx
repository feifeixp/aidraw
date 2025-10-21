import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Clock, Trash2, Download, Cloud, HardDrive, HardDriveDownload } from "lucide-react";
import { toast } from "sonner";
import { Canvas as FabricCanvas, Rect, FabricText } from "fabric";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Progress } from "@/components/ui/progress";

interface Draft {
  id: string;
  timestamp: number;
  data: string;
  preview?: string;
  syncStatus: 'local' | 'cloud' | 'synced'; // local=仅本地, cloud=仅云端, synced=已同步
}

interface DraftsListProps {
  canvas: FabricCanvas | null;
  onLoadDraft: (draftData: string) => void;
  currentDraftId?: string;
  onDraftIdChange?: (draftId: string | undefined) => void;
  onActiveFrameIdChange?: (frameId: string | null) => void;
  onFrameCountChange?: (count: number) => void;
}

export const DraftsList = ({ canvas, onLoadDraft, currentDraftId, onDraftIdChange, onActiveFrameIdChange, onFrameCountChange }: DraftsListProps) => {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const [storageInfo, setStorageInfo] = useState({ used: 0, total: 0, percentage: 0 });

  useEffect(() => {
    loadDrafts();
    calculateStorageUsage();
  }, [open]);

  const calculateStorageUsage = () => {
    try {
      // 计算localStorage已使用大小
      let totalSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length + key.length;
        }
      }
      
      // localStorage大多数浏览器限制为5MB左右
      const estimatedQuota = 5 * 1024 * 1024; // 5MB in bytes
      const usedKB = Math.round(totalSize / 1024);
      const totalKB = Math.round(estimatedQuota / 1024);
      const percentage = Math.round((totalSize / estimatedQuota) * 100);
      
      setStorageInfo({
        used: usedKB,
        total: totalKB,
        percentage: Math.min(percentage, 100)
      });
      
      console.log(`localStorage使用情况: ${usedKB}KB / ${totalKB}KB (${percentage}%)`);
    } catch (error) {
      console.error("计算存储使用情况失败:", error);
    }
  };

  const loadDrafts = async () => {
    try {
      // 加载本地草稿
      const localDraftsMap = new Map<string, Draft>();
      const draftsJson = localStorage.getItem('editor-drafts-list');
      if (draftsJson) {
        const loadedDrafts = JSON.parse(draftsJson);
        loadedDrafts.forEach((d: any) => {
          localDraftsMap.set(d.id, {
            id: d.id,
            timestamp: d.timestamp,
            data: d.data,
            syncStatus: 'local' as const
          });
        });
      }

      // 如果用户已登录，加载云端草稿
      const cloudDraftsMap = new Map<string, Draft>();
      if (user) {
        const { data, error } = await supabase
          .from('canvas_drafts')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (!error && data) {
          data.forEach(d => {
            cloudDraftsMap.set(d.draft_id, {
              id: d.draft_id,
              timestamp: new Date(d.updated_at).getTime(),
              data: JSON.stringify(d.canvas_data),
              syncStatus: 'cloud' as const
            });
          });
        }
      }

      // 合并本地和云端草稿，判断同步状态
      const mergedDrafts = new Map<string, Draft>();
      
      // 先添加云端草稿
      cloudDraftsMap.forEach((draft, id) => {
        mergedDrafts.set(id, draft);
      });
      
      // 再处理本地草稿
      localDraftsMap.forEach((localDraft, id) => {
        if (cloudDraftsMap.has(id)) {
          // 本地和云端都有，标记为已同步
          mergedDrafts.set(id, {
            ...localDraft,
            syncStatus: 'synced'
          });
        } else {
          // 只有本地，标记为本地
          mergedDrafts.set(id, localDraft);
        }
      });

      const uniqueDrafts = Array.from(mergedDrafts.values())
        .sort((a, b) => b.timestamp - a.timestamp);

      setDrafts(uniqueDrafts);
      
      const localCount = Array.from(mergedDrafts.values()).filter(d => d.syncStatus === 'local').length;
      const cloudCount = Array.from(mergedDrafts.values()).filter(d => d.syncStatus === 'cloud').length;
      const syncedCount = Array.from(mergedDrafts.values()).filter(d => d.syncStatus === 'synced').length;
      
      console.log(`已加载草稿: ${localCount}个仅本地, ${cloudCount}个仅云端, ${syncedCount}个已同步`);
    } catch (error) {
      console.error("加载草稿列表失败:", error);
      setDrafts([]);
      toast.error("加载草稿列表失败");
    }
  };

  const saveDraft = async (forceNew: boolean = false) => {
    if (!canvas) {
      toast.error("画布未初始化");
      return;
    }

    try {
      const canvasData = (canvas as any).toJSON(['data', 'name']);
      const canvasJson = JSON.stringify(canvasData);
      const timestamp = Date.now();
      const draftId = currentDraftId && !forceNew ? currentDraftId : timestamp.toString();
      
      // 检查数据大小
      const dataSizeKB = Math.round(canvasJson.length / 1024);
      console.log(`草稿数据大小: ${dataSizeKB}KB`);
      
      let cloudSaved = false;
      let localSaved = false;
      let saveError: string | null = null;
      
      // 1. 如果用户已登录，尝试保存到云端
      if (user) {
        try {
          const { error } = await supabase
            .from('canvas_drafts')
            .upsert({
              user_id: user.id,
              draft_id: draftId,
              canvas_data: canvasData,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id,draft_id'
            });

          if (error) {
            console.error("云端保存失败:", error);
            saveError = `云端保存失败: ${error.message}`;
          } else {
            cloudSaved = true;
            console.log(`草稿已保存到云端: ${draftId} (${dataSizeKB}KB)`);
          }
        } catch (serverError: any) {
          console.error("云端保存异常:", serverError);
          saveError = `云端保存异常: ${serverError.message || '网络错误'}`;
        }
      }
      
      // 2. 尝试保存到本地（限制数量）
      try {
        const latestDraftsJson = localStorage.getItem('editor-drafts-list');
        const latestDrafts = latestDraftsJson ? JSON.parse(latestDraftsJson) : [];
        
        if (currentDraftId && !forceNew) {
          // 更新现有草稿
          const updatedDrafts = latestDrafts.map((draft: any) => 
            draft.id === currentDraftId 
              ? { id: draft.id, timestamp, data: canvasJson }
              : draft
          ).sort((a: any, b: any) => b.timestamp - a.timestamp)
          .slice(0, 5); // 保留最近5个
          
          localStorage.setItem('editor-drafts-list', JSON.stringify(updatedDrafts));
          localSaved = true;
        } else {
          // 创建新草稿
          const newDraft = {
            id: draftId,
            timestamp,
            data: canvasJson
          };
          // 保留最近4个旧草稿
          const existingDrafts = latestDrafts.slice(0, 4);
          const updatedDrafts = [newDraft, ...existingDrafts];
          
          localStorage.setItem('editor-drafts-list', JSON.stringify(updatedDrafts));
          localSaved = true;
          onDraftIdChange?.(newDraft.id);
        }
        console.log(`草稿已保存到本地: ${draftId} (${dataSizeKB}KB)`);
      } catch (localError: any) {
        // localStorage配额超出时的处理
        if (localError.name === 'QuotaExceededError') {
          console.error("localStorage配额超出，清理旧草稿后重试");
          saveError = saveError ? `${saveError}; 本地存储空间不足` : '本地存储空间不足';
          
          try {
            // 清理所有本地草稿
            localStorage.removeItem('editor-drafts-list');
            
            // 只保存当前草稿
            const newDraft = {
              id: draftId,
              timestamp,
              data: canvasJson
            };
            
            localStorage.setItem('editor-drafts-list', JSON.stringify([newDraft]));
            localSaved = true;
            onDraftIdChange?.(newDraft.id);
            console.log("已清理旧草稿并保存当前草稿");
          } catch (retryError) {
            console.error("清理后仍无法保存:", retryError);
            saveError = saveError ? `${saveError}; 草稿过大(${dataSizeKB}KB)无法保存` : `草稿过大(${dataSizeKB}KB)无法保存`;
          }
        } else {
          console.error("本地保存失败:", localError);
          saveError = saveError ? `${saveError}; 本地保存失败: ${localError.message}` : `本地保存失败: ${localError.message}`;
        }
      }
      
      // 3. 显示保存结果
      await loadDrafts();
      calculateStorageUsage(); // 更新存储使用情况
      
      if (cloudSaved && localSaved) {
        toast.success(`草稿已同步保存 (${dataSizeKB}KB)`);
      } else if (cloudSaved) {
        toast.success(`草稿已保存到云端 (${dataSizeKB}KB)`);
      } else if (localSaved) {
        toast.warning(`草稿仅保存到本地 (${dataSizeKB}KB)${saveError ? ` - ${saveError}` : ''}`);
      } else {
        toast.error(`草稿保存失败: ${saveError || '未知错误'}`);
      }
    } catch (error) {
      console.error("保存草稿失败:", error);
      toast.error("保存草稿失败，请重试");
    }
  };

  const createNewDraft = () => {
    if (!canvas) {
      toast.error("画布未初始化");
      return;
    }
    
    // 通知EditorCanvas即将清空画布
    window.dispatchEvent(new CustomEvent('beforeCanvasRestore'));
    
    // 清空所有画布内容（包括分镜）
    canvas.clear();
    
    // 重新创建默认第一个分镜（使用统一的网格布局规则）
    const INFINITE_CANVAS_SIZE = 10000;
    const COLS = 5; // 5列
    const ROWS = 8; // 8行
    const DEFAULT_FRAME_WIDTH = 1024;
    const DEFAULT_FRAME_HEIGHT = 768;
    const SPACING = 50; // 间距
    
    // 计算整个网格的尺寸
    const totalWidth = COLS * DEFAULT_FRAME_WIDTH + (COLS - 1) * SPACING;
    const totalHeight = ROWS * DEFAULT_FRAME_HEIGHT + (ROWS - 1) * SPACING;
    
    // 计算起始位置（居中）
    const START_X = (INFINITE_CANVAS_SIZE - totalWidth) / 2;
    const START_Y = (INFINITE_CANVAS_SIZE - totalHeight) / 2;
    
    // 第一个分镜在网格的(0,0)位置
    const frameLeft = START_X;
    const frameTop = START_Y;

    // 创建第一个分镜frame
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

    canvas.add(frame);
    canvas.sendObjectToBack(frame);
    
    // 创建第一个分镜的边界线
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
    
    canvas.add(frameBorder);
    
    // 创建第一个分镜的编号
    const frameNumber = new FabricText('Shot-01', {
      left: frameLeft,
      top: frameTop - 20,
      fontSize: 14,
      fill: '#666666',
      selectable: false,
      evented: false,
      name: 'storyboard-number-1'
    });
    
    canvas.add(frameNumber);
    
    canvas.discardActiveObject();
    canvas.renderAll();
    
    // 通知EditorCanvas画布已重新创建，需要更新refs
    window.dispatchEvent(new CustomEvent('canvasStateRestored'));
    
    onDraftIdChange?.(undefined);
    onActiveFrameIdChange?.("1");
    onFrameCountChange?.(1);
    setOpen(false);
    toast.success("已创建新草稿");
  };

  const handleLoadDraft = (draft: Draft) => {
    onLoadDraft(draft.data);
    onDraftIdChange?.(draft.id);
    
    // 从草稿数据中提取分镜信息
    try {
      const canvasData = JSON.parse(draft.data);
      const objects = canvasData.objects || [];
      
      // 找到所有分镜frame
      const frames = objects.filter((obj: any) => obj.name && obj.name.startsWith('storyboard-frame-'));
      const frameCount = frames.length;
      
      // 找到当前应该激活的分镜（优先使用第一个，或者保持当前的）
      if (frameCount > 0) {
        const firstFrameId = frames[0].name.replace('storyboard-frame-', '');
        onActiveFrameIdChange?.(firstFrameId);
        onFrameCountChange?.(frameCount);
      }
    } catch (error) {
      console.error("解析草稿分镜信息失败:", error);
    }
    
    setOpen(false);
    toast.success("草稿已加载");
  };

  const handleDeleteDraft = async (draftId: string) => {
    try {
      // 1. 从本地删除
      const updatedDrafts = drafts.filter(d => d.id !== draftId);
      localStorage.setItem('editor-drafts-list', JSON.stringify(updatedDrafts));
      setDrafts(updatedDrafts);
      
      // 2. 如果用户已登录，同时从服务器删除
      if (user) {
        const { error } = await supabase
          .from('canvas_drafts')
          .delete()
          .eq('user_id', user.id)
          .eq('draft_id', draftId);

        if (error) {
          console.error("服务器删除失败:", error);
        }
      }

      if (currentDraftId === draftId) {
        onDraftIdChange?.(undefined);
      }
      console.log(`草稿已删除: ${draftId}`);
      toast.success("草稿已删除");
      calculateStorageUsage(); // 更新存储使用情况
    } catch (error) {
      console.error("删除草稿失败:", error);
      toast.error("删除草稿失败");
    }
  };

  const exportDraft = (draft: Draft) => {
    try {
      const exportData = {
        id: draft.id,
        timestamp: draft.timestamp,
        canvasData: JSON.parse(draft.data),
        exportedAt: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `draft-${draft.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("草稿已导出");
    } catch (error) {
      console.error("导出草稿失败:", error);
      toast.error("导出草稿失败");
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-2" />
          草稿
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>草稿管理</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 存储使用情况 */}
          <div className="p-3 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm">
                <HardDriveDownload className="h-4 w-4" />
                <span className="font-medium">本地存储</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {storageInfo.used}KB / {storageInfo.total}KB
              </span>
            </div>
            <Progress 
              value={storageInfo.percentage} 
              className="h-2"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">
                {storageInfo.percentage >= 80 ? '⚠️ 存储空间不足，建议清理旧草稿' : '存储空间充足'}
              </span>
              <span className="text-xs font-medium">
                {storageInfo.percentage}%
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => saveDraft(false)} className="flex-1">
              {currentDraftId ? "保存当前草稿" : "保存为新草稿"}
            </Button>
            {currentDraftId && (
              <Button onClick={() => saveDraft(true)} variant="outline">
                另存为新草稿
              </Button>
            )}
          </div>
          
          <ScrollArea className="h-[400px]">
            {drafts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>还没有保存的草稿</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  onClick={createNewDraft}
                  className="flex items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="text-center">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">创建新草稿</p>
                    <p className="text-xs text-muted-foreground">开始新的编辑</p>
                  </div>
                </div>
                
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className={`flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors ${
                      draft.id === currentDraftId ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                  <div className="flex items-center gap-3 flex-1">
                      {draft.syncStatus === 'synced' ? (
                        <div className="relative">
                          <Cloud className="h-5 w-5 text-green-500" />
                          <HardDrive className="h-3 w-3 text-green-500 absolute -bottom-1 -right-1" />
                        </div>
                      ) : draft.syncStatus === 'cloud' ? (
                        <Cloud className="h-5 w-5 text-blue-500" />
                      ) : (
                        <HardDrive className="h-5 w-5 text-orange-500" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(draft.timestamp)}
                          <span className="text-xs">
                            {draft.syncStatus === 'synced' ? '(已同步)' : 
                             draft.syncStatus === 'cloud' ? '(仅云端)' : '(仅本地)'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLoadDraft(draft)}
                      >
                        加载
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => exportDraft(draft)}
                        title="导出为文件"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDraft(draft.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
