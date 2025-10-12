import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";

interface ImageMetadataEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (metadata: {
    element_type: string;
    element_name: string;
    element_style: string;
    element_description: string;
  }) => void;
  initialData?: {
    element_type?: string | null;
    element_name?: string | null;
    element_style?: string | null;
    element_description?: string | null;
  };
}

export const ImageMetadataEditDialog = ({
  open,
  onOpenChange,
  onSave,
  initialData
}: ImageMetadataEditDialogProps) => {
  const [elementType, setElementType] = useState(initialData?.element_type || "");
  const [elementName, setElementName] = useState(initialData?.element_name || "");
  const [elementStyle, setElementStyle] = useState(initialData?.element_style || "");
  const [elementDescription, setElementDescription] = useState(initialData?.element_description || "");

  useEffect(() => {
    if (open) {
      setElementType(initialData?.element_type || "");
      setElementName(initialData?.element_name || "");
      setElementStyle(initialData?.element_style || "");
      setElementDescription(initialData?.element_description || "");
    }
  }, [open, initialData]);

  const handleSave = () => {
    if (!elementType || !elementName) {
      return;
    }
    
    onSave({
      element_type: elementType,
      element_name: elementName,
      element_style: elementStyle,
      element_description: elementDescription
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>编辑图片信息</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="element-type">类型 *</Label>
            <Select value={elementType} onValueChange={setElementType}>
              <SelectTrigger id="element-type">
                <SelectValue placeholder="选择类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="character">角色</SelectItem>
                <SelectItem value="scene">场景</SelectItem>
                <SelectItem value="prop">道具</SelectItem>
                <SelectItem value="effect">特效</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="element-name">名称 *</Label>
            <Input
              id="element-name"
              value={elementName}
              onChange={(e) => setElementName(e.target.value)}
              placeholder="输入名称"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="element-style">风格</Label>
            <Input
              id="element-style"
              value={elementStyle}
              onChange={(e) => setElementStyle(e.target.value)}
              placeholder="例如：写实、卡通、水墨等"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="element-description">描述</Label>
            <Textarea
              id="element-description"
              value={elementDescription}
              onChange={(e) => setElementDescription(e.target.value)}
              placeholder="输入详细描述"
              rows={4}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={!elementType || !elementName}>
            保存
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
