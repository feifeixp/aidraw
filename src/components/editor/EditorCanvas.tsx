import { useEffect, useRef } from "react";
import { Canvas as FabricCanvas, FabricImage } from "fabric";
import { Layer } from "@/pages/Editor";

interface EditorCanvasProps {
  canvas: FabricCanvas | null;
  setCanvas: (canvas: FabricCanvas) => void;
  layers: Layer[];
  activeLayerId: string;
  activeTool: string;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  saveState: () => void;
}

export const EditorCanvas = ({
  canvas,
  setCanvas,
  layers,
  activeLayerId,
  activeTool,
  updateLayer,
  saveState
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
          saveState();
        }
      }
    };

    // Add event listener for canvas modifications (but not for initial object additions)
    const handleObjectModified = () => {
      saveState();
    };
    
    fabricCanvas.on('object:modified', handleObjectModified);
    
    window.addEventListener('keydown', handleKeyDown);
    setCanvas(fabricCanvas);

    return () => {
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

  // Load images when imageUrl changes
  useEffect(() => {
    if (!canvas) return;

    layers.forEach(layer => {
      if (layer.imageUrl && layer.fabricObjects.length === 0) {
        FabricImage.fromURL(layer.imageUrl, { crossOrigin: 'anonymous' }).then(img => {
          if (!img) return;
          
          // Scale image to fit canvas while maintaining aspect ratio
          const canvasWidth = canvas.width || 1024;
          const canvasHeight = canvas.height || 768;
          const imgWidth = img.width || 1;
          const imgHeight = img.height || 1;
          const scaleX = canvasWidth / imgWidth;
          const scaleY = canvasHeight / imgHeight;
          const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down if needed
          
          img.scale(scale);
          img.set({
            left: (canvasWidth - imgWidth * scale) / 2,
            top: (canvasHeight - imgHeight * scale) / 2,
            selectable: !layer.locked,
            opacity: layer.opacity / 100,
            visible: layer.visible,
          });
          
          canvas.add(img);
          canvas.renderAll();
          
          // Update layer with fabric object and save state after image is loaded
          updateLayer(layer.id, { fabricObjects: [img] });
          
          // Save state after image is successfully added
          setTimeout(() => saveState(), 100);
        }).catch(error => {
          console.error('Error loading image:', error);
        });
      }
    });
  }, [layers, canvas, updateLayer, saveState]);

  useEffect(() => {
    if (!canvas) return;

    // Update canvas based on layers visibility and opacity
    layers.forEach(layer => {
      layer.fabricObjects.forEach(obj => {
        if (obj) {
          obj.visible = layer.visible;
          obj.opacity = layer.opacity / 100;
          obj.selectable = !layer.locked;
        }
      });
    });

    canvas.renderAll();
  }, [layers, canvas]);

  return (
    <div className="flex items-center justify-center h-full bg-muted/20 p-4 overflow-auto">
      <div className="shadow-2xl">
        <canvas ref={canvasRef} className="border border-border" />
      </div>
    </div>
  );
};
