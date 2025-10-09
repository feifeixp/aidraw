import { useState, useEffect } from "react";
import { Canvas as FabricCanvas } from "fabric";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { LeftToolbar } from "@/components/editor/LeftToolbar";

const Editor = () => {
  const [canvas, setCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<string>("select");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

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

  return (
    <div className="h-screen w-full bg-background flex flex-col">
      <div className="border-b border-border p-2">
        <EditorToolbar 
          canvas={canvas}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          undo={undo}
          redo={redo}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          saveState={saveState}
        />
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div className="w-48">
          <LeftToolbar 
            canvas={canvas}
            saveState={saveState}
          />
        </div>
        <div className="flex-1">
          <EditorCanvas
            canvas={canvas}
            setCanvas={setCanvas}
            activeTool={activeTool}
            saveState={saveState}
          />
        </div>
      </div>
    </div>
  );
};

export default Editor;
