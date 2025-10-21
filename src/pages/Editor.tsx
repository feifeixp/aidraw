import { useState, useEffect, useReducer, useCallback } from "react";
import { Canvas as FabricCanvas, FabricImage, Rect as FabricRect, FabricText, util } from "fabric";
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
} | {
  type: "RESET";
  payload: string;
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
    case "RESET":
      {
        // 重置历史记录，只保留新的初始状态
        return {
          history: [action.payload],
          historyIndex: 0
        };
      }
    default:
      return state;
  }
};
const Editor = () => {
  const [canvas, setCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<string>("select");
  const [zoom, setZoom] = useState<number>(80);
  const [eraserBrushSize, setEraserBrushSize] = useState<number>(20);
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
  const [activeFrameId, setActiveFrameId] = useState<string | null>("1");
  const [storyboardFrameCount, setStoryboardFrameCount] = useState(1);
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

  // 移除自动保存功能 - 不再使用localStorage缓存

  // Save canvas state to history (exclude frame elements)
  const saveState = useCallback(() => {
    if (!canvas) return;
    const jsonObj = (canvas as any).toJSON(['data', 'name']);
    
    // 过滤掉所有分镜框架元素（不参与历史记录）
    if (jsonObj.objects) {
      jsonObj.objects = jsonObj.objects.filter((obj: any) => {
        return !obj.data?.isFrameElement;
      });
    }
    
    console.log('[Editor] 保存状态，用户对象数量:', jsonObj.objects?.length || 0);
    const state = JSON.stringify(jsonObj);
    dispatchHistory({
      type: "SAVE_STATE",
      payload: state
    });
  }, [canvas]);
  const undo = useCallback(async () => {
    if (historyIndex <= 0 || !canvas) return;
    console.log('[Editor] 执行撤销操作，当前历史索引:', historyIndex);
    
    dispatchHistory({
      type: 'UNDO'
    });
    const previousState = history[historyIndex - 1];
    const parsedState = JSON.parse(previousState);
    console.log('[Editor] 恢复到历史状态，用户对象数量:', parsedState.objects?.length || 0);
    
    // 通知EditorCanvas移除事件监听器
    window.dispatchEvent(new CustomEvent('beforeCanvasRestore'));
    
    // 保存所有分镜框架元素的引用（不需要深拷贝）
    const frameElements = canvas.getObjects().filter((obj: any) => obj.data?.isFrameElement);
    console.log('[Editor] 当前框架元素数量:', frameElements.length);
    
    // 只清除非框架元素
    const nonFrameObjects = canvas.getObjects().filter((obj: any) => !obj.data?.isFrameElement);
    nonFrameObjects.forEach(obj => canvas.remove(obj));
    console.log('[Editor] 清除用户对象后，画布对象数量:', canvas.getObjects().length);
    
    // 手动添加历史状态中的用户对象（不使用loadFromJSON避免清空画布）
    if (parsedState.objects && parsedState.objects.length > 0) {
      const objects = await util.enlivenObjects(parsedState.objects);
      // 再次过滤，确保不会添加任何框架元素
      const frameObjects = objects.filter((obj: any) => obj.data?.isFrameElement);
      const userObjects = objects.filter((obj: any) => !obj.data?.isFrameElement);
      
      console.log('[Editor] ⚠️ 恢复对象详细分析:', {
        总对象数: objects.length,
        框架对象数: frameObjects.length,
        用户对象数: userObjects.length,
        框架对象详情: frameObjects.map((o: any) => ({
          name: o.name,
          type: o.type,
          objectType: o.data?.objectType
        }))
      });
      
      userObjects.forEach((obj: any) => {
        canvas.add(obj);
      });
    }
    console.log('[Editor] 恢复用户内容后，画布对象数量:', canvas.getObjects().length);
    
    // 通知EditorCanvas恢复事件监听器并更新refs
    window.dispatchEvent(new CustomEvent('canvasStateRestored'));
    
    canvas.renderAll();
    console.log('[Editor] 撤销操作完成，当前画布对象数量:', canvas.getObjects().length);
  }, [canvas, historyIndex, history]);
  const redo = useCallback(async () => {
    if (historyIndex >= history.length - 1 || !canvas) return;
    console.log('[Editor] 执行重做操作，当前历史索引:', historyIndex);
    
    const nextState = history[historyIndex + 1];
    const parsedState = JSON.parse(nextState);
    console.log('[Editor] 恢复到历史状态，用户对象数量:', parsedState.objects?.length || 0);
    dispatchHistory({
      type: 'REDO'
    });
    
    // 通知EditorCanvas移除事件监听器
    window.dispatchEvent(new CustomEvent('beforeCanvasRestore'));
    
    // 保存所有分镜框架元素的引用（不需要深拷贝）
    const frameElements = canvas.getObjects().filter((obj: any) => obj.data?.isFrameElement);
    console.log('[Editor] 当前框架元素数量:', frameElements.length);
    
    // 只清除非框架元素
    const nonFrameObjects = canvas.getObjects().filter((obj: any) => !obj.data?.isFrameElement);
    nonFrameObjects.forEach(obj => canvas.remove(obj));
    console.log('[Editor] 清除用户对象后，画布对象数量:', canvas.getObjects().length);
    
    // 手动添加历史状态中的用户对象（不使用loadFromJSON避免清空画布）
    if (parsedState.objects && parsedState.objects.length > 0) {
      const objects = await util.enlivenObjects(parsedState.objects);
      // 再次过滤，确保不会添加任何框架元素
      const frameObjects = objects.filter((obj: any) => obj.data?.isFrameElement);
      const userObjects = objects.filter((obj: any) => !obj.data?.isFrameElement);
      
      console.log('[Editor] ⚠️ 恢复对象详细分析:', {
        总对象数: objects.length,
        框架对象数: frameObjects.length,
        用户对象数: userObjects.length,
        框架对象详情: frameObjects.map((o: any) => ({
          name: o.name,
          type: o.type,
          objectType: o.data?.objectType
        }))
      });
      
      userObjects.forEach((obj: any) => {
        canvas.add(obj);
      });
    }
    console.log('[Editor] 恢复用户内容后，画布对象数量:', canvas.getObjects().length);
    
    // 通知EditorCanvas恢复事件监听器并更新refs
    window.dispatchEvent(new CustomEvent('canvasStateRestored'));
    
    canvas.renderAll();
    console.log('[Editor] 重做操作完成，当前画布对象数量:', canvas.getObjects().length);
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
        const jsonObj = (canvas as any).toJSON(['data', 'name']);
        // 过滤掉框架元素
        if (jsonObj.objects) {
          jsonObj.objects = jsonObj.objects.filter((obj: any) => !obj.data?.isFrameElement);
        }
        const state = JSON.stringify(jsonObj);
        dispatchHistory({
          type: "SAVE_STATE",
          payload: state
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [canvas, history.length]);

  // 移除自动加载草稿功能 - 不再使用localStorage缓存

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

  // Smart extract function
  const handleSmartExtract = useCallback(async () => {
    const activeObject = canvas?.getActiveObject();
    if (!canvas || !activeObject || activeObject.type !== 'image') {
      return; // Silently return if conditions not met (called automatically)
    }
    
    const taskId = startTask("正在智能提取");
    try {
      // Dynamic import helper functions
      const loadImageFromDataURL = (dataUrl: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = dataUrl;
        });
      };

      const classifyExtractedObject = async (imageBlob: Blob): Promise<'character' | 'prop' | 'scene'> => {
        try {
          const { supabase } = await import("@/integrations/supabase/client");
          const reader = new FileReader();
          const imageDataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(imageBlob);
          });
          
          const { data, error } = await supabase.functions.invoke('classify-object', {
            body: { imageUrl: imageDataUrl }
          });
          
          if (error) throw error;
          return data.elementType;
        } catch (error) {
          console.error('Classification error:', error);
          return 'prop';
        }
      };

      // Get original image dimensions and calculate multiplier to maintain quality
      const fabricImage = activeObject as any;
      const originalWidth = fabricImage.width;
      const originalHeight = fabricImage.height;
      const scaleX = fabricImage.scaleX || 1;
      const scaleY = fabricImage.scaleY || 1;
      
      // Calculate multiplier to export at original resolution
      const multiplier = 1 / Math.min(scaleX, scaleY);
      
      // Convert image to data URL at original resolution
      const imageDataURL = fabricImage.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: multiplier,
        enableRetinaScaling: false
      });
      
      // Load image
      const img = await loadImageFromDataURL(imageDataURL);
      
      // Initialize MediaPipe segmenter
      const { MediaPipeSegmenter } = await import("@/lib/mediapipe/interactiveSegmenter");
      const segmenter = new MediaPipeSegmenter();
      await segmenter.initialize();
      
      // Use center point for segmentation
      const centerX = img.width / 2;
      const centerY = img.height / 2;
      
      const result = await segmenter.segmentWithPoint(img, centerX, centerY);
      
      if (!result || !result.categoryMask) {
        toast.info("未检测到需要提取的物体");
        cancelTask();
        segmenter.close();
        return;
      }
      
      // Create source canvas
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = img.width;
      sourceCanvas.height = img.height;
      const ctx = sourceCanvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      
      // Extract the masked object with dilation and feathering (auto-extract uses defaults)
      const maskData = result.categoryMask.getAsUint8Array();
      const extractedCanvas = segmenter.extractMaskedImage(
        sourceCanvas,
        maskData,
        result.categoryMask.width,
        result.categoryMask.height,
        {
          dilation: 0,   // 遮罩膨胀：0 = 不扩大
          feather: 0,    // 边缘羽化：0 = 硬边缘
          padding: 10,   // 裁剪边距：10像素（减小这个值可以让裁剪更紧凑）
          crop: true     // 启用智能裁剪
        }
      );
      
      // Convert to blob for classification
      const blob = await new Promise<Blob>((resolve, reject) => {
        extractedCanvas.toBlob(
          (b) => b ? resolve(b) : reject(new Error('Failed to create blob')),
          'image/png'
        );
      });
      
      // Classify the object
      const elementType = await classifyExtractedObject(blob);
      
      // Convert extracted canvas to data URL
      const extractedDataURL = extractedCanvas.toDataURL('image/png');
      
      // Create new fabric image
      const newImg = await FabricImage.fromURL(extractedDataURL, {
        crossOrigin: 'anonymous'
      });
      
      newImg.set({
        left: activeObject.left,
        top: activeObject.top,
        scaleX: activeObject.scaleX,
        scaleY: activeObject.scaleY,
        data: {
          ...(activeObject as any).data,
          elementType: elementType
        }
      });
      
      canvas.remove(activeObject);
      
      // Insert at correct layer position
      const { insertObjectWithLayerType } = await import("@/lib/layerSorting");
      insertObjectWithLayerType(canvas, newImg, elementType);
      
      canvas.setActiveObject(newImg);
      canvas.renderAll();
      saveState();
      
      segmenter.close();
      completeTask(taskId);
      toast.success(`已自动提取物体 (${elementType})`);
    } catch (error) {
      console.error("Smart extract error:", error);
      toast.error("智能提取失败");
      cancelTask();
    }
  }, [canvas, saveState, startTask, completeTask, cancelTask]);

  const handleLoadDraft = useCallback(async (draftData: string) => {
    if (!canvas) return;
    try {
      const parsedData = JSON.parse(draftData);
      
      // 清空整个画布（包括分镜）
      canvas.clear();
      
      // 加载草稿数据（包含所有内容，包括分镜）
      await canvas.loadFromJSON(parsedData);
      canvas.renderAll();
      
      // 重置历史记录（仅保存用户内容，不包含框架元素）
      const jsonObj = (canvas as any).toJSON(['data', 'name']);
      if (jsonObj.objects) {
        jsonObj.objects = jsonObj.objects.filter((obj: any) => !obj.data?.isFrameElement);
      }
      const state = JSON.stringify(jsonObj);
      dispatchHistory({ type: 'RESET', payload: state });
      
      toast.success("草稿已加载");
    } catch (error) {
      console.error("加载草稿失败:", error);
      toast.error("加载草稿失败");
    }
  }, [canvas]);
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
        onSmartExtract={handleSmartExtract}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        eraserBrushSize={eraserBrushSize}
        setEraserBrushSize={setEraserBrushSize}
        activeFrameId={activeFrameId}
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
            onActiveFrameIdChange={setActiveFrameId}
            onFrameCountChange={setStoryboardFrameCount}
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
            zoom={zoom}
            onZoomChange={setZoom}
            activeFrameId={activeFrameId}
            onActiveFrameChange={setActiveFrameId}
            storyboardFrameCount={storyboardFrameCount}
            setStoryboardFrameCount={setStoryboardFrameCount}
          />
        </div>
      </div>
      
      <div className="flex-1 relative overflow-hidden editor-canvas flex">
        <EditorCanvas 
          canvas={canvas} 
          setCanvas={setCanvas} 
          activeTool={activeTool} 
          saveState={saveState}
          zoom={zoom}
          onZoomChange={setZoom}
          eraserBrushSize={eraserBrushSize}
          activeFrameId={activeFrameId}
          onActiveFrameChange={setActiveFrameId}
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
              <PropertiesPanel 
                canvas={canvas} 
                saveState={saveState}
                isTaskProcessing={isTaskProcessing}
                startTask={startTask}
                completeTask={completeTask}
                cancelTask={cancelTask}
                onSmartExtract={handleSmartExtract}
              />
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