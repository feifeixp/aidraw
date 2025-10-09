import { useState, useEffect } from "react";
import { Canvas as FabricCanvas } from "fabric";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { LayerPanel } from "@/components/editor/LayerPanel";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

export interface Element {
  id: string;
  name: string;
  type: string; // 'image' | 'shape' | 'path' | 'text' etc.
  visible: boolean;
  locked: boolean;
  opacity: number;
  fabricObject: any;
}

const Editor = () => {
  const [canvas, setCanvas] = useState<FabricCanvas | null>(null);
  const [elements, setElements] = useState<Element[]>([]);
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string>("select");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const activeElement = elements.find(e => e.id === activeElementId);

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

  const updateElement = (id: string, updates: Partial<Element>) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const addElement = (fabricObject: any, name?: string) => {
    const newId = Date.now().toString();
    const type = fabricObject.type || 'object';
    setElements(prev => [...prev, {
      id: newId,
      name: name || `${type} ${prev.length + 1}`,
      type,
      visible: true,
      locked: false,
      opacity: 100,
      fabricObject
    }]);
    setActiveElementId(newId);
    return newId;
  };

  const deleteElement = (id: string) => {
    const elementToDelete = elements.find(e => e.id === id);
    if (canvas && elementToDelete && elementToDelete.fabricObject) {
      canvas.remove(elementToDelete.fabricObject);
      canvas.renderAll();
      saveState();
    }
    
    setElements(prev => prev.filter(e => e.id !== id));
    if (activeElementId === id) {
      setActiveElementId(null);
    }
  };

  const moveElement = (id: string, direction: "up" | "down") => {
    const element = elements.find(e => e.id === id);
    if (!element || !canvas) return;
    
    const obj = element.fabricObject;
    
    if (direction === "up") {
      obj.bringForward();
    } else {
      obj.sendBackwards();
    }
    
    canvas.renderAll();
    saveState();
    
    // Update elements order to match canvas
    syncElementsWithCanvas();
  };

  // Sync elements list with canvas objects
  const syncElementsWithCanvas = () => {
    if (!canvas) return;
    
    const canvasObjects = canvas.getObjects();
    const existingElementIds = new Set(elements.map(e => e.id));
    
    // Add new objects that don't have elements
    canvasObjects.forEach((obj: any) => {
      if (!obj._elementId) {
        const id = Date.now().toString() + Math.random();
        obj._elementId = id;
        const type = obj.type || 'object';
        setElements(prev => [...prev, {
          id,
          name: `${type} ${prev.length + 1}`,
          type,
          visible: obj.visible !== false,
          locked: obj.selectable === false,
          opacity: Math.round((obj.opacity || 1) * 100),
          fabricObject: obj
        }]);
      }
    });
    
    // Remove elements whose objects are no longer on canvas
    const canvasObjectIds = new Set(canvasObjects.map((obj: any) => obj._elementId).filter(Boolean));
    setElements(prev => prev.filter(e => canvasObjectIds.has(e.id) || !e.fabricObject));
  };

  return (
    <div className="h-[calc(100vh-4rem)] w-full bg-background">
      <div className="border-b border-border p-2">
        <EditorToolbar 
          canvas={canvas}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          activeElement={activeElement}
          updateElement={updateElement}
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
            elements={elements}
            activeElementId={activeElementId}
            setActiveElementId={setActiveElementId}
            updateElement={updateElement}
            deleteElement={deleteElement}
            moveElement={moveElement}
            syncElementsWithCanvas={syncElementsWithCanvas}
          />
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        <ResizablePanel defaultSize={80}>
          <EditorCanvas
            canvas={canvas}
            setCanvas={setCanvas}
            elements={elements}
            activeElementId={activeElementId}
            activeTool={activeTool}
            updateElement={updateElement}
            addElement={addElement}
            saveState={saveState}
            syncElementsWithCanvas={syncElementsWithCanvas}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default Editor;
