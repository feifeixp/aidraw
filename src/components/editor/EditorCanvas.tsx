import { useEffect, useRef, useLayoutEffect } from "react";
import { Canvas as FabricCanvas, FabricImage, Rect, PencilBrush, FabricText } from "fabric";
import { toast } from "sonner";

// 无限画布的实际尺寸
const INFINITE_CANVAS_SIZE = 10000;

interface EditorCanvasProps {
  canvas: FabricCanvas | null;
  setCanvas: (canvas: FabricCanvas) => void;
  activeTool: string;
  saveState: () => void;
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
  const activeFrameIdRef = useRef(activeFrameId);
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
    activeFrameIdRef.current = activeFrameId;
  }, [activeFrameId]);

  useEffect(() => {
    if (!canvasRef.current) {
      console.log('Canvas ref is null, skipping initialization');
      return;
    }

    console.log('[EditorCanvas] ======== useEffect开始运行 - 初始化画布 ========');
    console.log('Canvas element:', canvasRef.current);
    console.log('Canvas element width attr:', canvasRef.current.width);
    console.log('Canvas element height attr:', canvasRef.current.height);
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

    // 创建默认第一个分镜（使用统一的网格布局规则）
    const COLS = 5; // 5列
    const ROWS = 8; // 8行
    const DEFAULT_FRAME_WIDTH = 1024;
    const DEFAULT_FRAME_HEIGHT = 768;
    const SPACING = 50; // 间距
    
    // 计算整个网格的尺寸
    const totalWidth = COLS * DEFAULT_FRAME_WIDTH + (COLS - 1) * SPACING;
    const totalHeight = ROWS * DEFAULT_FRAME_HEIGHT + (ROWS - 1) * SPACING;
    
    // 计算起始位置（居中）
    const START_X = (INFINITE_CANVAS_SIZE - totalWidth) / 2;
    const START_Y = (INFINITE_CANVAS_SIZE - totalHeight) / 2;
    
    // 第一个分镜在网格的(0,0)位置
    const frameLeft = START_X;
    const frameTop = START_Y;

    console.log('[EditorCanvas] 准备创建默认分镜，检查是否已存在...画布对象数量:', fabricCanvas.getObjects().length);
    
    // 检查是否已经存在这些对象（防止重复创建）
    const existingFrame = fabricCanvas.getObjects().find((obj: any) => obj.name === 'storyboard-frame-1');
    const existingBorder = fabricCanvas.getObjects().find((obj: any) => obj.name === 'storyboard-border-1');
    const existingNumber = fabricCanvas.getObjects().find((obj: any) => obj.name === 'storyboard-number-1');
    
    if (existingFrame || existingBorder || existingNumber) {
      console.log('[EditorCanvas] 发现已存在的分镜对象，跳过创建:', {
        hasFrame: !!existingFrame,
        hasBorder: !!existingBorder,
        hasNumber: !!existingNumber,
        当前对象总数: fabricCanvas.getObjects().length
      });
      // 更新 refs 指向现有对象
      frameRef.current = existingFrame as Rect || null;
      frameBorderRef.current = existingBorder as Rect || null;
    } else {
      console.log('[EditorCanvas] 未找到现有分镜，创建新的默认分镜:', { frameLeft, frameTop, DEFAULT_FRAME_WIDTH, DEFAULT_FRAME_HEIGHT, 当前对象数: fabricCanvas.getObjects().length });

      // 创建第一个分镜frame
      const frame = new Rect({
      left: frameLeft,
      top: frameTop,
      width: DEFAULT_FRAME_WIDTH,
      height: DEFAULT_FRAME_HEIGHT,
      fill: "#ffffff",
      stroke: "#d1d5db",
      strokeWidth: 1,
      selectable: false,
      evented: true,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      hoverCursor: 'pointer',
      name: 'storyboard-frame-1',
    });

    fabricCanvas.add(frame);
    fabricCanvas.sendObjectToBack(frame);
    frameRef.current = frame;
    
    // 创建第一个分镜的边界线
    const frameBorder = new Rect({
      left: frameLeft,
      top: frameTop,
      width: DEFAULT_FRAME_WIDTH,
      height: DEFAULT_FRAME_HEIGHT,
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
      name: 'storyboard-border-1',
      visible: true, // 默认显示第一个分镜边框
    });
    
    fabricCanvas.add(frameBorder);
    frameBorderRef.current = frameBorder;
    
    // 创建第一个分镜的编号（显示在分镜外左上方，与分镜左边对齐）
    const frameNumber = new FabricText('Shot-01', {
      left: frameLeft,
      top: frameTop - 20,
      fontSize: 14,
      fill: '#666666',
      selectable: false,
      evented: false,
      name: 'storyboard-number-1'
    });
    
    fabricCanvas.add(frameNumber);
    
    console.log('[EditorCanvas] 默认分镜创建完成');
    }
    
    // Force immediate render
    fabricCanvas.renderAll();
    
    console.log('[EditorCanvas] 当前画布对象数量:', fabricCanvas.getObjects().length);
    
    // Force another render after a delay to ensure visibility
    setTimeout(() => {
      fabricCanvas.renderAll();
      console.log('[EditorCanvas] 强制第二次渲染完成');
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
            const isProtected = objName.startsWith('storyboard-');
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
        // Check if clicked on any storyboard frame
        const clickedOnFrame = fabricCanvas.getObjects().find((obj: any) => {
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

        if (!clickedOnFrame) {
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
    };

    const handleObjectAdded = (e: any) => {
      const addedObj = e.target;
      console.log('[EditorCanvas] 对象添加事件触发:', {
        type: addedObj?.type,
        name: addedObj?.name || 'unnamed',
        当前总对象数: fabricCanvas.getObjects().length
      });
      
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
    
    // 在恢复状态前移除 object:added 监听器，避免重复对象
    const handleBeforeRestore = () => {
      console.log('[EditorCanvas] 准备恢复状态，临时移除 object:added 监听器');
      fabricCanvas.off('object:added', handleObjectAdded);
    };
    window.addEventListener('beforeCanvasRestore', handleBeforeRestore);
    
    // 监听画布状态恢复事件，更新refs
    const handleStateRestored = () => {
      console.log('[EditorCanvas] ======== 开始处理状态恢复 ========');
      
      // 重新添加 object:added 监听器
      console.log('[EditorCanvas] 重新添加 object:added 监听器');
      fabricCanvas.on('object:added', handleObjectAdded);
      
      const objectsBefore = fabricCanvas.getObjects();
      console.log('[EditorCanvas] 状态恢复前对象数量:', objectsBefore.length);
      console.log('[EditorCanvas] 状态恢复前所有对象:', objectsBefore.map((obj: any) => ({
        type: obj.type,
        name: obj.name || 'unnamed'
      })));
      
      const foundFrame = objectsBefore.find((obj: any) => obj.name === 'storyboard-frame-1') as Rect || null;
      const foundBorder = objectsBefore.find((obj: any) => obj.name === 'storyboard-border-1') as Rect || null;
      
      console.log('[EditorCanvas] 找到的对象:', {
        hasFrame: !!foundFrame,
        hasBorder: !!foundBorder,
        frameId: foundFrame ? (foundFrame as any).id : 'none',
        borderId: foundBorder ? (foundBorder as any).id : 'none'
      });
      
      frameRef.current = foundFrame;
      frameBorderRef.current = foundBorder;
      
      // 验证是否有重复创建
      const objectsAfter = fabricCanvas.getObjects();
      console.log('[EditorCanvas] 状态恢复后对象数量:', objectsAfter.length);
      if (objectsAfter.length !== objectsBefore.length) {
        console.error('[EditorCanvas] ⚠️ 警告：状态恢复后对象数量发生了变化！', {
          before: objectsBefore.length,
          after: objectsAfter.length
        });
      }
      console.log('[EditorCanvas] ======== 状态恢复处理完成 ========');
    };
    window.addEventListener('canvasStateRestored', handleStateRestored);
    
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
      window.removeEventListener('beforeCanvasRestore', handleBeforeRestore);
      window.removeEventListener('canvasStateRestored', handleStateRestored);
      fabricCanvas.dispose();
      frameRef.current = null;
      frameBorderRef.current = null;
    };
  }, [setCanvas]); // Only run once on mount

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

  // Center view to Shot-01 at 80% zoom on initial load only
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !canvas) return;

    const centerView = () => {
      // 使用80%的固定缩放
      const scale = 0.8;
      
      // 计算Shot-01的中心位置（与创建分镜时的计算逻辑一致）
      const COLS = 5;
      const ROWS = 8;
      const DEFAULT_FRAME_WIDTH = 1024;
      const DEFAULT_FRAME_HEIGHT = 768;
      const SPACING = 50;
      
      const totalWidth = COLS * DEFAULT_FRAME_WIDTH + (COLS - 1) * SPACING;
      const totalHeight = ROWS * DEFAULT_FRAME_HEIGHT + (ROWS - 1) * SPACING;
      
      const START_X = (INFINITE_CANVAS_SIZE - totalWidth) / 2;
      const START_Y = (INFINITE_CANVAS_SIZE - totalHeight) / 2;
      
      // Shot-01的中心坐标
      const shot01CenterX = START_X + DEFAULT_FRAME_WIDTH / 2;
      const shot01CenterY = START_Y + DEFAULT_FRAME_HEIGHT / 2;
      
      // 计算缩放后Shot-01中心的位置
      const scaledCenterX = shot01CenterX * scale;
      const scaledCenterY = shot01CenterY * scale;
      
      // 将容器滚动到Shot-01的中心
      container.scrollLeft = scaledCenterX - container.clientWidth / 2;
      container.scrollTop = scaledCenterY - container.clientHeight / 2;
      
      console.log('Centering view to Shot-01:', {
        scale,
        shot01CenterX,
        shot01CenterY,
        scaledCenterX,
        scaledCenterY,
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
      
      // 根据activeFrameIdRef查找目标frame
      let targetFrame = frameRef.current!;
      if (activeFrameIdRef.current) {
        const storyboardFrame = canvas.getObjects().find(
          obj => (obj as any).name === `storyboard-frame-${activeFrameIdRef.current}`
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
