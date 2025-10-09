import { useState, useEffect, useReducer } from "react";
import { Canvas as FabricCanvas } from "fabric";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { LeftToolbar } from "@/components/editor/LeftToolbar";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";

type HistoryState = {
  history: string[];
  historyIndex: number;
};

type HistoryAction =
  | { type: "SAVE_STATE"; payload: string }
  | { type: "UNDO" }
  | { type: "REDO" };

const historyReducer = (state: HistoryState, action: HistoryAction): HistoryState => {
  switch (action.type) {
    case "SAVE_STATE": {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(action.payload);
      
      // Limit history to 50 states
      if (newHistory.length > 50) {
        return {
          history: newHistory.slice(1),
          historyIndex: state.historyIndex, // Stay at same position after removing first
        };
      }
      
      return {
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }
    
    case "UNDO": {
      if (state.historyIndex <= 0) return state;
      return {
        ...state,
        historyIndex: state.historyIndex - 1,
      };
    }
    
    case "REDO": {
      if (state.historyIndex >= state.history.length - 1) return state;
      return {
        ...state,
        historyIndex: state.historyIndex + 1,
      };
    }
    
    default:
      return state;
  }
};

const Editor = () => {
  const [canvas, setCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<string>("select");
  const [{ history, historyIndex }, dispatchHistory] = useReducer(historyReducer, {
    history: [],
    historyIndex: -1,
  });

  // Save canvas state to history
  const saveState = () => {
    if (!canvas) return;
    const state = JSON.stringify(canvas.toJSON());
    dispatchHistory({ type: "SAVE_STATE", payload: state });
  };

  // Undo function
  const undo = async () => {
    if (!canvas || historyIndex <= 0) return;
    
    dispatchHistory({ type: "UNDO" });
    
    try {
      await canvas.loadFromJSON(JSON.parse(history[historyIndex - 1]));
      canvas.renderAll();
    } catch (error) {
      console.error("Undo error:", error);
    }
  };

  // Redo function
  const redo = async () => {
    if (!canvas || historyIndex >= history.length - 1) return;
    
    dispatchHistory({ type: "REDO" });
    
    try {
      await canvas.loadFromJSON(JSON.parse(history[historyIndex + 1]));
      canvas.renderAll();
    } catch (error) {
      console.error("Redo error:", error);
    }
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
        <div className="w-48 flex flex-col border-r border-border overflow-hidden">
          <div className="overflow-auto">
            <LeftToolbar 
              canvas={canvas}
              saveState={saveState}
            />
          </div>
          <div className="flex-1 border-t border-border overflow-hidden">
            <PropertiesPanel 
              canvas={canvas}
              saveState={saveState}
            />
          </div>
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
