import { useEffect, useRef } from "react";
import { Canvas as FabricCanvas, FabricImage } from "fabric";
import { toast } from "sonner";

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
  
  // Keep saveStateRef up to date
  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const fabricCanvas = new FabricCanvas(canvasRef.current, {
      width: canvasSize?.width || 1024,
      height: canvasSize?.height || 768,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
    });

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
            fabricCanvas.remove(obj);
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

    return () => {
      fabricCanvas.off('object:modified', handleObjectModified);
      if (canvasElement) {
        canvasElement.removeEventListener('dblclick', handleCanvasDoubleClick);
      }
      window.removeEventListener('keydown', handleKeyDown);
      fabricCanvas.dispose();
    };
  }, [setCanvas]); // Only run once on mount

  // Update canvas size when canvasSize prop changes
  useEffect(() => {
    if (!canvas || !canvasSize) return;
    
    // Use requestAnimationFrame to ensure canvas is fully mounted
    requestAnimationFrame(() => {
      try {
        canvas.setWidth(canvasSize.width);
        canvas.setHeight(canvasSize.height);
        canvas.renderAll();
      } catch (error) {
        console.error('Error setting canvas size:', error);
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
    if (!canvas) return;

    FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' }).then(img => {
      if (!img) return;
      
      const canvasWidth = canvas.width || 1024;
      const canvasHeight = canvas.height || 768;
      const imgWidth = img.width || 1;
      const imgHeight = img.height || 1;
      const scaleX = canvasWidth / imgWidth;
      const scaleY = canvasHeight / imgHeight;
      const scale = Math.min(scaleX, scaleY, 1);
      
      img.scale(scale);
      img.set({
        left: (canvasWidth - imgWidth * scale) / 2,
        top: (canvasHeight - imgHeight * scale) / 2,
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
        className="flex items-center justify-center"
        style={{ 
          minWidth: `${(canvasSize.width || 1024) * 1.5}px`,
          minHeight: `${(canvasSize.height || 768) * 1.5}px`,
          padding: '25%'
        }}
      >
        <div 
          className="shadow-2xl transition-transform"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center' }}
        >
          <canvas ref={canvasRef} className="border border-border" />
        </div>
      </div>
    </div>
  );
};
