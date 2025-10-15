import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas as FabricCanvas } from 'fabric';
import { MediaPipeSegmenter } from '@/lib/mediapipe/interactiveSegmenter';
import { Button } from '@/components/ui/button';
import { X, MousePointer2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface InteractiveSAMProps {
  canvas: FabricCanvas | null;
  onExit: () => void;
  onExtract: (canvas: HTMLCanvasElement, elementType: 'character' | 'prop' | 'scene') => void;
}

export const InteractiveSAM = ({ canvas, onExit, onExtract }: InteractiveSAMProps) => {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const [segmenter, setSegmenter] = useState<MediaPipeSegmenter | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const canvasBoundsRef = useRef<DOMRect | null>(null);

  // Initialize MediaPipe
  useEffect(() => {
    const init = async () => {
      try {
        toast.info('正在加载分割模型...');
        const segmenterInstance = new MediaPipeSegmenter();
        await segmenterInstance.initialize();
        setSegmenter(segmenterInstance);
        
        // Load the selected image
        const activeObject = canvas?.getActiveObject();
        if (activeObject && activeObject.type === 'image') {
          const imageDataURL = (activeObject as any).toDataURL({
            format: 'png',
            quality: 1
          });
          
          const img = await loadImage(imageDataURL);
          sourceImageRef.current = img;
          
          setIsInitialized(true);
          toast.success('模型已加载，鼠标移动高亮物体，点击提取');
        }
      } catch (error) {
        console.error('Failed to initialize segmenter:', error);
        toast.error('模型加载失败');
        onExit();
      }
    };

    init();

    return () => {
      if (segmenter) {
        segmenter.close();
      }
    };
  }, [canvas, onExit]);

  // Handle mouse move for hover highlight
  const handleMouseMove = useCallback(async (e: MouseEvent) => {
    if (!segmenter || !isInitialized || !overlayCanvasRef.current || !sourceImageRef.current || isExtracting) return;

    if (!canvasBoundsRef.current) return;

    const x = e.clientX - canvasBoundsRef.current.left;
    const y = e.clientY - canvasBoundsRef.current.top;

    // Check if mouse is within canvas bounds
    if (x < 0 || y < 0 || x > canvasBoundsRef.current.width || y > canvasBoundsRef.current.height) {
      // Clear mask when mouse leaves canvas
      const ctx = overlayCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
      return;
    }

    // Scale coordinates to source image size
    const scaleX = sourceImageRef.current.width / canvasBoundsRef.current.width;
    const scaleY = sourceImageRef.current.height / canvasBoundsRef.current.height;
    const imageX = x * scaleX;
    const imageY = y * scaleY;

    // Clear previous timeout
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }

    // Debounce hover prediction
    hoverTimeoutRef.current = window.setTimeout(async () => {
      try {
        setIsHovering(true);
        const result = await segmenter.segmentWithPoint(
          sourceImageRef.current!,
          imageX,
          imageY
        );
        
        if (result && result.categoryMask && overlayCanvasRef.current) {
          const maskData = result.categoryMask.getAsUint8Array();
          segmenter.drawMaskOnCanvas(
            overlayCanvasRef.current,
            maskData,
            result.categoryMask.width,
            result.categoryMask.height,
            'rgba(0, 255, 255, 0.6)' // Increased opacity for better visibility
          );
        }
      } catch (error) {
        console.error('Hover prediction error:', error);
      } finally {
        setIsHovering(false);
      }
    }, 150); // Reduced debounce for faster response
  }, [segmenter, isInitialized, isExtracting]);

  // Handle click to extract object
  const handleClick = useCallback(async (e: MouseEvent) => {
    if (!segmenter || !isInitialized || !overlayCanvasRef.current || !sourceImageRef.current || isExtracting) return;

    if (!canvasBoundsRef.current) return;

    const x = e.clientX - canvasBoundsRef.current.left;
    const y = e.clientY - canvasBoundsRef.current.top;

    // Check if click is within canvas bounds
    if (x < 0 || y < 0 || x > canvasBoundsRef.current.width || y > canvasBoundsRef.current.height) return;

    // Scale coordinates to source image size
    const scaleX = sourceImageRef.current.width / canvasBoundsRef.current.width;
    const scaleY = sourceImageRef.current.height / canvasBoundsRef.current.height;
    const imageX = x * scaleX;
    const imageY = y * scaleY;

    try {
      setIsExtracting(true);
      toast.loading('正在提取物体...', { id: 'extracting' });
      
      // Get mask for clicked point
      const result = await segmenter.segmentWithPoint(
        sourceImageRef.current,
        imageX,
        imageY
      );
      
      if (!result || !result.categoryMask) {
        toast.error('未检测到物体', { id: 'extracting' });
        return;
      }

      // Create source canvas
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = sourceImageRef.current.width;
      sourceCanvas.height = sourceImageRef.current.height;
      const ctx = sourceCanvas.getContext('2d')!;
      ctx.drawImage(sourceImageRef.current, 0, 0);
      
      // Extract the masked object
      const maskData = result.categoryMask.getAsUint8Array();
      const extractedCanvas = segmenter.extractMaskedImage(
        sourceCanvas,
        maskData,
        result.categoryMask.width,
        result.categoryMask.height
      );

      // Convert to blob for classification
      toast.loading('正在识别物体类型...', { id: 'extracting' });
      const blob = await new Promise<Blob>((resolve, reject) => {
        extractedCanvas.toBlob(
          (b) => b ? resolve(b) : reject(new Error('Failed to create blob')),
          'image/png'
        );
      });

      // Classify the object
      const elementType = await classifyObject(blob);
      
      // Pass extracted canvas to parent
      onExtract(extractedCanvas, elementType);
      
      toast.success(`已提取物体 (${elementType})`, { id: 'extracting' });
    } catch (error) {
      console.error('Extract error:', error);
      toast.error('提取失败', { id: 'extracting' });
    } finally {
      setIsExtracting(false);
    }
  }, [segmenter, isInitialized, onExtract, isExtracting]);

  // Set up event listeners
  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas || !isInitialized) return;

    overlayCanvas.addEventListener('mousemove', handleMouseMove);
    overlayCanvas.addEventListener('click', handleClick);

    return () => {
      overlayCanvas.removeEventListener('mousemove', handleMouseMove);
      overlayCanvas.removeEventListener('click', handleClick);
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, [handleMouseMove, handleClick, isInitialized]);

  // Position and size the overlay canvas
  useEffect(() => {
    if (!canvas || !overlayCanvasRef.current) return;

    const updateCanvasPosition = () => {
      const activeObject = canvas.getActiveObject();
      if (!activeObject) return;

      const canvasElement = canvas.getElement();
      const rect = canvasElement.getBoundingClientRect();
      
      canvasBoundsRef.current = rect;
      overlayCanvasRef.current!.width = rect.width;
      overlayCanvasRef.current!.height = rect.height;
      overlayCanvasRef.current!.style.left = `${rect.left}px`;
      overlayCanvasRef.current!.style.top = `${rect.top}px`;
      overlayCanvasRef.current!.style.width = `${rect.width}px`;
      overlayCanvasRef.current!.style.height = `${rect.height}px`;
    };

    updateCanvasPosition();
    
    // Update on window resize
    window.addEventListener('resize', updateCanvasPosition);
    
    return () => {
      window.removeEventListener('resize', updateCanvasPosition);
    };
  }, [canvas]);

  return (
    <>
      {/* Overlay Canvas */}
      <canvas
        ref={overlayCanvasRef}
        className="fixed pointer-events-auto cursor-crosshair"
        style={{ 
          background: 'transparent',
          pointerEvents: 'auto',
          zIndex: 1000
        }}
      />
      
      {/* Control Panel */}
      <div className="fixed top-4 right-4 flex gap-2 pointer-events-auto" style={{ zIndex: 1001 }}>
        <div className={`bg-background border rounded-lg px-4 py-2 shadow-lg flex items-center gap-2 transition-all ${
          isExtracting ? 'border-primary' : ''
        }`}>
          <MousePointer2 className={`h-4 w-4 ${isExtracting ? 'animate-pulse' : ''}`} />
          <span className="text-sm font-medium">
            {isExtracting ? '提取中，请稍候...' : isHovering ? '检测中...' : '鼠标悬停高亮，点击提取'}
          </span>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={onExit}
          disabled={isExtracting}
        >
          <X className="h-4 w-4 mr-2" />
          退出
        </Button>
      </div>
    </>
  );
};

// Helper functions
const loadImage = (dataUrl: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
};

const classifyObject = async (imageBlob: Blob): Promise<'character' | 'prop' | 'scene'> => {
  try {
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
