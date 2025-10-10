import { useEffect, useState } from "react";
import { Canvas as FabricCanvas, FabricImage } from "fabric";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Type, Bold, Italic, Underline, Square, Image, Upload, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ColorAdjustmentPanel } from "./ColorAdjustmentPanel";
interface PropertiesPanelProps {
  canvas: FabricCanvas | null;
  saveState: () => void;
}
export const PropertiesPanel = ({
  canvas,
  saveState
}: PropertiesPanelProps) => {
  const [selectedObject, setSelectedObject] = useState<any>(null);

  // Text properties
  const [textValue, setTextValue] = useState("");
  const [fontSize, setFontSize] = useState("20");
  const [fontFamily, setFontFamily] = useState("Arial");
  const [textColor, setTextColor] = useState("#000000");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  // Shape properties
  const [fillColor, setFillColor] = useState("#000000");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(0);

  // Image properties
  const [opacity, setOpacity] = useState(1);
  const [blendMode, setBlendMode] = useState("source-over");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  useEffect(() => {
    if (!canvas) return;
    const handleSelectionCreated = (e: any) => {
      const obj = e.selected?.[0];
      if (obj) {
        setSelectedObject(obj);
        updateProperties(obj);
      }
    };
    const handleSelectionUpdated = (e: any) => {
      const obj = e.selected?.[0];
      if (obj) {
        setSelectedObject(obj);
        updateProperties(obj);
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
  const updateProperties = (obj: any) => {
    // Common properties
    setOpacity(obj.opacity || 1);

    // Text properties
    if (obj.type === 'text') {
      setTextValue(obj.text || "");
      setFontSize(obj.fontSize?.toString() || "20");
      setFontFamily(obj.fontFamily || "Arial");
      setTextColor(obj.fill || "#000000");
      setIsBold(obj.fontWeight === 'bold');
      setIsItalic(obj.fontStyle === 'italic');
      setIsUnderline(obj.underline || false);
    }

    // Shape properties
    if (['rect', 'circle', 'polygon', 'path'].includes(obj.type)) {
      setFillColor(obj.fill || "#000000");
      setStrokeColor(obj.stroke || "#000000");
      setStrokeWidth(obj.strokeWidth || 0);
    }

    // Image properties
    if (obj.type === 'image') {
      setBlendMode((obj as any).globalCompositeOperation || "source-over");
    }
  };
  const updateText = () => {
    if (!selectedObject || !canvas) return;
    selectedObject.set({
      text: textValue
    });
    canvas.renderAll();
    saveState();
  };
  const updateFontSize = (value: string) => {
    if (!selectedObject || !canvas) return;
    setFontSize(value);
    selectedObject.set({
      fontSize: parseInt(value)
    });
    canvas.renderAll();
    saveState();
  };
  const updateFontFamily = (value: string) => {
    if (!selectedObject || !canvas) return;
    setFontFamily(value);
    selectedObject.set({
      fontFamily: value
    });
    canvas.renderAll();
    saveState();
  };
  const updateTextColor = (value: string) => {
    if (!selectedObject || !canvas) return;
    setTextColor(value);
    selectedObject.set({
      fill: value
    });
    canvas.renderAll();
    saveState();
  };
  const toggleBold = () => {
    if (!selectedObject || !canvas) return;
    const newBold = !isBold;
    setIsBold(newBold);
    selectedObject.set({
      fontWeight: newBold ? 'bold' : 'normal'
    });
    canvas.renderAll();
    saveState();
  };
  const toggleItalic = () => {
    if (!selectedObject || !canvas) return;
    const newItalic = !isItalic;
    setIsItalic(newItalic);
    selectedObject.set({
      fontStyle: newItalic ? 'italic' : 'normal'
    });
    canvas.renderAll();
    saveState();
  };
  const toggleUnderline = () => {
    if (!selectedObject || !canvas) return;
    const newUnderline = !isUnderline;
    setIsUnderline(newUnderline);
    selectedObject.set({
      underline: newUnderline
    });
    canvas.renderAll();
    saveState();
  };
  const updateOpacity = (value: number[]) => {
    if (!selectedObject || !canvas) return;
    const newOpacity = value[0];
    setOpacity(newOpacity);
    selectedObject.set({
      opacity: newOpacity
    });
    canvas.renderAll();
    saveState();
  };
  const updateFillColor = (value: string) => {
    if (!selectedObject || !canvas) return;
    setFillColor(value);
    selectedObject.set({
      fill: value
    });
    canvas.renderAll();
    saveState();
  };
  const updateStrokeColor = (value: string) => {
    if (!selectedObject || !canvas) return;
    setStrokeColor(value);
    selectedObject.set({
      stroke: value
    });
    canvas.renderAll();
    saveState();
  };
  const updateStrokeWidth = (value: string) => {
    if (!selectedObject || !canvas) return;
    const width = parseInt(value);
    setStrokeWidth(width);
    selectedObject.set({
      strokeWidth: width
    });
    canvas.renderAll();
    saveState();
  };
  const updateBlendMode = (value: string) => {
    if (!selectedObject || !canvas) return;
    setBlendMode(value);
    (selectedObject as any).globalCompositeOperation = value;
    canvas.renderAll();
    saveState();
  };
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canvas || !selectedObject) return;
    const reader = new FileReader();
    reader.onload = event => {
      const imageUrl = event.target?.result as string;
      FabricImage.fromURL(imageUrl, {
        crossOrigin: 'anonymous'
      }).then(img => {
        if (!img) return;

        // Copy properties from old image
        img.set({
          left: selectedObject.left,
          top: selectedObject.top,
          scaleX: selectedObject.scaleX,
          scaleY: selectedObject.scaleY,
          angle: selectedObject.angle,
          opacity: selectedObject.opacity
        });
        canvas.remove(selectedObject);
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        saveState();
        toast.success("图片已更新");
      });
    };
    reader.readAsDataURL(file);
  };
  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error("请输入提示词");
      return;
    }
    setIsGenerating(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('ai-generate-image', {
        body: {
          prompt: aiPrompt
        }
      });
      if (error) throw error;
      if (data?.imageUrl) {
        FabricImage.fromURL(data.imageUrl, {
          crossOrigin: 'anonymous'
        }).then(img => {
          if (!img || !canvas) return;
          if (selectedObject && selectedObject.type === 'image') {
            // Replace existing image
            img.set({
              left: selectedObject.left,
              top: selectedObject.top,
              scaleX: selectedObject.scaleX,
              scaleY: selectedObject.scaleY,
              angle: selectedObject.angle,
              opacity: selectedObject.opacity
            });
            canvas.remove(selectedObject);
          } else {
            // Add new image
            const canvasWidth = canvas.width || 1024;
            const canvasHeight = canvas.height || 768;
            const imgWidth = img.width || 1;
            const imgHeight = img.height || 1;
            const scale = Math.min(canvasWidth / imgWidth, canvasHeight / imgHeight, 0.5);
            img.scale(scale);
            img.set({
              left: (canvasWidth - imgWidth * scale) / 2,
              top: (canvasHeight - imgHeight * scale) / 2
            });
          }
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
          saveState();
          toast.success("图片已生成");
        });
      }
    } catch (error) {
      console.error('AI generation error:', error);
      toast.error("图片生成失败");
    } finally {
      setIsGenerating(false);
    }
  };
  if (!selectedObject) {
    return <div className="h-full flex items-center justify-center p-4 text-muted-foreground text-sm my-[15px] rounded-sm bg-slate-100">
        <div className="text-center">
          <Square className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>选择对象以编辑属性</p>
        </div>
      </div>;
  }
  const renderTextProperties = () => <>
      <div className="flex items-center gap-2 mb-4">
        <Type className="w-5 h-5" />
        <h3 className="font-medium">文本属性</h3>
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="text-content">文本内容</Label>
          <Input id="text-content" value={textValue} onChange={e => setTextValue(e.target.value)} onBlur={updateText} onKeyDown={e => e.key === 'Enter' && updateText()} className="mt-1" />
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
          <Input id="font-size" type="number" value={fontSize} onChange={e => updateFontSize(e.target.value)} min="8" max="200" className="mt-1" />
        </div>

        <div>
          <Label htmlFor="text-color">文本颜色</Label>
          <div className="flex gap-2 mt-1">
            <Input id="text-color" type="color" value={textColor} onChange={e => updateTextColor(e.target.value)} className="w-16 h-10 p-1" />
            <Input type="text" value={textColor} onChange={e => updateTextColor(e.target.value)} className="flex-1" />
          </div>
        </div>

        <div>
          <Label>文本样式</Label>
          <div className="flex gap-2 mt-1">
            <Button variant={isBold ? "default" : "outline"} size="icon" onClick={toggleBold} title="粗体">
              <Bold className="w-4 h-4" />
            </Button>
            <Button variant={isItalic ? "default" : "outline"} size="icon" onClick={toggleItalic} title="斜体">
              <Italic className="w-4 h-4" />
            </Button>
            <Button variant={isUnderline ? "default" : "outline"} size="icon" onClick={toggleUnderline} title="下划线">
              <Underline className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </>;
  const renderShapeProperties = () => <>
      <div className="flex items-center gap-2 mb-4">
        <Square className="w-5 h-5" />
        <h3 className="font-medium">图形属性</h3>
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="fill-color">填充颜色</Label>
          <div className="flex gap-2 mt-1">
            <Input id="fill-color" type="color" value={fillColor} onChange={e => updateFillColor(e.target.value)} className="w-16 h-10 p-1" />
            <Input type="text" value={fillColor} onChange={e => updateFillColor(e.target.value)} className="flex-1" />
          </div>
        </div>

        <div>
          <Label htmlFor="stroke-color">描边颜色</Label>
          <div className="flex gap-2 mt-1">
            <Input id="stroke-color" type="color" value={strokeColor} onChange={e => updateStrokeColor(e.target.value)} className="w-16 h-10 p-1" />
            <Input type="text" value={strokeColor} onChange={e => updateStrokeColor(e.target.value)} className="flex-1" />
          </div>
        </div>

        <div>
          <Label htmlFor="stroke-width">描边宽度</Label>
          <Input id="stroke-width" type="number" value={strokeWidth} onChange={e => updateStrokeWidth(e.target.value)} min="0" max="50" className="mt-1" />
        </div>
      </div>
    </>;
  const renderImageProperties = () => <>
      <div className="flex items-center gap-2 mb-4">
        <Image className="w-5 h-5" />
        <h3 className="font-medium">图片属性</h3>
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="image-upload">重新导入图片</Label>
          <div className="mt-1">
            <Input id="image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="cursor-pointer" />
          </div>
        </div>

        <div className="border-t pt-3">
          <Label htmlFor="ai-prompt">AI 生成图片</Label>
          <Textarea id="ai-prompt" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="描述你想要生成的图片..." className="mt-1" rows={3} />
          <Button onClick={handleAIGenerate} disabled={isGenerating} className="w-full mt-2">
            <Sparkles className="w-4 h-4 mr-2" />
            {isGenerating ? "生成中..." : "生成图片"}
          </Button>
        </div>

        <div>
          <Label htmlFor="blend-mode">混合模式</Label>
          <Select value={blendMode} onValueChange={updateBlendMode}>
            <SelectTrigger id="blend-mode" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="source-over">正常</SelectItem>
              <SelectItem value="multiply">正片叠底</SelectItem>
              <SelectItem value="screen">滤色</SelectItem>
              <SelectItem value="overlay">叠加</SelectItem>
              <SelectItem value="darken">变暗</SelectItem>
              <SelectItem value="lighten">变亮</SelectItem>
              <SelectItem value="color-dodge">颜色减淡</SelectItem>
              <SelectItem value="color-burn">颜色加深</SelectItem>
              <SelectItem value="hard-light">强光</SelectItem>
              <SelectItem value="soft-light">柔光</SelectItem>
              <SelectItem value="difference">差值</SelectItem>
              <SelectItem value="exclusion">排除</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <ColorAdjustmentPanel canvas={canvas} selectedObject={selectedObject} saveState={saveState} />
      </div>
    </>;
  return <div className="h-full overflow-auto p-4 space-y-4">
      {selectedObject.type === 'text' && renderTextProperties()}
      {['rect', 'circle', 'polygon', 'path'].includes(selectedObject.type) && renderShapeProperties()}
      {selectedObject.type === 'image' && renderImageProperties()}
      
      {/* Common properties for all objects */}
      <div className="border-t pt-3 space-y-3">
        <div>
          <Label htmlFor="opacity">透明度: {Math.round(opacity * 100)}%</Label>
          <Slider id="opacity" value={[opacity]} onValueChange={updateOpacity} min={0} max={1} step={0.01} className="mt-2" />
        </div>
      </div>
    </div>;
};