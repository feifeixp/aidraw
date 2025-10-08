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
}

export const EditorCanvas = ({
  canvas,
  setCanvas,
  layers,
  activeLayerId,
  activeTool,
  updateLayer
}: EditorCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const fabricCanvas = new FabricCanvas(canvasRef.current, {
      width: 1024,
      height: 768,
      backgroundColor: "#ffffff",
    });

    setCanvas(fabricCanvas);

    return () => {
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

  useEffect(() => {
    if (!canvas) return;

    // Update canvas based on layers visibility and opacity
    layers.forEach(layer => {
      layer.fabricObjects.forEach(obj => {
        if (obj) {
          obj.visible = layer.visible;
          obj.opacity = layer.opacity / 100;
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
