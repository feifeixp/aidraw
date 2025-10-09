import { useEffect, useState } from "react";
import { Canvas as FabricCanvas, Text as FabricText } from "fabric";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Type, Bold, Italic, Underline } from "lucide-react";

interface PropertiesPanelProps {
  canvas: FabricCanvas | null;
  saveState: () => void;
}

export const PropertiesPanel = ({ canvas, saveState }: PropertiesPanelProps) => {
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [textValue, setTextValue] = useState("");
  const [fontSize, setFontSize] = useState("20");
  const [fontFamily, setFontFamily] = useState("Arial");
  const [textColor, setTextColor] = useState("#000000");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  useEffect(() => {
    if (!canvas) return;

    const handleSelectionCreated = (e: any) => {
      const obj = e.selected?.[0];
      if (obj && obj.type === 'text') {
        setSelectedObject(obj);
        updateTextProperties(obj);
      }
    };

    const handleSelectionUpdated = (e: any) => {
      const obj = e.selected?.[0];
      if (obj && obj.type === 'text') {
        setSelectedObject(obj);
        updateTextProperties(obj);
      }
    };

    const handleSelectionCleared = () => {
      setSelectedObject(null);
    };

    canvas.on('selection:created', handleSelectionCreated);
    canvas.on('selection:updated', handleSelectionUpdated);
    canvas.on('selection:cleared', handleSelectionCleared);

    return () => {
      canvas.off('selection:created', handleSelectionCreated);
      canvas.off('selection:updated', handleSelectionUpdated);
      canvas.off('selection:cleared', handleSelectionCleared);
    };
  }, [canvas]);

  const updateTextProperties = (obj: any) => {
    setTextValue(obj.text || "");
    setFontSize(obj.fontSize?.toString() || "20");
    setFontFamily(obj.fontFamily || "Arial");
    setTextColor(obj.fill || "#000000");
    setIsBold(obj.fontWeight === 'bold');
    setIsItalic(obj.fontStyle === 'italic');
    setIsUnderline(obj.underline || false);
  };

  const updateText = () => {
    if (!selectedObject || !canvas) return;
    selectedObject.set({ text: textValue });
    canvas.renderAll();
    saveState();
  };

  const updateFontSize = (value: string) => {
    if (!selectedObject || !canvas) return;
    setFontSize(value);
    selectedObject.set({ fontSize: parseInt(value) });
    canvas.renderAll();
    saveState();
  };

  const updateFontFamily = (value: string) => {
    if (!selectedObject || !canvas) return;
    setFontFamily(value);
    selectedObject.set({ fontFamily: value });
    canvas.renderAll();
    saveState();
  };

  const updateTextColor = (value: string) => {
    if (!selectedObject || !canvas) return;
    setTextColor(value);
    selectedObject.set({ fill: value });
    canvas.renderAll();
    saveState();
  };

  const toggleBold = () => {
    if (!selectedObject || !canvas) return;
    const newBold = !isBold;
    setIsBold(newBold);
    selectedObject.set({ fontWeight: newBold ? 'bold' : 'normal' });
    canvas.renderAll();
    saveState();
  };

  const toggleItalic = () => {
    if (!selectedObject || !canvas) return;
    const newItalic = !isItalic;
    setIsItalic(newItalic);
    selectedObject.set({ fontStyle: newItalic ? 'italic' : 'normal' });
    canvas.renderAll();
    saveState();
  };

  const toggleUnderline = () => {
    if (!selectedObject || !canvas) return;
    const newUnderline = !isUnderline;
    setIsUnderline(newUnderline);
    selectedObject.set({ underline: newUnderline });
    canvas.renderAll();
    saveState();
  };

  if (!selectedObject || selectedObject.type !== 'text') {
    return (
      <div className="h-full flex items-center justify-center p-4 text-muted-foreground text-sm">
        <div className="text-center">
          <Type className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>选择文本对象以编辑属性</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Type className="w-5 h-5" />
        <h3 className="font-medium">文本属性</h3>
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="text-content">文本内容</Label>
          <Input
            id="text-content"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onBlur={updateText}
            onKeyDown={(e) => e.key === 'Enter' && updateText()}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="font-family">字体</Label>
          <Select value={fontFamily} onValueChange={updateFontFamily}>
            <SelectTrigger id="font-family" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Arial">Arial</SelectItem>
              <SelectItem value="Helvetica">Helvetica</SelectItem>
              <SelectItem value="Times New Roman">Times New Roman</SelectItem>
              <SelectItem value="Courier New">Courier New</SelectItem>
              <SelectItem value="Georgia">Georgia</SelectItem>
              <SelectItem value="Verdana">Verdana</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="font-size">字体大小</Label>
          <Input
            id="font-size"
            type="number"
            value={fontSize}
            onChange={(e) => updateFontSize(e.target.value)}
            min="8"
            max="200"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="text-color">文本颜色</Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="text-color"
              type="color"
              value={textColor}
              onChange={(e) => updateTextColor(e.target.value)}
              className="w-16 h-10 p-1"
            />
            <Input
              type="text"
              value={textColor}
              onChange={(e) => updateTextColor(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>

        <div>
          <Label>文本样式</Label>
          <div className="flex gap-2 mt-1">
            <Button
              variant={isBold ? "default" : "outline"}
              size="icon"
              onClick={toggleBold}
              title="粗体"
            >
              <Bold className="w-4 h-4" />
            </Button>
            <Button
              variant={isItalic ? "default" : "outline"}
              size="icon"
              onClick={toggleItalic}
              title="斜体"
            >
              <Italic className="w-4 h-4" />
            </Button>
            <Button
              variant={isUnderline ? "default" : "outline"}
              size="icon"
              onClick={toggleUnderline}
              title="下划线"
            >
              <Underline className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
