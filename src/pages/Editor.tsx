import { useState, useEffect, useReducer, useCallback } from "react";
import { Canvas as FabricCanvas } from "fabric";
import { Menu, ChevronLeft, ChevronRight } from "lucide-react";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { LeftToolbar } from "@/components/editor/LeftToolbar";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { TaskQueueDisplay } from "@/components/editor/TaskQueueDisplay";
import { DraftsList } from "@/components/editor/DraftsList";
import { Tutorial } from "@/components/editor/Tutorial";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
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
  const [isLeftToolbarCollapsed, setIsLeftToolbarCollapsed] = useState(false);
  const [isPropertiesPanelCollapsed, setIsPropertiesPanelCollapsed] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | undefined>(undefined);
  const [showTutorial, setShowTutorial] = useState(false);
  const isMobile = useIsMobile();

  // Check if tutorial should be shown
  useEffect(() => {
    const tutorialCompleted = localStorage.getItem("editor-tutorial-completed");
    if (!tutorialCompleted) {
      // Show tutorial after a short delay to let the UI settle
      const timer = setTimeout(() => setShowTutorial(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

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

  // Load draft when returning to editor
  useEffect(() => {
    if (!canvas) return;
    
    const loadDraft = () => {
      const draftJson = localStorage.getItem('editor-draft');
      const draftTimestamp = localStorage.getItem('editor-draft-timestamp');
      
      if (draftJson && draftTimestamp) {
        const timestamp = parseInt(draftTimestamp);
        const now = Date.now();
        const hoursSinceLastSave = (now - timestamp) / (1000 * 60 * 60);
        
        // Only auto-load if draft is less than 24 hours old
        if (hoursSinceLastSave < 24) {
          try {
            canvas.loadFromJSON(JSON.parse(draftJson)).then(() => {
              canvas.renderAll();
              saveState();
              console.log("已加载草稿");
            });
          } catch (error) {
            console.error("加载草稿失败:", error);
          }
        }
      }
    };

    // Load after a short delay to ensure canvas is ready
    const timer = setTimeout(loadDraft, 500);
    return () => clearTimeout(timer);
  }, [canvas]);

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

  const handleLoadDraft = useCallback((draftData: string) => {
    if (!canvas) return;
    try {
      canvas.loadFromJSON(JSON.parse(draftData)).then(() => {
        canvas.renderAll();
        saveState();
        toast.success("草稿已加载到画布");
      });
    } catch (error) {
      console.error("加载草稿失败:", error);
      toast.error("加载草稿失败");
    }
  }, [canvas, saveState]);
  const leftToolbarContent = (
    <div className="overflow-auto h-full">
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
  );
  return <div className="h-screen w-full bg-background flex flex-col">
      {showTutorial && <Tutorial onComplete={() => setShowTutorial(false)} />}
      <TaskQueueDisplay currentTask={currentTask} />
      <div className="border-b border-border p-2 flex items-center gap-2 my-[20px] overflow-x-auto editor-toolbar">
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
        <div className="drafts-list">
          <DraftsList 
            canvas={canvas} 
            onLoadDraft={handleLoadDraft}
            currentDraftId={currentDraftId}
            onDraftIdChange={setCurrentDraftId}
          />
        </div>
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
          />
        </div>
      </div>
      
      <div className="flex-1 relative overflow-hidden editor-canvas flex">
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
          <div className={`absolute left-4 top-4 ${isLeftToolbarCollapsed ? 'w-16' : 'w-48'} h-[calc(100%-2rem)] flex flex-col bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg z-10 overflow-hidden transition-all duration-300 left-toolbar`}>
            {leftToolbarContent}
          </div>
        )}
        
        {/* Right Properties Panel */}
        {!isMobile && !isPropertiesPanelCollapsed && (
          <div className="absolute right-4 top-4 w-80 h-[calc(100%-2rem)] flex flex-col bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg z-10 overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <h3 className="font-medium">属性面板</h3>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsPropertiesPanelCollapsed(true)}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <PropertiesPanel canvas={canvas} saveState={saveState} />
            </div>
          </div>
        )}
        
        {/* Collapsed Properties Panel Toggle */}
        {!isMobile && isPropertiesPanelCollapsed && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsPropertiesPanelCollapsed(false)}
            className="absolute right-4 top-4 z-10 bg-background/95 backdrop-blur-sm"
            title="显示属性面板"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>;
};
export default Editor;