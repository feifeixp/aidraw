import { useEffect, useState } from "react";
import { Canvas as FabricCanvas, FabricImage } from "fabric";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Type, Bold, Italic, Underline, Square, Image, Upload, Sparkles, Users, PersonStanding, RotateCw, Sun, Moon, CloudRain, CloudSnow, CloudFog, Sunrise, Sunset, Droplets, Cloud, Palette, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ColorAdjustmentPanel } from "./ColorAdjustmentPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
interface PropertiesPanelProps {
  canvas: FabricCanvas | null;
  saveState: () => void;
  isTaskProcessing?: boolean;
  startTask?: (taskName: string) => string;
  completeTask?: (taskId: string) => void;
  cancelTask?: () => void;
}
export const PropertiesPanel = ({
  canvas,
  saveState,
  isTaskProcessing = false,
  startTask,
  completeTask,
  cancelTask
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
  const [elementType, setElementType] = useState<string>("character");

  // Adjustment dialogs
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [showSubjectAngleDialog, setShowSubjectAngleDialog] = useState(false);
  const [showPoseDialog, setShowPoseDialog] = useState(false);
  const [customPose, setCustomPose] = useState("");
  const [poseReferenceImage, setPoseReferenceImage] = useState<string | null>(null);
  const [presetReferences, setPresetReferences] = useState<Array<{
    id: string;
    image_url: string;
    description: string | null;
    tags: string[];
  }>>([]);
  
  // Element type display names
  const getElementTypeName = (type: string) => {
    const typeMap: Record<string, string> = {
      character: "角色",
      scene: "场景",
      prop: "道具",
      effect: "特效"
    };
    return typeMap[type] || type;
  };
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

  // Load preset pose references
  useEffect(() => {
    const loadPresetReferences = async () => {
      try {
        const { data, error } = await supabase
          .from("pose_reference_presets")
          .select("id, image_url, description, tags")
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setPresetReferences(data || []);
      } catch (error) {
        console.error("Failed to load preset references:", error);
      }
    };

    if (showPoseDialog) {
      loadPresetReferences();
    }
  }, [showPoseDialog]);

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
      setElementType(obj.data?.elementType || "character");
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
  const handleAIEdit = async () => {
    if (!aiPrompt.trim()) {
      toast.error("请输入修改指令");
      return;
    }

    if (!selectedObject || selectedObject.type !== 'image') {
      toast.error("请先选择一张图片");
      return;
    }

    setIsGenerating(true);
    try {
      // Export the selected image as data URL
      const imageDataURL = selectedObject.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 1
      });

      const {
        data,
        error
      } = await supabase.functions.invoke('ai-edit-image', {
        body: {
          imageUrl: imageDataURL,
          instruction: aiPrompt
        }
      });

      if (error) throw error;

      if (data?.imageUrl) {
        FabricImage.fromURL(data.imageUrl, {
          crossOrigin: 'anonymous'
        }).then(img => {
          if (!img || !canvas) return;

          // Replace the existing image with edited one
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
          toast.success("图片修改完成");
        });
      }
    } catch (error) {
      console.error('AI edit error:', error);
      toast.error("图片修改失败");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAdjustCamera = async (setting: string, description: string) => {
    if (!selectedObject || selectedObject.type !== 'image') {
      toast.error("请先选择一张图片");
      return;
    }
    
    const elementType = (selectedObject as any).data?.elementType;
    if (elementType !== 'scene') {
      toast.error("场景调整仅针对场景元素");
      return;
    }
    
    if (isTaskProcessing || !startTask || !completeTask || !cancelTask) return;
    
    setShowCameraDialog(false);
    const taskId = startTask(`正在调整镜头：${description}`);
    
    try {
      const imageDataURL = (selectedObject as any).toDataURL({
        format: 'png',
        quality: 1
      });
      
      const instruction = `Transform this image to use ${setting}. Keep the subject's appearance, clothing, and style exactly the same, only change the camera framing or angle as specified.`;
      
      const { data: aiData, error: aiError } = await supabase.functions.invoke('ai-edit-image', {
        body: {
          imageUrl: imageDataURL,
          instruction
        }
      });
      
      if (aiError) throw aiError;
      
      if (aiData?.imageUrl && canvas) {
        const img = await FabricImage.fromURL(aiData.imageUrl, {
          crossOrigin: 'anonymous'
        });
        
        img.set({
          left: selectedObject.left,
          top: selectedObject.top,
          scaleX: selectedObject.scaleX,
          scaleY: selectedObject.scaleY,
          data: { elementType: 'scene' }
        });
        
        canvas.remove(selectedObject);
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        saveState();
        completeTask(taskId);
        toast.success("镜头调整完成");
      } else {
        throw new Error('No image returned from AI');
      }
    } catch (error) {
      console.error("Adjust camera error:", error);
      toast.error("镜头调整失败");
      cancelTask();
    }
  };

  const handleAdjustSubjectAngle = async (angle: string, description: string) => {
    if (!selectedObject || selectedObject.type !== 'image') {
      toast.error("请先选择一张图片");
      return;
    }
    
    const elementType = (selectedObject as any).data?.elementType;
    if (elementType !== 'character' && elementType !== 'prop') {
      toast.error("主体调整仅针对角色和道具元素");
      return;
    }
    
    if (isTaskProcessing || !startTask || !completeTask || !cancelTask) return;
    
    setShowSubjectAngleDialog(false);
    const taskId = startTask(`正在调整为${description}`);
    
    try {
      const imageDataURL = (selectedObject as any).toDataURL({
        format: 'png',
        quality: 1
      });
      
      const instruction = `Rotate this subject to show them from ${angle}. Keep the subject's appearance, clothing, style, pose, and background exactly the same, only rotate the subject's body orientation to face ${angle}.`;
      
      const { data: aiData, error: aiError } = await supabase.functions.invoke('ai-edit-image', {
        body: {
          imageUrl: imageDataURL,
          instruction
        }
      });
      
      if (aiError) throw aiError;
      
      if (aiData?.imageUrl && canvas) {
        const img = await FabricImage.fromURL(aiData.imageUrl, {
          crossOrigin: 'anonymous'
        });
        
        img.set({
          left: selectedObject.left,
          top: selectedObject.top,
          scaleX: selectedObject.scaleX,
          scaleY: selectedObject.scaleY,
          data: { elementType }
        });
        
        canvas.remove(selectedObject);
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        saveState();
        completeTask(taskId);
        toast.success("主体角度调整完成");
      } else {
        throw new Error('No image returned from AI');
      }
    } catch (error) {
      console.error("Adjust subject angle error:", error);
      toast.error("主体角度调整失败");
      cancelTask();
    }
  };

  const handleAdjustPose = async (pose: string, referenceImage?: string) => {
    if (!selectedObject || selectedObject.type !== 'image') {
      toast.error("请先选择一张图片");
      return;
    }
    
    const elementType = (selectedObject as any).data?.elementType;
    if (elementType !== 'character') {
      toast.error("调整动作仅针对角色元素");
      return;
    }
    
    if (isTaskProcessing || !startTask || !completeTask || !cancelTask) return;
    
    setShowPoseDialog(false);
    const taskId = startTask("正在调整姿势");
    
    try {
      const imageDataURL = (selectedObject as any).toDataURL({
        format: 'png',
        quality: 1
      });
      
      const poseDescription = (pose + ' ' + (customPose || '')).toLowerCase();
      const isBackOrSide = poseDescription.includes('背面') || 
                          poseDescription.includes('侧面') || 
                          poseDescription.includes('back') || 
                          poseDescription.includes('side');
      
      let instruction = `Change this character's pose to: ${pose}. Keep the character's appearance, clothing, style, and background exactly the same, only change the body pose and position.`;
      
      if (referenceImage) {
        if (isBackOrSide) {
          instruction = `Change this character's pose to match the reference image. Keep the character's appearance, clothing, style, and background exactly the same, only change the body pose and position to match the reference.`;
        } else {
          instruction = `Change this character's pose and facial expression to match the reference image. Copy both the body pose AND the facial expression (including emotion, eyes, mouth, eyebrows) from the reference image. Keep the character's appearance, clothing, style, and background exactly the same, only change the body pose, position, and facial expression to match the reference.`;
        }
      }
      
      const requestBody: any = {
        imageUrl: imageDataURL,
        instruction
      };
      
      if (referenceImage) {
        requestBody.referenceImageUrl = referenceImage;
      }
      
      const { data: aiData, error: aiError } = await supabase.functions.invoke('ai-edit-image', {
        body: requestBody
      });
      
      if (aiError) throw aiError;
      
      if (aiData?.imageUrl && canvas) {
        const img = await FabricImage.fromURL(aiData.imageUrl, {
          crossOrigin: 'anonymous'
        });
        
        img.set({
          left: selectedObject.left,
          top: selectedObject.top,
          scaleX: selectedObject.scaleX,
          scaleY: selectedObject.scaleY,
          data: { elementType: 'character' }
        });
        
        canvas.remove(selectedObject);
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        saveState();
        completeTask(taskId);
        toast.success("姿势调整完成");
        setPoseReferenceImage(null);
        setCustomPose("");
      } else {
        throw new Error('No image returned from AI');
      }
    } catch (error) {
      console.error("Adjust pose error:", error);
      toast.error("姿势调整失败");
      cancelTask();
    }
  };

  const handleUploadPoseReference = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imageUrl = event.target?.result as string;
          setPoseReferenceImage(imageUrl);
          toast.success("姿势参考线稿已上传");
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleCustomPoseSubmit = () => {
    if (!customPose.trim()) {
      toast.error("请输入自定义动作描述");
      return;
    }
    handleAdjustPose(customPose, poseReferenceImage || undefined);
  };

  if (!selectedObject) {
    return <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
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
  const renderImageProperties = () => {
    const canAdjustScene = elementType === 'scene';
    const canAdjustSubject = elementType === 'character' || elementType === 'prop';
    const canAdjustPose = elementType === 'character';
    
    return <>
      <div className="flex items-center gap-2 mb-4">
        <Image className="w-5 h-5" />
        <h3 className="font-medium">图片属性</h3>
      </div>

      <div className="space-y-3">
        <div className="p-3 bg-muted rounded-lg">
          <Label className="text-sm text-muted-foreground">元素类型</Label>
          <p className="text-base font-medium mt-1">{getElementTypeName(elementType)}</p>
        </div>

        <div>
          <Label htmlFor="image-upload">重新导入图片</Label>
          <div className="mt-1">
            <Input id="image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="cursor-pointer" />
          </div>
        </div>

        <div className="border-t pt-3">
          <Label htmlFor="ai-prompt">AI 修改图片</Label>
          <Textarea id="ai-prompt" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="描述你想要如何修改这张图片..." className="mt-1" rows={3} />
          <Button onClick={handleAIEdit} disabled={isGenerating} className="w-full mt-2">
            <Sparkles className="w-4 h-4 mr-2" />
            {isGenerating ? "修改中..." : "修改图片"}
          </Button>
        </div>

        {canAdjustScene && (
          <div className="border-t pt-3">
            <Button variant="outline" className="w-full" onClick={() => setShowCameraDialog(true)} disabled={isTaskProcessing}>
              <RotateCw className="w-4 h-4 mr-2" />
              场景调整
            </Button>
          </div>
        )}

        {canAdjustSubject && (
          <div className="border-t pt-3">
            <Button variant="outline" className="w-full" onClick={() => setShowSubjectAngleDialog(true)} disabled={isTaskProcessing}>
              <PersonStanding className="w-4 w-4 mr-2" />
              主体角度
            </Button>
          </div>
        )}

        {canAdjustPose && (
          <div className="border-t pt-3">
            <Button variant="outline" className="w-full" onClick={() => setShowPoseDialog(true)} disabled={isTaskProcessing}>
              <Users className="w-4 h-4 mr-2" />
              调整动作
            </Button>
          </div>
        )}

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
  };
  return <div className="space-y-4">
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

      {/* Camera Dialog - Scene Adjustment */}
      <Dialog open={showCameraDialog} onOpenChange={setShowCameraDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>场景调整</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="distance" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="distance">拍摄距离</TabsTrigger>
              <TabsTrigger value="angle">镜头角度</TabsTrigger>
              <TabsTrigger value="environment">AI环境</TabsTrigger>
            </TabsList>
            <TabsContent value="distance" className="space-y-2">
              <Button onClick={() => handleAdjustCamera("a full shot showing the entire subject from head to toe", "全景镜头")} className="w-full">全景镜头 (Full Shot)</Button>
              <Button onClick={() => handleAdjustCamera("a medium shot from waist up", "中景镜头")} className="w-full">中景镜头 (Medium Shot)</Button>
              <Button onClick={() => handleAdjustCamera("a close shot showing head and shoulders", "近景镜头")} className="w-full">近景镜头 (Close Shot)</Button>
              <Button onClick={() => handleAdjustCamera("a wide angle shot with ultra wide lens", "大广角")} className="w-full">大广角 (Wide Angle)</Button>
              <Button onClick={() => handleAdjustCamera("pull back the camera to increase distance from subject", "拉远")} className="w-full">拉远 (Pull Back)</Button>
              <Button onClick={() => handleAdjustCamera("push in the camera closer to the subject", "推进")} className="w-full">推进 (Push In)</Button>
            </TabsContent>
            <TabsContent value="angle" className="space-y-2">
              <Button onClick={() => handleAdjustCamera("an up shot from a low angle looking upward", "仰视镜头")} className="w-full">仰视镜头 (Up Shot)</Button>
              <Button onClick={() => handleAdjustCamera("a down shot from a high angle looking downward", "俯视镜头")} className="w-full">俯视镜头 (Down Shot)</Button>
              <Button onClick={() => handleAdjustCamera("an eye level shot at the subject's eye level", "平视镜头")} className="w-full">平视镜头 (Eye Level)</Button>
              <Button onClick={() => handleAdjustCamera("rotate the camera view 30 degrees to the left", "左转30度")} className="w-full">左转30度 (Rotate Left 30°)</Button>
              <Button onClick={() => handleAdjustCamera("rotate the camera view 30 degrees to the right", "右转30度")} className="w-full">右转30度 (Rotate Right 30°)</Button>
            </TabsContent>
            
            <TabsContent value="environment" className="space-y-3">
              <ScrollArea className="h-[400px] pr-4">
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">时间</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => handleAdjustCamera("Transform this image to a bright daytime scene with clear blue sky and natural sunlight", "白天")} className="w-full" disabled={isTaskProcessing}>
                      <Sun className="w-4 h-4 mr-2" />
                      白天
                    </Button>
                    <Button onClick={() => handleAdjustCamera("Transform this image to a nighttime scene with dark sky, moonlight, and ambient night lighting", "夜晚")} className="w-full" disabled={isTaskProcessing}>
                      <Moon className="w-4 h-4 mr-2" />
                      夜晚
                    </Button>
                    <Button onClick={() => handleAdjustCamera("Transform this image to an early morning dawn scene with golden sunrise light and soft morning glow", "黎明")} className="w-full" disabled={isTaskProcessing}>
                      <Sunrise className="w-4 h-4 mr-2" />
                      黎明
                    </Button>
                    <Button onClick={() => handleAdjustCamera("Transform this image to a sunset scene with warm orange and pink sky and golden hour lighting", "黄昏")} className="w-full" disabled={isTaskProcessing}>
                      <Sunset className="w-4 h-4 mr-2" />
                      黄昏
                    </Button>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">天气</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => handleAdjustCamera("Transform this image to a sunny clear day with bright sunlight and clear blue sky", "晴天")} className="w-full" disabled={isTaskProcessing}>
                      <Sun className="w-4 h-4 mr-2" />
                      晴天
                    </Button>
                    <Button onClick={() => handleAdjustCamera("Transform this image to a rainy day scene with rain, wet surfaces, and overcast sky", "雨天")} className="w-full" disabled={isTaskProcessing}>
                      <CloudRain className="w-4 h-4 mr-2" />
                      雨天
                    </Button>
                    <Button onClick={() => handleAdjustCamera("Transform this image to a snowy winter scene with falling snow and snow-covered surfaces", "雪天")} className="w-full" disabled={isTaskProcessing}>
                      <CloudSnow className="w-4 h-4 mr-2" />
                      雪天
                    </Button>
                    <Button onClick={() => handleAdjustCamera("Transform this image to an overcast cloudy day with soft diffused light and gray clouds", "阴天")} className="w-full" disabled={isTaskProcessing}>
                      <Cloud className="w-4 h-4 mr-2" />
                      阴天
                    </Button>
                    <Button onClick={() => handleAdjustCamera("Transform this image to a foggy misty scene with reduced visibility and atmospheric fog", "雾天")} className="w-full" disabled={isTaskProcessing}>
                      <CloudFog className="w-4 h-4 mr-2" />
                      雾天
                    </Button>
                    <Button onClick={() => handleAdjustCamera("Transform this image to a stormy scene with dramatic dark clouds and intense weather", "风暴")} className="w-full" disabled={isTaskProcessing}>
                      <CloudRain className="w-4 h-4 mr-2" />
                      风暴
                    </Button>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">色调</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => handleAdjustCamera("Transform this image to have warm color tones with golden, orange, and red hues", "暖色调")} className="w-full" disabled={isTaskProcessing}>
                      <Droplets className="w-4 h-4 mr-2" />
                      暖色调
                    </Button>
                    <Button onClick={() => handleAdjustCamera("Transform this image to have cool color tones with blue, cyan, and purple hues", "冷色调")} className="w-full" disabled={isTaskProcessing}>
                      <Droplets className="w-4 h-4 mr-2" />
                      冷色调
                    </Button>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">氛围</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => handleAdjustCamera("Transform this image to have a dreamy, ethereal atmosphere with soft glows and magical lighting", "梦幻")} className="w-full" disabled={isTaskProcessing}>
                      <Sparkles className="w-4 h-4 mr-2" />
                      梦幻
                    </Button>
                    <Button onClick={() => handleAdjustCamera("Transform this image to have a vintage retro look with faded colors and nostalgic atmosphere", "复古")} className="w-full" disabled={isTaskProcessing}>
                      <Palette className="w-4 h-4 mr-2" />
                      复古
                    </Button>
                    <Button onClick={() => handleAdjustCamera("Transform this image to have a cyberpunk style with neon lights, futuristic atmosphere, and vibrant colors", "赛博朋克")} className="w-full" disabled={isTaskProcessing}>
                      <Palette className="w-4 h-4 mr-2" />
                      赛博朋克
                    </Button>
                    <Button onClick={() => handleAdjustCamera("Transform this image to have a watercolor painting style with soft edges and artistic effects", "水彩")} className="w-full" disabled={isTaskProcessing}>
                      <Droplets className="w-4 h-4 mr-2" />
                      水彩
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Subject Angle Dialog */}
      <Dialog open={showSubjectAngleDialog} onOpenChange={setShowSubjectAngleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>调整主体角度</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Button onClick={() => handleAdjustSubjectAngle("the front", "正面")} className="w-full">正面</Button>
            <Button onClick={() => handleAdjustSubjectAngle("the left side", "左侧面")} className="w-full">左侧面</Button>
            <Button onClick={() => handleAdjustSubjectAngle("the right side", "右侧面")} className="w-full">右侧面</Button>
            <Button onClick={() => handleAdjustSubjectAngle("the back", "背面")} className="w-full">背面</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pose Dialog */}
      <Dialog open={showPoseDialog} onOpenChange={setShowPoseDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>调整动作姿势</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="preset" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="preset">预设动作</TabsTrigger>
              <TabsTrigger value="custom">自定义</TabsTrigger>
              <TabsTrigger value="reference">线稿参考</TabsTrigger>
            </TabsList>
            
            <TabsContent value="preset" className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => handleAdjustPose("standing")} className="w-full">站立</Button>
                <Button onClick={() => handleAdjustPose("sitting")} className="w-full">坐着</Button>
                <Button onClick={() => handleAdjustPose("walking")} className="w-full">行走</Button>
                <Button onClick={() => handleAdjustPose("running")} className="w-full">跑步</Button>
                <Button onClick={() => handleAdjustPose("jumping")} className="w-full">跳跃</Button>
                <Button onClick={() => handleAdjustPose("lying down")} className="w-full">躺下</Button>
                <Button onClick={() => handleAdjustPose("kneeling")} className="w-full">跪下</Button>
                <Button onClick={() => handleAdjustPose("crouching")} className="w-full">蹲下</Button>
                <Button onClick={() => handleAdjustPose("raising arms")} className="w-full">举手</Button>
                <Button onClick={() => handleAdjustPose("waving")} className="w-full">挥手</Button>
                <Button onClick={() => handleAdjustPose("pointing")} className="w-full">指向</Button>
                <Button onClick={() => handleAdjustPose("dancing")} className="w-full">跳舞</Button>
                <Button onClick={() => handleAdjustPose("fighting stance")} className="w-full">战斗姿态</Button>
                <Button onClick={() => handleAdjustPose("meditation pose")} className="w-full">冥想姿势</Button>
                <Button onClick={() => handleAdjustPose("yoga pose")} className="w-full">瑜伽姿势</Button>
                <Button onClick={() => handleAdjustPose("thinking pose with hand on chin")} className="w-full">思考姿势</Button>
                <Button onClick={() => handleAdjustPose("superhero pose")} className="w-full">超级英雄姿势</Button>
                <Button onClick={() => handleAdjustPose("praying")} className="w-full">祈祷</Button>
              </div>
            </TabsContent>
            
            <TabsContent value="custom" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom-pose">输入自定义动作描述</Label>
                <Input 
                  id="custom-pose" 
                  placeholder="例如：双手抱胸站立、单膝跪地、伸展双臂..." 
                  value={customPose} 
                  onChange={(e) => setCustomPose(e.target.value)} 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCustomPoseSubmit();
                    }
                  }} 
                />
                <p className="text-sm text-muted-foreground">
                  用自然语言描述你想要的动作姿势，AI将尝试理解并调整角色姿势
                </p>
              </div>
              <Button onClick={handleCustomPoseSubmit} className="w-full">
                应用自定义动作
              </Button>
            </TabsContent>
            
            <TabsContent value="reference" className="space-y-4">
              {presetReferences.length > 0 && (
                <div className="space-y-2">
                  <Label>预设参考图片</Label>
                  <ScrollArea className="h-64 rounded-md border p-2">
                    <div className="grid grid-cols-5 gap-2">
                      {presetReferences.map((ref) => (
                        <div
                          key={ref.id}
                          className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                            poseReferenceImage === ref.image_url
                              ? "border-primary ring-2 ring-primary"
                              : "border-transparent hover:border-primary/50"
                          }`}
                          onClick={() => {
                            setPoseReferenceImage(ref.image_url);
                            if (ref.description) {
                              setCustomPose(ref.description);
                            }
                          }}
                        >
                          <div className="aspect-square bg-muted">
                            <img
                              src={ref.image_url}
                              alt={ref.description || "参考图片"}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          {ref.description && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                              {ref.description}
                            </div>
                          )}
                          {poseReferenceImage === ref.image_url && (
                            <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-1">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <div className="space-y-2">
                <Label>或上传自定义参考线稿</Label>
                {poseReferenceImage && !presetReferences.find(r => r.image_url === poseReferenceImage) ? (
                  <div className="space-y-2">
                    <div className="relative w-full aspect-square border rounded-lg overflow-hidden bg-muted">
                      <img src={poseReferenceImage} alt="姿势参考" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleUploadPoseReference} className="flex-1">
                        重新上传
                      </Button>
                      <Button variant="outline" onClick={() => setPoseReferenceImage(null)} className="flex-1">
                        清除
                      </Button>
                    </div>
                  </div>
                ) : !poseReferenceImage ? (
                  <Button variant="outline" onClick={handleUploadPoseReference} className="w-full h-24 border-dashed">
                    <Upload className="h-6 w-6 mr-2" />
                    点击上传姿势线稿
                  </Button>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  选择预设或上传一张姿势线稿，AI将让选中的角色模仿该姿势和表情
                </p>
              </div>

              {poseReferenceImage && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="reference-pose-desc">补充描述（可选）</Label>
                    <Input
                      id="reference-pose-desc"
                      placeholder="例如：注意手部细节、保持平衡感..."
                      value={customPose}
                      onChange={(e) => setCustomPose(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={() =>
                      handleAdjustPose(customPose || "match the reference pose and facial expression", poseReferenceImage)
                    }
                    className="w-full"
                  >
                    应用参考姿势
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>;
};