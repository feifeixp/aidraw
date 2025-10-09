import { useEffect, useRef } from "react";
import { Canvas as FabricCanvas, FabricImage } from "fabric";
import { Element } from "@/pages/Editor";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface EditorCanvasProps {
  canvas: FabricCanvas | null;
  setCanvas: (canvas: FabricCanvas) => void;
  elements: Element[];
  activeElementId: string | null;
  activeTool: string;
  updateElement: (id: string, updates: Partial<Element>) => void;
  addElement: (fabricObject: any, name?: string) => string;
  saveState: () => void;
  syncElementsWithCanvas: () => void;
}

export const EditorCanvas = ({
  canvas,
  setCanvas,
  elements,
  activeElementId,
  activeTool,
  updateElement,
  addElement,
  saveState,
  syncElementsWithCanvas
}: EditorCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const fabricCanvas = new FabricCanvas(canvasRef.current, {
      width: 1024,
      height: 768,
      backgroundColor: "#ffffff",
    });

    // Add keyboard event listener for Delete key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeObjects = fabricCanvas.getActiveObjects();
        if (activeObjects.length > 0) {
          activeObjects.forEach(obj => {
            fabricCanvas.remove(obj);
          });
          fabricCanvas.discardActiveObject();
          fabricCanvas.renderAll();
          syncElementsWithCanvas();
          saveState();
        }
      }
    };

    // Sync elements when objects are added/removed/modified
    const handleObjectAdded = () => {
      setTimeout(() => syncElementsWithCanvas(), 50);
      setTimeout(() => saveState(), 100);
    };
    
    const handleObjectRemoved = () => {
      syncElementsWithCanvas();
    };

    const handleObjectModified = () => {
      saveState();
    };
    
    fabricCanvas.on('object:added', handleObjectAdded);
    fabricCanvas.on('object:removed', handleObjectRemoved);
    fabricCanvas.on('object:modified', handleObjectModified);
    
    window.addEventListener('keydown', handleKeyDown);
    setCanvas(fabricCanvas);

    return () => {
      fabricCanvas.off('object:added', handleObjectAdded);
      fabricCanvas.off('object:removed', handleObjectRemoved);
      fabricCanvas.off('object:modified', handleObjectModified);
      window.removeEventListener('keydown', handleKeyDown);
      fabricCanvas.dispose();
    };
  }, []);

  useEffect(() => {
    if (!canvas) return;

    canvas.isDrawingMode = activeTool === "draw";
    canvas.selection = activeTool === "select";

    if (activeTool === "draw" && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = "#000000";
      canvas.freeDrawingBrush.width = 2;
    }
  }, [activeTool, canvas]);

  // Handle image upload via drag & drop or paste
  useEffect(() => {
    if (!canvas) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const imageUrl = event.target?.result as string;
              loadImageToCanvas(imageUrl, "粘贴的图片");
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    };

    const handleAddImage = (e: CustomEvent) => {
      const { imageUrl, name } = e.detail;
      loadImageToCanvas(imageUrl, name);
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('addImageToCanvas', handleAddImage as EventListener);
    
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('addImageToCanvas', handleAddImage as EventListener);
    };
  }, [canvas]);

  const loadImageToCanvas = (imageUrl: string, name: string = "图片") => {
    if (!canvas) return;

    FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' }).then(img => {
      if (!img) return;
      
      const canvasWidth = canvas.width || 1024;
      const canvasHeight = canvas.height || 768;
      const imgWidth = img.width || 1;
      const imgHeight = img.height || 1;
      const scaleX = canvasWidth / imgWidth;
      const scaleY = canvasHeight / imgHeight;
      const scale = Math.min(scaleX, scaleY, 1);
      
      img.scale(scale);
      img.set({
        left: (canvasWidth - imgWidth * scale) / 2,
        top: (canvasHeight - imgHeight * scale) / 2,
      });
      
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      
      toast.success("图片已添加");
    }).catch(error => {
      console.error('Error loading image:', error);
      toast.error("图片加载失败");
    });
  };

  // Sync element properties with fabric objects
  useEffect(() => {
    if (!canvas) return;

    elements.forEach(element => {
      if (element.fabricObject) {
        element.fabricObject.visible = element.visible;
        element.fabricObject.opacity = element.opacity / 100;
        element.fabricObject.selectable = !element.locked;
        element.fabricObject.evented = !element.locked;
      }
    });

    canvas.renderAll();
  }, [elements, canvas]);

  return (
    <div className="flex items-center justify-center h-full bg-muted/20 p-4 overflow-auto">
      <div className="shadow-2xl">
        <canvas ref={canvasRef} className="border border-border" />
      </div>
    </div>
  );
};
