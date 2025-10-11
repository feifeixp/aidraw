import { useEffect, useRef } from "react";
import { Canvas as FabricCanvas, FabricImage, Rect } from "fabric";
import { toast } from "sonner";

// 无限画布的实际尺寸
const INFINITE_CANVAS_SIZE = 10000;

interface EditorCanvasProps {
  canvas: FabricCanvas | null;
  setCanvas: (canvas: FabricCanvas) => void;
  activeTool: string;
  saveState: () => void;
  canvasSize: { width: number; height: number };
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export const EditorCanvas = ({
  canvas,
  setCanvas,
  activeTool,
  saveState,
  canvasSize,
  zoom,
  onZoomChange
}: EditorCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveStateRef = useRef(saveState);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<Rect | null>(null);
  
  // Keep saveStateRef up to date
  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const fabricCanvas = new FabricCanvas(canvasRef.current, {
      width: INFINITE_CANVAS_SIZE,
      height: INFINITE_CANVAS_SIZE,
      backgroundColor: "#f5f5f5",
      preserveObjectStacking: true,
    });

    // 创建frame（工作区域）
    const frameWidth = canvasSize?.width || 1024;
    const frameHeight = canvasSize?.height || 768;
    const frameLeft = (INFINITE_CANVAS_SIZE - frameWidth) / 2;
    const frameTop = (INFINITE_CANVAS_SIZE - frameHeight) / 2;

    const frame = new Rect({
      left: frameLeft,
      top: frameTop,
      width: frameWidth,
      height: frameHeight,
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 2,
      selectable: false,
      evented: false,
      name: 'workframe',
    });

    fabricCanvas.add(frame);
    fabricCanvas.sendObjectToBack(frame);
    frameRef.current = frame;

    // Add keyboard event listener for Delete key
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input field
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.isContentEditable;
      
      // Don't delete objects if user is typing in an input field
      if (isInputField) return;
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeObjects = fabricCanvas.getActiveObjects();
        if (activeObjects.length > 0) {
          activeObjects.forEach(obj => {
            // 不删除frame
            if ((obj as any).name !== 'workframe') {
              fabricCanvas.remove(obj);
            }
          });
          fabricCanvas.discardActiveObject();
          fabricCanvas.renderAll();
          saveStateRef.current();
        }
      }
    };

    const handleObjectModified = () => {
      saveStateRef.current();
    };

    // Handle double click on text objects
    const canvasElement = canvasRef.current;
    const handleCanvasDoubleClick = () => {
      const activeObject = fabricCanvas.getActiveObject();
      if (activeObject && activeObject.type === 'text') {
        (activeObject as any).enterEditing();
        (activeObject as any).selectAll();
        fabricCanvas.renderAll();
      }
    };
    
    fabricCanvas.on('object:modified', handleObjectModified);
    canvasElement.addEventListener('dblclick', handleCanvasDoubleClick);
    window.addEventListener('keydown', handleKeyDown);
    setCanvas(fabricCanvas);

    // 初始视图居中到frame
    setTimeout(() => {
      if (containerRef.current) {
        const container = containerRef.current;
        const scrollX = (INFINITE_CANVAS_SIZE - container.clientWidth) / 2;
        const scrollY = (INFINITE_CANVAS_SIZE - container.clientHeight) / 2;
        container.scrollLeft = scrollX;
        container.scrollTop = scrollY;
      }
    }, 100);

    return () => {
      fabricCanvas.off('object:modified', handleObjectModified);
      if (canvasElement) {
        canvasElement.removeEventListener('dblclick', handleCanvasDoubleClick);
      }
      window.removeEventListener('keydown', handleKeyDown);
      fabricCanvas.dispose();
      frameRef.current = null;
    };
  }, [setCanvas]); // Only run once on mount

  // Update frame size when canvasSize prop changes
  useEffect(() => {
    if (!canvas || !canvasSize || !frameRef.current) return;
    
    requestAnimationFrame(() => {
      try {
        const frame = frameRef.current;
        if (frame) {
          const frameLeft = (INFINITE_CANVAS_SIZE - canvasSize.width) / 2;
          const frameTop = (INFINITE_CANVAS_SIZE - canvasSize.height) / 2;
          
          frame.set({
            left: frameLeft,
            top: frameTop,
            width: canvasSize.width,
            height: canvasSize.height,
          });
          canvas.renderAll();
        }
      } catch (error) {
        console.error('Error setting frame size:', error);
      }
    });
  }, [canvas, canvasSize]);

  useEffect(() => {
    if (!canvas) return;

    canvas.isDrawingMode = activeTool === "draw";
    canvas.selection = activeTool === "select";

    if (activeTool === "draw" && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = "#000000";
      canvas.freeDrawingBrush.width = 2;
    }
  }, [activeTool, canvas]);

  // Handle image upload via drag & drop or paste
  useEffect(() => {
    if (!canvas) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const imageUrl = event.target?.result as string;
              loadImageToCanvas(imageUrl, "粘贴的图片");
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    };

    const handleAddImage = (e: CustomEvent) => {
      const { imageUrl, name } = e.detail;
      loadImageToCanvas(imageUrl, name);
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('addImageToCanvas', handleAddImage as EventListener);
    
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('addImageToCanvas', handleAddImage as EventListener);
    };
  }, [canvas]);

  const loadImageToCanvas = (imageUrl: string, name: string = "图片") => {
    if (!canvas || !frameRef.current) return;

    FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' }).then(img => {
      if (!img) return;
      
      const frame = frameRef.current!;
      const frameWidth = frame.width || 1024;
      const frameHeight = frame.height || 768;
      const imgWidth = img.width || 1;
      const imgHeight = img.height || 1;
      const scaleX = frameWidth / imgWidth;
      const scaleY = frameHeight / imgHeight;
      const scale = Math.min(scaleX, scaleY, 1);
      
      img.scale(scale);
      img.set({
        left: (frame.left || 0) + (frameWidth - imgWidth * scale) / 2,
        top: (frame.top || 0) + (frameHeight - imgHeight * scale) / 2,
      });
      
      canvas.add(img);
      canvas.bringObjectToFront(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      saveStateRef.current();
      toast.success("图片已添加");
    }).catch(error => {
      console.error('Error loading image:', error);
      toast.error("图片加载失败");
    });
  };

  // Handle mouse wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Prevent default scrolling
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        
        const delta = e.deltaY;
        const zoomChange = delta > 0 ? -10 : 10;
        const newZoom = Math.max(10, Math.min(200, zoom + zoomChange));
        
        onZoomChange(newZoom);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [zoom, onZoomChange]);

  // Handle pan with left click when pan tool is active
  useEffect(() => {
    if (!canvas) return;
    const container = containerRef.current;
    if (!container) return;

    const handleCanvasMouseDown = (e: any) => {
      // Pan mode: pan on any click
      if (activeTool === "pan" && e.e.button === 0) {
        isPanningRef.current = true;
        panStartRef.current = {
          x: e.e.clientX + container.scrollLeft,
          y: e.e.clientY + container.scrollTop
        };
        container.style.cursor = 'grabbing';
        canvas.selection = false;
      }
      // Select mode: pan only on empty area
      else if (activeTool === "select" && !e.target && e.e.button === 0) {
        isPanningRef.current = true;
        panStartRef.current = {
          x: e.e.clientX + container.scrollLeft,
          y: e.e.clientY + container.scrollTop
        };
        container.style.cursor = 'grabbing';
        canvas.selection = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isPanningRef.current) {
        e.preventDefault();
        const dx = panStartRef.current.x - e.clientX;
        const dy = panStartRef.current.y - e.clientY;
        container.scrollLeft = dx;
        container.scrollTop = dy;
      }
    };

    const handleMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        container.style.cursor = activeTool === "pan" ? 'grab' : '';
        canvas.selection = activeTool === "select";
      }
    };

    const handleMouseLeave = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        container.style.cursor = activeTool === "pan" ? 'grab' : '';
        canvas.selection = activeTool === "select";
      }
    };

    // Set cursor based on active tool
    if (activeTool === "pan") {
      container.style.cursor = 'grab';
    } else {
      container.style.cursor = '';
    }

    canvas.on('mouse:down', handleCanvasMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      canvas.off('mouse:down', handleCanvasMouseDown);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.style.cursor = '';
    };
  }, [canvas, activeTool]);

  return (
    <div 
      ref={containerRef}
      className="h-full bg-muted/20 overflow-auto"
    >
      <div 
        style={{ 
          width: `${INFINITE_CANVAS_SIZE}px`,
          height: `${INFINITE_CANVAS_SIZE}px`,
        }}
      >
        <div 
          className="transition-transform"
          style={{ 
            transform: `scale(${zoom / 100})`, 
            transformOrigin: 'center',
            width: `${INFINITE_CANVAS_SIZE}px`,
            height: `${INFINITE_CANVAS_SIZE}px`,
          }}
        >
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
};
