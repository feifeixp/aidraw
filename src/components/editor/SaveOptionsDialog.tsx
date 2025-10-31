import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Cloud } from "lucide-react";

interface SaveOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveLocal: () => void;
  onSaveCloud: () => void;
}

export const SaveOptionsDialog = ({ 
  open, 
  onOpenChange, 
  onSaveLocal, 
  onSaveCloud 
}: SaveOptionsDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>选择保存方式</DialogTitle>
          <DialogDescription>
            您可以将草稿保存到本地文件或云端存储
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col gap-2"
            onClick={() => {
              onSaveLocal();
              onOpenChange(false);
            }}
          >
            <Download className="h-6 w-6" />
            <div className="text-center">
              <div className="font-semibold">保存到本地</div>
              <div className="text-xs text-muted-foreground">下载为JSON文件</div>
            </div>
          </Button>
          
          <Button
            className="h-auto py-6 flex flex-col gap-2"
            onClick={() => {
              onSaveCloud();
              onOpenChange(false);
            }}
          >
            <Cloud className="h-6 w-6" />
            <div className="text-center">
              <div className="font-semibold">保存到云端</div>
              <div className="text-xs opacity-90">启用自动保存功能</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
