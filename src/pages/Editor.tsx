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
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const activeLayer = layers.find(l => l.id === activeLayerId);

  // Save canvas state to history
  const saveState = () => {
    if (!canvas) return;
    
    const state = JSON.stringify(canvas.toJSON());
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(state);
      // Limit history to 50 states
      if (newHistory.length > 50) {
        newHistory.shift();
        setHistoryIndex(historyIndex);
        return newHistory;
      }
      setHistoryIndex(newHistory.length - 1);
      return newHistory;
    });
  };

  // Undo function
  const undo = () => {
    if (!canvas || historyIndex <= 0) return;
    
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    canvas.loadFromJSON(JSON.parse(history[newIndex]), () => {
      canvas.renderAll();
    });
  };

  // Redo function
  const redo = () => {
    if (!canvas || historyIndex >= history.length - 1) return;
    
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    canvas.loadFromJSON(JSON.parse(history[newIndex]), () => {
      canvas.renderAll();
    });
  };

  // Save initial state when canvas is created
  useEffect(() => {
    if (canvas && history.length === 0) {
      saveState();
    }
  }, [canvas]);

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
          undo={undo}
          redo={redo}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          saveState={saveState}
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
            saveState={saveState}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default Editor;
