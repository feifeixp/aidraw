import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Trash2, FolderOpen, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DraftsManagerDialogProps {
  onLoadDraft: (draftId: string, draftData: string) => void;
  customTrigger?: React.ReactNode;
}

export const DraftsManagerDialog = ({ onLoadDraft, customTrigger }: DraftsManagerDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  // 查询草稿列表
  const { data: drafts, isLoading } = useQuery({
    queryKey: ['editor-drafts', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('未登录');
      
      const { data, error } = await supabase
        .from('editor_drafts')
        .select('*')
        .order('last_saved_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  // 加载草稿
  const handleLoadDraft = async (draftId: string, filePath: string) => {
    try {
      // 下载草稿文件
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('editor-drafts')
        .download(filePath);
      
      if (downloadError) throw downloadError;
      
      const jsonStr = await fileData.text();
      onLoadDraft(draftId, jsonStr);
      setOpen(false);
      toast.success('草稿加载成功');
    } catch (error) {
      console.error('加载草稿失败:', error);
      toast.error('加载草稿失败');
    }
  };

  // 删除草稿
  const deleteMutation = useMutation({
    mutationFn: async ({ draftId, filePath }: { draftId: string; filePath: string }) => {
      // 删除文件
      const { error: storageError } = await supabase.storage
        .from('editor-drafts')
        .remove([filePath]);
      
      if (storageError) throw storageError;
      
      // 删除记录
      const { error: dbError } = await supabase
        .from('editor_drafts')
        .delete()
        .eq('id', draftId);
      
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editor-drafts', user?.id] });
      toast.success('草稿已删除');
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      console.error('删除草稿失败:', error);
      toast.error('删除草稿失败');
    }
  });

  const handleDeleteClick = (draftId: string, filePath: string) => {
    setSelectedDraftId(draftId);
    setSelectedFilePath(filePath);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedDraftId && selectedFilePath) {
      deleteMutation.mutate({ draftId: selectedDraftId, filePath: selectedFilePath });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {customTrigger || (
            <Button variant="outline" size="sm">
              <FolderOpen className="h-4 w-4 mr-2" />
              我的草稿
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>我的云端草稿</DialogTitle>
          </DialogHeader>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">加载中...</span>
            </div>
          ) : !drafts || drafts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>还没有保存的草稿</p>
              <p className="text-sm mt-2">使用 Ctrl+S 或等待自动保存来创建草稿</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{draft.title}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(draft.last_saved_at), {
                            addSuffix: true,
                            locale: zhCN
                          })}
                        </span>
                        {draft.frame_count && (
                          <span>{draft.frame_count} 个分镜</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleLoadDraft(draft.id, draft.file_path)}
                      >
                        加载
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteClick(draft.id, draft.file_path)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除草稿？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销，草稿将从云端永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
