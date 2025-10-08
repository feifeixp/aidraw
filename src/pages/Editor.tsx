import { useState, useEffect } from "react";
import { Canvas as FabricCanvas } from "fabric";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { LayerPanel } from "@/components/editor/LayerPanel";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  imageUrl?: string;
  fabricObjects: any[];
}

const Editor = () => {
  const [canvas, setCanvas] = useState<FabricCanvas | null>(null);
  const [layers, setLayers] = useState<Layer[]>([
    { id: "0", name: "背景", visible: true, locked: false, opacity: 100, fabricObjects: [] },
    { id: "1", name: "中景", visible: true, locked: false, opacity: 100, fabricObjects: [] },
    { id: "2", name: "前景", visible: true, locked: false, opacity: 100, fabricObjects: [] },
    { id: "3", name: "字幕", visible: true, locked: false, opacity: 100, fabricObjects: [] },
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>("0");
  const [activeTool, setActiveTool] = useState<string>("select");

  const activeLayer = layers.find(l => l.id === activeLayerId);

  const updateLayer = (id: string, updates: Partial<Layer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const addLayer = () => {
    const newId = Date.now().toString();
    setLayers(prev => [...prev, {
      id: newId,
      name: `图层 ${prev.length}`,
      visible: true,
      locked: false,
      opacity: 100,
      fabricObjects: []
    }]);
    setActiveLayerId(newId);
  };

  const deleteLayer = (id: string) => {
    if (layers.length <= 1) return;
    
    // Remove fabric objects from canvas before deleting layer
    const layerToDelete = layers.find(l => l.id === id);
    if (canvas && layerToDelete) {
      layerToDelete.fabricObjects.forEach(obj => {
        canvas.remove(obj);
      });
      canvas.renderAll();
    }
    
    setLayers(prev => prev.filter(l => l.id !== id));
    if (activeLayerId === id) {
      setActiveLayerId(layers[0].id);
    }
  };

  const moveLayer = (id: string, direction: "up" | "down") => {
    setLayers(prev => {
      const index = prev.findIndex(l => l.id === id);
      if (index === -1) return prev;
      if (direction === "up" && index === prev.length - 1) return prev;
      if (direction === "down" && index === 0) return prev;
      
      const newLayers = [...prev];
      const targetIndex = direction === "up" ? index + 1 : index - 1;
      [newLayers[index], newLayers[targetIndex]] = [newLayers[targetIndex], newLayers[index]];
      return newLayers;
    });
  };

  return (
    <div className="h-[calc(100vh-4rem)] w-full bg-background">
      <div className="border-b border-border p-2">
        <EditorToolbar 
          canvas={canvas}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          activeLayer={activeLayer}
          updateLayer={updateLayer}
          addLayer={addLayer}
        />
      </div>
      
      <ResizablePanelGroup direction="horizontal" className="h-[calc(100%-3.5rem)]">
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <LayerPanel
            layers={layers}
            activeLayerId={activeLayerId}
            setActiveLayerId={setActiveLayerId}
            updateLayer={updateLayer}
            addLayer={addLayer}
            deleteLayer={deleteLayer}
            moveLayer={moveLayer}
          />
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        <ResizablePanel defaultSize={80}>
          <EditorCanvas
            canvas={canvas}
            setCanvas={setCanvas}
            layers={layers}
            activeLayerId={activeLayerId}
            activeTool={activeTool}
            updateLayer={updateLayer}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default Editor;
