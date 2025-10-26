import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface ExitConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveAndExit: () => void;
  onExitWithoutSave: () => void;
}

export const ExitConfirmDialog = ({ open, onOpenChange, onSaveAndExit, onExitWithoutSave }: ExitConfirmDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>保存更改？</AlertDialogTitle>
          <AlertDialogDescription>
            您有未保存的更改。是否要保存到云端？
            <br />
            <span className="text-sm text-muted-foreground mt-2 block">
              注意：未确认保存的临时草稿仅保留最新5份
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onExitWithoutSave}>
            不保存
          </AlertDialogCancel>
          <AlertDialogAction onClick={onSaveAndExit}>
            保存并退出
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};