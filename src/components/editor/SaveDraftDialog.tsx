import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SaveDraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string) => Promise<void>;
  defaultTitle?: string;
}

export const SaveDraftDialog = ({ open, onOpenChange, onSave, defaultTitle }: SaveDraftDialogProps) => {
  const [title, setTitle] = useState(defaultTitle || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    
    setIsSaving(true);
    try {
      await onSave(title.trim());
      onOpenChange(false);
      setTitle("");
    } catch (error) {
      console.error("保存失败:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>保存草稿</DialogTitle>
          <DialogDescription>
            请为您的草稿命名，它将被永久保存到云端
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">草稿名称</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入草稿名称"
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim()) {
                  handleSave();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
          >
            {isSaving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};