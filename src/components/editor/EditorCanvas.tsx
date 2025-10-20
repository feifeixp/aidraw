import { useEffect, useRef, useLayoutEffect } from "react";
import { Canvas as FabricCanvas, FabricImage, Rect, PencilBrush } from "fabric";
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
  eraserBrushSize?: number;
  activeFrameId: string | null;
  onActiveFrameChange: (frameId: string | null) => void;
}

export const EditorCanvas = ({
  canvas,
  setCanvas,
  activeTool,
  saveState,
  canvasSize,
  zoom,
  onZoomChange,
  eraserBrushSize = 20,
  activeFrameId,
  onActiveFrameChange
}: EditorCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveStateRef = useRef(saveState);
  const activeToolRef = useRef(activeTool);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<Rect | null>(null);
  const frameBorderRef = useRef<Rect | null>(null);
  
  const prevZoomRef = useRef(zoom);
  
  // Keep saveStateRef and activeToolRef up to date
  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

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
      stroke: "#d1d5db",
      strokeWidth: 1,
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
    
    // 创建边界线（仅用于视觉参考，不可选择，不会被导出）
    const frameBorder = new Rect({
      left: frameLeft,
      top: frameTop,
      width: frameWidth,
      height: frameHeight,
      fill: 'transparent',
      stroke: '#3b82f6',
      strokeWidth: 2,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      hoverCursor: 'default',
      name: 'frameBorder',
    });
    
    fabricCanvas.add(frameBorder);
    frameBorderRef.current = frameBorder;
    
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
            // 不删除frame、边界线和分镜相关对象
            const objName = (obj as any).name || '';
            const isProtected = objName === 'workframe' || 
                              objName === 'frameBorder' ||
                              objName.startsWith('storyboard-');
            if (!isProtected) {
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

    // Handle mouse down to detect storyboard frame clicks
    const handleMouseDown = (e: any) => {
      const pointer = fabricCanvas.getPointer(e.e);
      const clickedObjects = fabricCanvas.getObjects().filter((obj: any) => {
        const objName = obj.name || '';
        if (objName.startsWith('storyboard-frame-')) {
          const objLeft = obj.left || 0;
          const objTop = obj.top || 0;
          const objWidth = obj.width || 0;
          const objHeight = obj.height || 0;
          return pointer.x >= objLeft && pointer.x <= objLeft + objWidth &&
                 pointer.y >= objTop && pointer.y <= objTop + objHeight;
        }
        return false;
      });

      if (clickedObjects.length > 0) {
        const clickedFrame = clickedObjects[0];
        const frameName = (clickedFrame as any).name;
        const frameNumber = frameName.replace('storyboard-frame-', '');
        onActiveFrameChange(frameNumber);
        
        // Update all storyboard borders visibility
        fabricCanvas.getObjects().forEach((obj: any) => {
          const objName = obj.name || '';
          if (objName.startsWith('storyboard-border-')) {
            const borderNumber = objName.replace('storyboard-border-', '');
            obj.set({ visible: borderNumber === frameNumber });
          }
        });
        fabricCanvas.renderAll();
      } else {
        // Check if clicked on main workframe
        const workframe = fabricCanvas.getObjects().find((obj: any) => obj.name === 'workframe');
        if (workframe) {
          const objLeft = workframe.left || 0;
          const objTop = workframe.top || 0;
          const objWidth = workframe.width || 0;
          const objHeight = workframe.height || 0;
          if (pointer.x >= objLeft && pointer.x <= objLeft + objWidth &&
              pointer.y >= objTop && pointer.y <= objTop + objHeight) {
            onActiveFrameChange(null);
            // Hide all storyboard borders
            fabricCanvas.getObjects().forEach((obj: any) => {
              const objName = obj.name || '';
              if (objName.startsWith('storyboard-border-')) {
                obj.set({ visible: false });
              }
            });
            fabricCanvas.renderAll();
          }
        }
      }
    };

    const handleObjectAdded = () => {
      // Ensure frame always stays at the back when new objects are added
      if (frameRef.current) {
        fabricCanvas.sendObjectToBack(frameRef.current);
      }
      
      // 确保所有分镜frame也在底层
      fabricCanvas.getObjects().forEach(obj => {
        const objName = (obj as any).name || '';
        if (objName.startsWith('storyboard-frame-')) {
          fabricCanvas.sendObjectToBack(obj);
        }
      });
      
      // Ensure all borders stay on top (main frame border and storyboard borders)
      if (frameBorderRef.current) {
        fabricCanvas.bringObjectToFront(frameBorderRef.current);
      }
      fabricCanvas.getObjects().forEach(obj => {
        const objName = (obj as any).name || '';
        if (objName.startsWith('storyboard-border-')) {
          fabricCanvas.bringObjectToFront(obj);
        }
      });
    };

    // Handle path created for eraser tool
    const handlePathCreated = (e: any) => {
      const path = e.path;
      if (path) {
        // Set globalCompositeOperation on the path object itself
        // This is crucial for eraser to work properly
        if (activeToolRef.current === 'eraser') {
          (path as any).globalCompositeOperation = 'destination-out';
        } else {
          (path as any).globalCompositeOperation = 'source-over';
        }
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
    fabricCanvas.on('path:created', handlePathCreated);
    fabricCanvas.on('mouse:down', handleMouseDown);
    canvasElement.addEventListener('dblclick', handleCanvasDoubleClick);
    window.addEventListener('keydown', handleKeyDown);
    setCanvas(fabricCanvas);

    return () => {
      fabricCanvas.off('object:modified', handleObjectModified);
      fabricCanvas.off('object:added', handleObjectAdded);
      fabricCanvas.off('path:created', handlePathCreated);
      fabricCanvas.off('mouse:down', handleMouseDown);
      if (canvasElement) {
        canvasElement.removeEventListener('dblclick', handleCanvasDoubleClick);
      }
      window.removeEventListener('keydown', handleKeyDown);
      fabricCanvas.dispose();
      frameRef.current = null;
      frameBorderRef.current = null;
    };
  }, [setCanvas]); // Only run once on mount

  // Update frame size when canvasSize prop changes
  useEffect(() => {
    if (!canvas || !canvasSize || !frameRef.current) return;
    
    requestAnimationFrame(() => {
      try {
        const frame = frameRef.current;
        const frameBorder = frameBorderRef.current;
        
        if (frame) {
          const frameLeft = (INFINITE_CANVAS_SIZE - canvasSize.width) / 2;
          const frameTop = (INFINITE_CANVAS_SIZE - canvasSize.height) / 2;
          
          frame.set({
            left: frameLeft,
            top: frameTop,
            width: canvasSize.width,
            height: canvasSize.height,
          });
          
          // 同时更新边界线
          if (frameBorder) {
            frameBorder.set({
              left: frameLeft,
              top: frameTop,
              width: canvasSize.width,
              height: canvasSize.height,
            });
          }
          
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

    canvas.isDrawingMode = activeTool === "draw" || activeTool === "eraser";
    canvas.selection = activeTool === "select";

    if (activeTool === "draw") {
      if (!canvas.freeDrawingBrush || canvas.freeDrawingBrush.constructor.name !== 'PencilBrush') {
        canvas.freeDrawingBrush = new PencilBrush(canvas);
      }
      canvas.freeDrawingBrush.color = "#000000";
      canvas.freeDrawingBrush.width = 2;
      // @ts-ignore
      canvas.freeDrawingBrush.globalCompositeOperation = "source-over";
    } else if (activeTool === "eraser") {
      // 强制重新创建brush以确保擦除模式正确
      canvas.freeDrawingBrush = new PencilBrush(canvas);
      // 设置擦除参数
      canvas.freeDrawingBrush.color = "rgba(0,0,0,1)"; // 颜色在destination-out模式下不重要，但需要设置
      canvas.freeDrawingBrush.width = eraserBrushSize;
      // @ts-ignore - 设置为destination-out以实现真正的擦除（在透明通道绘制）
      canvas.freeDrawingBrush.globalCompositeOperation = "destination-out";
      canvas.isDrawingMode = true;
    }
  }, [activeTool, canvas, eraserBrushSize]);

  // 修正 Fabric.js 的鼠标坐标以匹配 CSS 缩放
  useEffect(() => {
    if (!canvas) return;
    
    const scale = zoom / 100;
    
    // 保存原始的 getPointer 方法
    const originalGetPointer = canvas.getPointer.bind(canvas);
    
    // 覆盖 getPointer 方法来修正 CSS 缩放
    canvas.getPointer = function(e: any, ignoreZoom?: boolean) {
      const pointer = originalGetPointer(e, ignoreZoom);
      // 除以 CSS 缩放比例来获取真实的画布坐标
      pointer.x = pointer.x / scale;
      pointer.y = pointer.y / scale;
      return pointer;
    };
    
    canvas.renderAll();
    
    // 清理函数：恢复原始方法
    return () => {
      canvas.getPointer = originalGetPointer;
    };
  }, [canvas, zoom]);

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
      const { imageUrl, name, elementType } = e.detail;
      loadImageToCanvas(imageUrl, name, elementType);
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('addImageToCanvas', handleAddImage as EventListener);
    
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('addImageToCanvas', handleAddImage as EventListener);
    };
  }, [canvas]);

  const loadImageToCanvas = async (imageUrl: string, name: string = "图片", elementType?: string) => {
    if (!canvas || !frameRef.current) return;

    FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' }).then(async img => {
      if (!img) return;
      
      // 根据activeFrameId查找目标frame
      let targetFrame = frameRef.current!;
      if (activeFrameId) {
        const storyboardFrame = canvas.getObjects().find(
          obj => (obj as any).name === `storyboard-frame-${activeFrameId}`
        );
        if (storyboardFrame) {
          targetFrame = storyboardFrame as any;
        }
      }
      
      const frameWidth = targetFrame.width || 1024;
      const frameHeight = targetFrame.height || 768;
      const imgWidth = img.width || 1;
      const imgHeight = img.height || 1;
      const scaleX = frameWidth / imgWidth;
      const scaleY = frameHeight / imgHeight;
      const scale = Math.min(scaleX, scaleY, 1);
      
      img.scale(scale);
      img.set({
        left: (targetFrame.left || 0) + (frameWidth - imgWidth * scale) / 2,
        top: (targetFrame.top || 0) + (frameHeight - imgHeight * scale) / 2,
        data: { elementType: elementType || 'character' }
      });
      
      // Use layer sorting system to insert at correct position
      const { insertObjectWithLayerType } = await import("@/lib/layerSorting");
      insertObjectWithLayerType(canvas, img, (elementType || 'character') as any);
      
      canvas.setActiveObject(img);
      canvas.renderAll();
      
      // Ensure frame stays at the back and frameBorder on top
      if (frameRef.current) {
        canvas.sendObjectToBack(frameRef.current);
      }
      
      // 确保所有分镜frame也在底层
      canvas.getObjects().forEach(obj => {
        const objName = (obj as any).name || '';
        if (objName.startsWith('storyboard-frame-')) {
          canvas.sendObjectToBack(obj);
        }
      });
      
      if (frameBorderRef.current) {
        canvas.bringObjectToFront(frameBorderRef.current);
      }
      
      // 确保所有分镜border在顶层
      canvas.getObjects().forEach(obj => {
        const objName = (obj as any).name || '';
        if (objName.startsWith('storyboard-border-')) {
          canvas.bringObjectToFront(obj);
        }
      });
      
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
    if (!container || !frameRef.current) return;

    let rafId: number | null = null;

    const handleWheel = (e: WheelEvent) => {
      // Prevent default scrolling
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        
        // 取消之前的动画帧
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }

        // 使用 requestAnimationFrame 保证流畅更新
        rafId = requestAnimationFrame(() => {
          const delta = e.deltaY;
          const zoomChange = delta > 0 ? -2 : 2;
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
          
          // 先触发缩放状态更新
          onZoomChange(newZoom);
          
          // 在下一帧同步设置滚动位置，确保在DOM更新后立即执行
          requestAnimationFrame(() => {
            container.scrollLeft = targetScrollLeft;
            container.scrollTop = targetScrollTop;
          });
          
          rafId = null;
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [zoom, onZoomChange]);

  // Handle zoom changes from slider - keep viewport center fixed
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !frameRef.current) return;
    
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
