import { useState, useEffect, useReducer, useCallback } from "react";
import { Canvas as FabricCanvas } from "fabric";
import { Menu } from "lucide-react";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { LeftToolbar } from "@/components/editor/LeftToolbar";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { TaskQueueDisplay } from "@/components/editor/TaskQueueDisplay";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
interface Task {
  id: string;
  name: string;
  status: "processing" | "completed";
}
type HistoryState = {
  history: string[];
  historyIndex: number;
};
type HistoryAction = {
  type: "SAVE_STATE";
  payload: string;
} | {
  type: "UNDO";
} | {
  type: "REDO";
};
const historyReducer = (state: HistoryState, action: HistoryAction): HistoryState => {
  switch (action.type) {
    case "SAVE_STATE":
      {
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push(action.payload);

        // Limit history to 50 states
        if (newHistory.length > 50) {
          return {
            history: newHistory.slice(1),
            historyIndex: state.historyIndex // Stay at same position after removing first
          };
        }
        return {
          history: newHistory,
          historyIndex: newHistory.length - 1
        };
      }
    case "UNDO":
      {
        if (state.historyIndex <= 0) return state;
        return {
          ...state,
          historyIndex: state.historyIndex - 1
        };
      }
    case "REDO":
      {
        if (state.historyIndex >= state.history.length - 1) return state;
        return {
          ...state,
          historyIndex: state.historyIndex + 1
        };
      }
    default:
      return state;
  }
};
const Editor = () => {
  const [canvas, setCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<string>("select");
  const [canvasSize, setCanvasSize] = useState({ width: 1024, height: 768 });
  const [zoom, setZoom] = useState<number>(100);
  const [{
    history,
    historyIndex
  }, dispatchHistory] = useReducer(historyReducer, {
    history: [],
    historyIndex: -1
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [isTaskProcessing, setIsTaskProcessing] = useState(false);
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  const [isLeftToolbarCollapsed, setIsLeftToolbarCollapsed] = useState(false);
  const isMobile = useIsMobile();

  // Save canvas state to history
  const saveState = useCallback(() => {
    if (!canvas) return;
    const state = JSON.stringify(canvas.toJSON());
    dispatchHistory({
      type: "SAVE_STATE",
      payload: state
    });
  }, [canvas]);
  const undo = useCallback(() => {
    if (historyIndex <= 0 || !canvas) return;
    dispatchHistory({
      type: 'UNDO'
    });
    const previousState = history[historyIndex - 1];
    canvas.loadFromJSON(JSON.parse(previousState)).then(() => {
      canvas.renderAll();
    });
  }, [canvas, historyIndex, history]);
  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1 || !canvas) return;
    const nextState = history[historyIndex + 1];
    dispatchHistory({
      type: 'REDO'
    });
    canvas.loadFromJSON(JSON.parse(nextState)).then(() => {
      canvas.renderAll();
    });
  }, [canvas, historyIndex, history]);
  const startTask = useCallback((taskName: string) => {
    const taskId = Date.now().toString();
    setCurrentTask({
      id: taskId,
      name: taskName,
      status: "processing"
    });
    setIsTaskProcessing(true);
    return taskId;
  }, []);
  const completeTask = useCallback((taskId: string) => {
    setCurrentTask(prev => prev?.id === taskId ? {
      ...prev,
      status: "completed"
    } : prev);
    setTimeout(() => {
      setCurrentTask(null);
      setIsTaskProcessing(false);
    }, 1500);
  }, []);
  const cancelTask = useCallback(() => {
    setCurrentTask(null);
    setIsTaskProcessing(false);
  }, []);

  // Save initial state when canvas is created
  useEffect(() => {
    if (canvas && history.length === 0) {
      // Small delay to ensure canvas is fully initialized
      const timer = setTimeout(() => {
        const state = JSON.stringify(canvas.toJSON());
        dispatchHistory({
          type: "SAVE_STATE",
          payload: state
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [canvas, history.length]);

  // Keyboard shortcut for pan tool (H key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input field
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.isContentEditable;
      
      if (isInputField) return;
      
      if (e.key === 'h' || e.key === 'H') {
        setActiveTool(prev => prev === "pan" ? "select" : "pan");
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const handleCloseMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);
  const leftToolbarContent = <>
      <div className="overflow-auto">
        <LeftToolbar 
          canvas={canvas} 
          saveState={saveState} 
          isTaskProcessing={isTaskProcessing} 
          startTask={startTask} 
          completeTask={completeTask} 
          cancelTask={cancelTask} 
          onActionComplete={isMobile ? handleCloseMobileMenu : undefined}
          isCollapsed={isLeftToolbarCollapsed}
          onToggleCollapse={() => setIsLeftToolbarCollapsed(!isLeftToolbarCollapsed)}
        />
      </div>
      {!isLeftToolbarCollapsed && (
        <div className="flex-1 border-t border-border overflow-hidden">
          <PropertiesPanel canvas={canvas} saveState={saveState} />
        </div>
      )}
    </>;
  return <div className="h-screen w-full bg-background flex flex-col">
      <TaskQueueDisplay currentTask={currentTask} />
      <div className="border-b border-border p-2 flex items-center gap-2 my-[20px] overflow-x-auto">
        {isMobile && <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 flex flex-col">
              {leftToolbarContent}
            </SheetContent>
          </Sheet>}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <EditorToolbar
            canvas={canvas} 
            activeTool={activeTool} 
            setActiveTool={setActiveTool} 
            undo={undo} 
            redo={redo} 
            canUndo={historyIndex > 0} 
            canRedo={historyIndex < history.length - 1} 
            saveState={saveState} 
            isTaskProcessing={isTaskProcessing} 
            startTask={startTask} 
            completeTask={completeTask} 
            cancelTask={cancelTask}
            canvasSize={canvasSize}
            onCanvasSizeChange={setCanvasSize}
            zoom={zoom}
            onZoomChange={setZoom}
            isCollapsed={isToolbarCollapsed}
            onToggleCollapse={() => setIsToolbarCollapsed(!isToolbarCollapsed)}
          />
        </div>
      </div>
      
      <div className="flex-1 relative overflow-hidden">
        <EditorCanvas 
          canvas={canvas} 
          setCanvas={setCanvas} 
          activeTool={activeTool} 
          saveState={saveState}
          canvasSize={canvasSize}
          zoom={zoom}
          onZoomChange={setZoom}
        />
        {!isMobile && (
          <div className={`absolute left-4 top-4 ${isLeftToolbarCollapsed ? 'w-16' : 'w-48'} h-[calc(100%-2rem)] flex flex-col bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg z-10 overflow-hidden transition-all duration-300`}>
            {leftToolbarContent}
          </div>
        )}
      </div>
    </div>;
};
export default Editor;