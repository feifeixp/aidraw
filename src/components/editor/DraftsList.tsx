import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Canvas as FabricCanvas } from "fabric";

interface Draft {
  id: string;
  timestamp: number;
  data: string;
  preview?: string;
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

  useEffect(() => {
    loadDrafts();
  }, [open]);

  const loadDrafts = () => {
    try {
      const draftsJson = localStorage.getItem('editor-drafts-list');
      if (draftsJson) {
        const loadedDrafts = JSON.parse(draftsJson);
        const sortedDrafts = loadedDrafts.sort((a: Draft, b: Draft) => b.timestamp - a.timestamp);
        setDrafts(sortedDrafts);
        console.log(`已加载 ${sortedDrafts.length} 个草稿`);
      } else {
        setDrafts([]);
      }
    } catch (error) {
      console.error("加载草稿列表失败:", error);
      setDrafts([]);
      toast.error("加载草稿列表失败");
    }
  };

  const saveDraft = (forceNew: boolean = false) => {
    if (!canvas) {
      toast.error("画布未初始化");
      return;
    }

    try {
      const canvasJson = JSON.stringify(canvas.toJSON());
      
      // 如果有当前草稿ID且不是强制创建新草稿，则更新现有草稿
      if (currentDraftId && !forceNew) {
        // 重新从 localStorage 加载最新数据，避免状态不一致
        const latestDraftsJson = localStorage.getItem('editor-drafts-list');
        const latestDrafts = latestDraftsJson ? JSON.parse(latestDraftsJson) : [];
        
        const updatedDrafts = latestDrafts.map((draft: Draft) => 
          draft.id === currentDraftId 
            ? { ...draft, timestamp: Date.now(), data: canvasJson }
            : draft
        ).sort((a: Draft, b: Draft) => b.timestamp - a.timestamp);
        
        localStorage.setItem('editor-drafts-list', JSON.stringify(updatedDrafts));
        
        // 验证保存是否成功
        const verified = localStorage.getItem('editor-drafts-list');
        if (verified) {
          setDrafts(updatedDrafts);
          console.log(`草稿已更新: ${currentDraftId}`);
          toast.success("草稿已更新");
        } else {
          throw new Error("保存验证失败");
        }
      } else {
        // 创建新草稿
        const newDraft: Draft = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          data: canvasJson,
        };

        // 重新从 localStorage 加载最新数据
        const latestDraftsJson = localStorage.getItem('editor-drafts-list');
        const latestDrafts = latestDraftsJson ? JSON.parse(latestDraftsJson) : [];
        const existingDrafts = latestDrafts.slice(0, 9); // Keep only last 10 drafts
        const updatedDrafts = [newDraft, ...existingDrafts];
        
        localStorage.setItem('editor-drafts-list', JSON.stringify(updatedDrafts));
        
        // 验证保存是否成功
        const verified = localStorage.getItem('editor-drafts-list');
        if (verified) {
          setDrafts(updatedDrafts);
          onDraftIdChange?.(newDraft.id);
          console.log(`新草稿已创建: ${newDraft.id}，共 ${updatedDrafts.length} 个草稿`);
          toast.success("新草稿已创建");
        } else {
          throw new Error("保存验证失败");
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

  const handleDeleteDraft = (draftId: string) => {
    try {
      const updatedDrafts = drafts.filter(d => d.id !== draftId);
      localStorage.setItem('editor-drafts-list', JSON.stringify(updatedDrafts));
      setDrafts(updatedDrafts);
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
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(draft.timestamp)}
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
