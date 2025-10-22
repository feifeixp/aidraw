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
  defaultFrameWidth?: number;
  defaultFrameHeight?: number;
  shouldCenterOnFrame?: boolean;
  onCenterComplete?: () => void;
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
  onActiveFrameChange,
  defaultFrameWidth = 1024,
  defaultFrameHeight = 576,
  shouldCenterOnFrame = false,
  onCenterComplete
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

    // 创建默认第一个分镜（使用纵向单列布局）
    const MAX_FRAMES = 12; // 最大分镜数量
    const DEFAULT_FRAME_WIDTH = defaultFrameWidth;
    const DEFAULT_FRAME_HEIGHT = defaultFrameHeight;
    const SPACING = 50; // 间距
    
    // 计算起始位置（水平和垂直都居中在无限画布中心）
    const START_X = (INFINITE_CANVAS_SIZE - DEFAULT_FRAME_WIDTH) / 2;
    const START_Y = (INFINITE_CANVAS_SIZE - DEFAULT_FRAME_HEIGHT) / 2;
    
    // 第一个分镜的位置
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

      // 创建第一个分镜frame（白色背景）
    const frame = new Rect({
      left: frameLeft,
      top: frameTop,
      width: DEFAULT_FRAME_WIDTH,
      height: DEFAULT_FRAME_HEIGHT,
      fill: 'white',
      stroke: '#d1d5db',
      strokeWidth: 1,
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      hoverCursor: 'default',
      name: 'storyboard-frame-1',
      data: { 
        isFrameElement: true,
        objectType: 'storyboard-frame',
        frameId: '1',
        objectName: 'storyboard-frame-1'
      },
    });

    fabricCanvas.add(frame);
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
      visible: false, // 初始不显示边框
      name: 'storyboard-border-1',
      data: { 
        isFrameElement: true,
        objectType: 'storyboard-border',
        frameId: '1',
        objectName: 'storyboard-border-1'
      },
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
      name: 'storyboard-number-1',
      data: { 
        isFrameElement: true,
        objectType: 'storyboard-number',
        frameId: '1',
        objectName: 'storyboard-number-1'
      },
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
      
      // 始终将视口移动到第一个分镜中心（无论是否设置了shouldCenterOnFrame）
      if (containerRef.current) {
        console.log('[EditorCanvas] 开始移动视口到分镜中心');
        
        // 获取视口尺寸
        const viewportWidth = containerRef.current.clientWidth;
        const viewportHeight = containerRef.current.clientHeight;
        
        // 计算分镜中心位置（使用实际的画布坐标）
        const frameCenterX = frameLeft + DEFAULT_FRAME_WIDTH / 2;
        const frameCenterY = frameTop + DEFAULT_FRAME_HEIGHT / 2;
        
        // 计算当前缩放比例（zoom 是百分比，需要转换为小数）
        const currentZoom = zoom / 100;
        
        // 计算需要的滚动位置，使分镜中心出现在视口中心
        // 注意：这里不使用 setViewportTransform，而是使用 scroll 来定位
        const targetScrollLeft = frameCenterX * currentZoom - viewportWidth / 2;
        const targetScrollTop = frameCenterY * currentZoom - viewportHeight / 2;
        
        containerRef.current.scrollLeft = targetScrollLeft;
        containerRef.current.scrollTop = targetScrollTop;
        
        console.log('[EditorCanvas] 视口移动完成', { frameCenterX, frameCenterY, targetScrollLeft, targetScrollTop, currentZoom });
        
        // 如果有回调，通知父组件完成
        if (shouldCenterOnFrame && onCenterComplete) {
          onCenterComplete();
        }
      }
    }, 100);

    // Add keyboard event listener for Delete key and frame navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input field
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.isContentEditable;
      
      // Don't process keyboard shortcuts if user is typing in an input field
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
        // 重新应用锁定状态
        frameRef.current.set({
          selectable: false,
          evented: true,
          hasControls: false,
          hasBorders: false,
          lockMovementX: true,
          lockMovementY: true,
          hoverCursor: 'pointer'
        });
      }
      
      // 确保所有分镜frame也在底层，并重新应用锁定状态
      fabricCanvas.getObjects().forEach(obj => {
        const objName = (obj as any).name || '';
        if (objName.startsWith('storyboard-frame-')) {
          fabricCanvas.sendObjectToBack(obj);
          obj.set({
            selectable: false,
            evented: true,
            hasControls: false,
            hasBorders: false,
            lockMovementX: true,
            lockMovementY: true,
            hoverCursor: 'pointer'
          });
        }
      });
      
      // Ensure all borders stay on top (main frame border and storyboard borders)
      if (frameBorderRef.current) {
        fabricCanvas.bringObjectToFront(frameBorderRef.current);
        // 重新应用锁定状态
        frameBorderRef.current.set({
          selectable: false,
          evented: false,
          hasControls: false,
          hasBorders: false,
          lockMovementX: true,
          lockMovementY: true
        });
      }
      fabricCanvas.getObjects().forEach(obj => {
        const objName = (obj as any).name || '';
        if (objName.startsWith('storyboard-border-')) {
          fabricCanvas.bringObjectToFront(obj);
          obj.set({
            selectable: false,
            evented: false,
            hasControls: false,
            hasBorders: false,
            lockMovementX: true,
            lockMovementY: true
          });
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
      console.log('[EditorCanvas] 状态恢复：重新添加监听器并更新refs');
      
      // 重新添加 object:added 监听器
      fabricCanvas.on('object:added', handleObjectAdded);
      
      // 查找所有框架元素
      const allObjects = fabricCanvas.getObjects();
      const allFrames: Rect[] = [];
      const allBorders: Rect[] = [];
      const allNumbers: any[] = [];
      
      allObjects.forEach((obj: any) => {
        const objData = obj.data || {};
        
        if (objData.objectType === 'storyboard-frame') {
          allFrames.push(obj as Rect);
          // 确保锁定状态
          obj.set({
            selectable: false,
            evented: true,
            hasControls: false,
            hasBorders: false,
            lockMovementX: true,
            lockMovementY: true,
            hoverCursor: 'pointer'
          });
          fabricCanvas.sendObjectToBack(obj);
        } else if (objData.objectType === 'storyboard-border') {
          allBorders.push(obj as Rect);
          obj.set({
            selectable: false,
            evented: false,
            hasControls: false,
            hasBorders: false,
            lockMovementX: true,
            lockMovementY: true
          });
          fabricCanvas.bringObjectToFront(obj);
        } else if (objData.objectType === 'storyboard-number') {
          allNumbers.push(obj);
          obj.set({
            selectable: false,
            evented: false
          });
          fabricCanvas.bringObjectToFront(obj);
        }
      });
      
      // 更新refs指向第一个分镜
      frameRef.current = allFrames.find((obj: any) => obj.data?.frameId === '1') || null;
      frameBorderRef.current = allBorders.find((obj: any) => obj.data?.frameId === '1') || null;
      
      console.log('[EditorCanvas] 找到框架元素:', {
        frames: allFrames.length,
        borders: allBorders.length,
        numbers: allNumbers.length,
        hasRef: !!frameRef.current
      });
      
      fabricCanvas.requestRenderAll();
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

  // 注意：这里已移除旧的居中逻辑，因为现在使用单列布局而不是网格布局
  // 居中功能已整合到初始化逻辑中（第223-253行）

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
    if (!canvas) return;

    // 如果frameRef为空，尝试从画布中查找
    if (!frameRef.current) {
      const foundFrame = canvas.getObjects().find((obj: any) => obj.name === 'storyboard-frame-1');
      if (foundFrame) {
        frameRef.current = foundFrame as Rect;
        console.log('[EditorCanvas] loadImageToCanvas: 从画布中找到frame并更新ref');
      } else {
        console.error('[EditorCanvas] loadImageToCanvas: 无法找到frame对象');
        toast.error("画布未初始化");
        return;
      }
    }

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
      
      // First, ensure all frames are at the bottom
      const allObjects = canvas.getObjects();
      allObjects.forEach(obj => {
        const objName = (obj as any).name || '';
        if (objName.startsWith('storyboard-frame-') || obj === frameRef.current) {
          canvas.sendObjectToBack(obj);
          obj.set({
            selectable: false,
            evented: true,
            hasControls: false,
            hasBorders: false,
            lockMovementX: true,
            lockMovementY: true,
            hoverCursor: 'pointer'
          });
        }
      });
      
      // Use layer sorting system to insert at correct position
      const { insertObjectWithLayerType } = await import("@/lib/layerSorting");
      insertObjectWithLayerType(canvas, img, (elementType || 'character') as any);
      
      canvas.setActiveObject(img);
      
      if (frameBorderRef.current) {
        canvas.bringObjectToFront(frameBorderRef.current);
        // 重新应用锁定状态
        frameBorderRef.current.set({
          selectable: false,
          evented: false,
          hasControls: false,
          hasBorders: false,
          lockMovementX: true,
          lockMovementY: true
        });
      }
      
      // 确保所有分镜border在顶层，并重新应用锁定状态
      canvas.getObjects().forEach(obj => {
        const objName = (obj as any).name || '';
        if (objName.startsWith('storyboard-border-')) {
          canvas.bringObjectToFront(obj);
          obj.set({
            selectable: false,
            evented: false,
            hasControls: false,
            hasBorders: false,
            lockMovementX: true,
            lockMovementY: true
          });
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
    if (!container) return;

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
    if (!container) return;
    
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
