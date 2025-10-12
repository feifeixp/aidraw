import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Clock, Trash2, Download, Cloud, HardDrive } from "lucide-react";
import { toast } from "sonner";
import { Canvas as FabricCanvas } from "fabric";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Draft {
  id: string;
  timestamp: number;
  data: string;
  preview?: string;
  source?: 'local' | 'server'; // 标记草稿来源
}

interface DraftsListProps {
  canvas: FabricCanvas | null;
  onLoadDraft: (draftData: string) => void;
  currentDraftId?: string;
  onDraftIdChange?: (draftId: string | undefined) => void;
}

export const DraftsList = ({ canvas, onLoadDraft, currentDraftId, onDraftIdChange }: DraftsListProps) => {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadDrafts();
  }, [open]);

  const loadDrafts = async () => {
    try {
      // 加载本地草稿
      const localDrafts: Draft[] = [];
      const draftsJson = localStorage.getItem('editor-drafts-list');
      if (draftsJson) {
        const loadedDrafts = JSON.parse(draftsJson);
        localDrafts.push(...loadedDrafts.map((d: Draft) => ({ ...d, source: 'local' as const })));
      }

      // 如果用户已登录，加载服务器草稿
      const serverDrafts: Draft[] = [];
      if (user) {
        const { data, error } = await supabase
          .from('canvas_drafts')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (!error && data) {
          serverDrafts.push(...data.map(d => ({
            id: d.draft_id,
            timestamp: new Date(d.updated_at).getTime(),
            data: JSON.stringify(d.canvas_data),
            source: 'server' as const
          })));
        }
      }

      // 合并并去重（服务器优先）
      const allDrafts = [...serverDrafts, ...localDrafts];
      const uniqueDrafts = Array.from(
        new Map(allDrafts.map(d => [d.id, d])).values()
      ).sort((a, b) => b.timestamp - a.timestamp);

      setDrafts(uniqueDrafts);
      console.log(`已加载 ${localDrafts.length} 个本地草稿, ${serverDrafts.length} 个云端草稿`);
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
      const canvasData = canvas.toJSON();
      const canvasJson = JSON.stringify(canvasData);
      const timestamp = Date.now();
      const draftId = currentDraftId && !forceNew ? currentDraftId : timestamp.toString();
      
      // 检查数据大小
      const dataSizeKB = Math.round(canvasJson.length / 1024);
      console.log(`草稿数据大小: ${dataSizeKB}KB`);
      
      // 1. 如果用户已登录，优先保存到服务器
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

          if (error) throw error;
          
          console.log(`草稿已保存到云端: ${draftId} (${dataSizeKB}KB)`);
          toast.success(`草稿已保存到云端 (${dataSizeKB}KB)`);
          
          // 云端保存成功后，只在本地保留最近2个草稿作为缓存
          try {
            const latestDraftsJson = localStorage.getItem('editor-drafts-list');
            const latestDrafts = latestDraftsJson ? JSON.parse(latestDraftsJson) : [];
            
            const newDraft: Draft = {
              id: draftId,
              timestamp,
              data: canvasJson,
              source: 'local'
            };
            
            // 只保留最新的1个本地草稿（当前这个）
            const updatedDrafts = [newDraft];
            localStorage.setItem('editor-drafts-list', JSON.stringify(updatedDrafts));
            console.log("本地缓存已更新（仅保留当前草稿）");
          } catch (localError: any) {
            // 本地缓存失败不影响主要功能
            console.warn("本地缓存更新失败:", localError);
          }
          
          await loadDrafts();
          onDraftIdChange?.(draftId);
          return;
        } catch (serverError) {
          console.error("云端保存失败，尝试本地保存:", serverError);
          toast.warning("云端保存失败，将保存到本地");
        }
      }
      
      // 2. 未登录或云端保存失败时，保存到本地（限制数量）
      try {
        const latestDraftsJson = localStorage.getItem('editor-drafts-list');
        const latestDrafts = latestDraftsJson ? JSON.parse(latestDraftsJson) : [];
        
        if (currentDraftId && !forceNew) {
          // 更新现有草稿
          const updatedDrafts = latestDrafts.map((draft: Draft) => 
            draft.id === currentDraftId 
              ? { ...draft, timestamp, data: canvasJson, source: 'local' }
              : draft
          ).sort((a: Draft, b: Draft) => b.timestamp - a.timestamp)
          .slice(0, 3); // 只保留最近3个
          
          localStorage.setItem('editor-drafts-list', JSON.stringify(updatedDrafts));
          setDrafts(updatedDrafts);
          toast.success(`已保存到本地 (${dataSizeKB}KB)`);
        } else {
          // 创建新草稿
          const newDraft: Draft = {
            id: draftId,
            timestamp,
            data: canvasJson,
            source: 'local'
          };
          // 只保留最近2个旧草稿
          const existingDrafts = latestDrafts.slice(0, 2);
          const updatedDrafts = [newDraft, ...existingDrafts];
          
          localStorage.setItem('editor-drafts-list', JSON.stringify(updatedDrafts));
          setDrafts(updatedDrafts);
          onDraftIdChange?.(newDraft.id);
          toast.success(`已保存到本地 (${dataSizeKB}KB)`);
        }
        console.log(`草稿已保存到本地: ${draftId} (${dataSizeKB}KB)`);
      } catch (localError: any) {
        // localStorage配额超出时的处理
        if (localError.name === 'QuotaExceededError') {
          console.error("localStorage配额超出，清理旧草稿后重试");
          
          // 清理所有本地草稿
          localStorage.removeItem('editor-drafts-list');
          
          // 只保存当前草稿
          const newDraft: Draft = {
            id: draftId,
            timestamp,
            data: canvasJson,
            source: 'local'
          };
          
          try {
            localStorage.setItem('editor-drafts-list', JSON.stringify([newDraft]));
            setDrafts([newDraft]);
            onDraftIdChange?.(newDraft.id);
            
            if (user) {
              toast.warning(`本地存储空间不足，已清理。草稿已保存到云端 (${dataSizeKB}KB)`);
            } else {
              toast.warning(`本地存储空间不足，已清理旧草稿。当前草稿已保存 (${dataSizeKB}KB)`);
            }
          } catch (retryError) {
            toast.error(`草稿过大(${dataSizeKB}KB)，无法保存到本地。${user ? '请检查云端是否保存成功。' : '请登录使用云端存储。'}`);
          }
        } else {
          throw localError;
        }
      }
    } catch (error) {
      console.error("保存草稿失败:", error);
      toast.error("保存草稿失败，请重试");
    }
  };

  const createNewDraft = () => {
    onDraftIdChange?.(undefined);
    toast.success("已切换到新草稿模式");
  };

  const handleLoadDraft = (draft: Draft) => {
    onLoadDraft(draft.data);
    onDraftIdChange?.(draft.id);
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
                      {draft.source === 'server' ? (
                        <Cloud className="h-5 w-5 text-blue-500" />
                      ) : (
                        <HardDrive className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(draft.timestamp)}
                          <span className="text-xs">
                            {draft.source === 'server' ? '(云端)' : '(本地)'}
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
