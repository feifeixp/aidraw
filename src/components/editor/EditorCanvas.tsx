import { useEffect, useRef, useLayoutEffect } from "react";
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
  
  // 用于存储待应用的滚动位置
  const pendingScrollRef = useRef<{ left: number; top: number } | null>(null);
  const isZoomingRef = useRef(false);
  const prevZoomRef = useRef(zoom);
  
  // Keep saveStateRef up to date
  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  useEffect(() => {
    if (!canvasRef.current) {
      console.log('Canvas ref is null, skipping initialization');
      return;
    }

    console.log('=== Initializing Canvas ===');
    console.log('Canvas element:', canvasRef.current);
    console.log('Canvas element width attr:', canvasRef.current.width);
    console.log('Canvas element height attr:', canvasRef.current.height);
    console.log('Canvas size:', canvasSize);
    console.log('Infinite canvas size:', INFINITE_CANVAS_SIZE);

    const fabricCanvas = new FabricCanvas(canvasRef.current, {
      width: INFINITE_CANVAS_SIZE,
      height: INFINITE_CANVAS_SIZE,
      backgroundColor: "#e5e5e5",
      preserveObjectStacking: true,
      enableRetinaScaling: false, // 禁用高DPI缩放
    });

    console.log('Fabric canvas created:', fabricCanvas);
    console.log('Fabric canvas width:', fabricCanvas.width);
    console.log('Fabric canvas height:', fabricCanvas.height);
    console.log('Canvas element after Fabric init:', canvasRef.current.width, canvasRef.current.height);
    
    // Verify canvas dimensions are correct
    if (canvasRef.current.width !== INFINITE_CANVAS_SIZE || canvasRef.current.height !== INFINITE_CANVAS_SIZE) {
      console.warn('Canvas dimensions changed by Fabric! Resetting...');
      fabricCanvas.setDimensions({
        width: INFINITE_CANVAS_SIZE,
        height: INFINITE_CANVAS_SIZE
      });
      console.log('Canvas dimensions after reset:', canvasRef.current.width, canvasRef.current.height);
    }


    // 创建frame（工作区域）
    const frameWidth = canvasSize?.width || 1024;
    const frameHeight = canvasSize?.height || 768;
    const frameLeft = (INFINITE_CANVAS_SIZE - frameWidth) / 2;
    const frameTop = (INFINITE_CANVAS_SIZE - frameHeight) / 2;

    console.log('Creating frame:', { frameWidth, frameHeight, frameLeft, frameTop });

    const frame = new Rect({
      left: frameLeft,
      top: frameTop,
      width: frameWidth,
      height: frameHeight,
      fill: "#ffffff",
      stroke: "#ff0000",
      strokeWidth: 8,
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      hoverCursor: 'default',
      name: 'workframe',
    });

    fabricCanvas.add(frame);
    fabricCanvas.sendObjectToBack(frame);
    frameRef.current = frame;
    
    // Store frame reference on canvas for other components to access
    (fabricCanvas as any).workFrame = frame;
    
    // Force immediate render
    fabricCanvas.renderAll();
    
    console.log('Frame added to canvas');
    console.log('Canvas objects count:', fabricCanvas.getObjects().length);
    console.log('Canvas objects:', fabricCanvas.getObjects());
    console.log('Frame visibility check:', {
      frameLeft,
      frameTop,
      frameWidth,
      frameHeight,
      canvasWidth: fabricCanvas.width,
      canvasHeight: fabricCanvas.height,
      frameVisible: frame.visible,
      frameFill: frame.fill,
      frameStroke: frame.stroke
    });
    
    // Force another render after a delay to ensure visibility
    setTimeout(() => {
      fabricCanvas.renderAll();
      console.log('Forced second render complete');
    }, 100);

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

    const handleObjectAdded = () => {
      // Ensure frame always stays at the back when new objects are added
      if (frameRef.current) {
        fabricCanvas.sendObjectToBack(frameRef.current);
      }
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
    fabricCanvas.on('object:added', handleObjectAdded);
    canvasElement.addEventListener('dblclick', handleCanvasDoubleClick);
    window.addEventListener('keydown', handleKeyDown);
    setCanvas(fabricCanvas);

    return () => {
      fabricCanvas.off('object:modified', handleObjectModified);
      fabricCanvas.off('object:added', handleObjectAdded);
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
          // Update frame reference on canvas
          (canvas as any).workFrame = frame;
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

  // Center view to frame on initial load only
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !canvas) return;

    const centerView = () => {
      const scale = zoom / 100;
      // 计算缩放后的画布中心点位置
      const scaledCanvasSize = INFINITE_CANVAS_SIZE * scale;
      const centerX = scaledCanvasSize / 2;
      const centerY = scaledCanvasSize / 2;
      
      // 将容器滚动到中心点
      container.scrollLeft = centerX - container.clientWidth / 2;
      container.scrollTop = centerY - container.clientHeight / 2;
      
      console.log('Centering view:', {
        zoom,
        scale,
        scaledCanvasSize,
        centerX,
        centerY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
        containerWidth: container.clientWidth,
        containerHeight: container.clientHeight
      });
    };

    // Small delay to ensure DOM is ready - only on initial canvas load
    const timer = setTimeout(centerView, 100);
    return () => clearTimeout(timer);
  }, [canvas]); // Remove zoom dependency to prevent re-centering on zoom

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
      canvas.setActiveObject(img);
      canvas.renderAll();
      
      // Ensure frame stays at the back
      if (frameRef.current) {
        canvas.sendObjectToBack(frameRef.current);
        canvas.renderAll();
      }
      
      saveStateRef.current();
      toast.success("图片已添加");
    }).catch(error => {
      console.error('Error loading image:', error);
      toast.error("图片加载失败");
    });
  };

  // 在缩放后立即应用滚动位置（在浏览器绘制前）
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !pendingScrollRef.current || !isZoomingRef.current) return;
  
    // 应用待处理的滚动位置
    container.scrollLeft = pendingScrollRef.current.left;
    container.scrollTop = pendingScrollRef.current.top;
  
    // 清空待处理状态
    pendingScrollRef.current = null;
    isZoomingRef.current = false;
  }, [zoom]);

  // Handle mouse wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !frameRef.current) return;

    let wheelTimeout: NodeJS.Timeout | null = null;

    const handleWheel = (e: WheelEvent) => {
      // Prevent default scrolling
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        
        // 清除之前的延迟执行
        if (wheelTimeout) {
          clearTimeout(wheelTimeout);
        }

        // 使用节流来减少更新频率
        wheelTimeout = setTimeout(() => {
          const delta = e.deltaY;
          const zoomChange = delta > 0 ? -5 : 5; // 增大步长，减少更新次数
          const newZoom = Math.max(10, Math.min(200, zoom + zoomChange));
          
          if (newZoom === zoom) return;
          
          const oldScale = zoom / 100;
          const newScale = newZoom / 100;
          
          // 获取鼠标相对于容器的位置
          const rect = container.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          
          // 计算鼠标下的画布坐标点
          const canvasX = (container.scrollLeft + mouseX) / oldScale;
          const canvasY = (container.scrollTop + mouseY) / oldScale;
          
          // 计算新的滚动位置以保持鼠标点位置不变
          const targetScrollLeft = canvasX * newScale - mouseX;
          const targetScrollTop = canvasY * newScale - mouseY;
          
          // 存储待应用的滚动位置
          pendingScrollRef.current = { 
            left: targetScrollLeft, 
            top: targetScrollTop 
          };
          isZoomingRef.current = true;
          
          // 触发缩放状态更新
          onZoomChange(newZoom);
        }, 10); // 10ms 节流
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (wheelTimeout) {
        clearTimeout(wheelTimeout);
      }
    };
  }, [zoom, onZoomChange]);

  // Handle zoom changes from slider - keep viewport center fixed
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !frameRef.current) return;
    
    // Skip if this zoom change was triggered by wheel zoom
    if (isZoomingRef.current) return;
    
    // Skip on initial mount
    if (prevZoomRef.current === zoom) return;
    
    const oldScale = prevZoomRef.current / 100;
    const newScale = zoom / 100;
    
    // Get viewport center position
    const viewportCenterX = container.clientWidth / 2;
    const viewportCenterY = container.clientHeight / 2;
    
    // Calculate canvas coordinates at viewport center (before zoom)
    const canvasX = (container.scrollLeft + viewportCenterX) / oldScale;
    const canvasY = (container.scrollTop + viewportCenterY) / oldScale;
    
    // Calculate target scroll position to keep viewport center fixed
    const targetScrollLeft = canvasX * newScale - viewportCenterX;
    const targetScrollTop = canvasY * newScale - viewportCenterY;
    
    // Update scroll position
    container.scrollLeft = targetScrollLeft;
    container.scrollTop = targetScrollTop;
    
    // Update previous zoom
    prevZoomRef.current = zoom;
  }, [zoom]);

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

  const scale = zoom / 100;
  
  return (
    <div 
      ref={containerRef}
      className="h-full bg-gray-200 overflow-auto relative"
    >
      <div 
        style={{ 
          width: `${INFINITE_CANVAS_SIZE * scale}px`,
          height: `${INFINITE_CANVAS_SIZE * scale}px`,
          position: 'relative',
        }}
      >
        <canvas 
          ref={canvasRef}
          width={INFINITE_CANVAS_SIZE}
          height={INFINITE_CANVAS_SIZE}
          style={{
            display: 'block',
            width: `${INFINITE_CANVAS_SIZE * scale}px`,
            height: `${INFINITE_CANVAS_SIZE * scale}px`,
          }}
        />
      </div>
    </div>
  );
};
