import { 
  FilesetResolver, 
  InteractiveSegmenter,
  InteractiveSegmenterResult
} from '@mediapipe/tasks-vision';

export class MediaPipeSegmenter {
  private segmenter: InteractiveSegmenter | null = null;
  private isInitialized: boolean = false;

  async initialize() {
    if (this.isInitialized) return;

    console.log('Loading MediaPipe segmenter...');
    
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );
    
    this.segmenter = await InteractiveSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite'
      },
      outputCategoryMask: true,
      outputConfidenceMasks: false
    });
    
    this.isInitialized = true;
    console.log('MediaPipe segmenter loaded successfully');
  }

  async segmentWithPoint(
    image: HTMLImageElement | HTMLCanvasElement,
    x: number,
    y: number
  ): Promise<InteractiveSegmenterResult | null> {
    if (!this.segmenter) {
      throw new Error('Segmenter not initialized');
    }

    // Normalize coordinates to [0, 1]
    const normalizedX = x / (image instanceof HTMLImageElement ? image.width : image.width);
    const normalizedY = y / (image instanceof HTMLImageElement ? image.height : image.height);

    const result = this.segmenter.segment(
      image,
      { keypoint: { x: normalizedX, y: normalizedY } }
    );

    return result;
  }

  extractMaskedImage(
    sourceCanvas: HTMLCanvasElement,
    categoryMask: Uint8Array,
    maskWidth: number,
    maskHeight: number,
    options: {
      dilation?: number;  // 膨胀像素数，扩大选中区域
      feather?: number;   // 羽化像素数，边缘柔化
    } = {}
  ): HTMLCanvasElement {
    const { dilation = 0, feather = 0 } = options;
    
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = sourceCanvas.width;
    outputCanvas.height = sourceCanvas.height;
    const ctx = outputCanvas.getContext('2d')!;

    // Draw original image
    ctx.drawImage(sourceCanvas, 0, 0);

    // Apply mask to alpha channel
    const imageData = ctx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    const data = imageData.data;

    // First pass: Create expanded mask if dilation is enabled
    let expandedMask: Uint8Array = categoryMask;
    if (dilation > 0) {
      expandedMask = this.dilateMask(categoryMask, maskWidth, maskHeight, dilation);
    }

    // Second pass: Apply mask with optional feathering
    for (let y = 0; y < outputCanvas.height; y++) {
      for (let x = 0; x < outputCanvas.width; x++) {
        const maskX = Math.floor((x / outputCanvas.width) * maskWidth);
        const maskY = Math.floor((y / outputCanvas.height) * maskHeight);
        const maskIdx = maskY * maskWidth + maskX;
        
        const maskValue = expandedMask[maskIdx];
        const idx = (y * outputCanvas.width + x) * 4;
        
        if (feather > 0 && maskValue === 0) {
          // Calculate distance to edge for feathering
          const alpha = this.calculateFeatheredAlpha(
            expandedMask,
            maskWidth,
            maskHeight,
            maskX,
            maskY,
            feather
          );
          data[idx + 3] = alpha;
        } else {
          // No feathering: binary mask
          data[idx + 3] = maskValue === 0 ? 255 : 0;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return outputCanvas;
  }

  private dilateMask(
    mask: Uint8Array,
    width: number,
    height: number,
    iterations: number
  ): Uint8Array {
    let currentMask = new Uint8Array(mask);
    
    for (let iter = 0; iter < iterations; iter++) {
      const newMask = new Uint8Array(currentMask);
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          
          // If current pixel is object (0), expand to neighbors
          if (currentMask[idx] === 0) {
            // Check 8-connected neighbors
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                  const nidx = ny * width + nx;
                  newMask[nidx] = 0;
                }
              }
            }
          }
        }
      }
      
      currentMask = newMask;
    }
    
    return currentMask;
  }

  private calculateFeatheredAlpha(
    mask: Uint8Array,
    width: number,
    height: number,
    x: number,
    y: number,
    featherRadius: number
  ): number {
    // Find distance to nearest background pixel
    let minDist = featherRadius + 1;
    
    for (let dy = -featherRadius; dy <= featherRadius; dy++) {
      for (let dx = -featherRadius; dx <= featherRadius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const idx = ny * width + nx;
          
          // If neighbor is background
          if (mask[idx] !== 0) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            minDist = Math.min(minDist, dist);
          }
        }
      }
    }
    
    // Calculate alpha based on distance
    if (minDist >= featherRadius) {
      return 255; // Fully opaque
    }
    
    // Smooth falloff
    const ratio = minDist / featherRadius;
    return Math.floor(ratio * 255);
  }

  drawMaskOnCanvas(
    canvas: HTMLCanvasElement,
    categoryMask: Uint8Array,
    maskWidth: number,
    maskHeight: number,
    color: string = 'rgba(0, 255, 255, 0.3)'
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous mask
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Create ImageData for the mask
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    // Parse color
    const rgba = this.parseColor(color);

    // Scale mask to canvas size
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const maskX = Math.floor((x / canvas.width) * maskWidth);
        const maskY = Math.floor((y / canvas.height) * maskHeight);
        const maskIdx = maskY * maskWidth + maskX;
        const maskValue = categoryMask[maskIdx];

        // MediaPipe mask: 0 = object (hovered area), highlight it
        if (maskValue === 0) {
          const idx = (y * canvas.width + x) * 4;
          data[idx] = rgba.r;
          data[idx + 1] = rgba.g;
          data[idx + 2] = rgba.b;
          data[idx + 3] = rgba.a;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  private parseColor(color: string): { r: number; g: number; b: number; a: number } {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
        a: match[4] ? Math.floor(parseFloat(match[4]) * 255) : 255
      };
    }
    return { r: 0, g: 255, b: 255, a: 128 };
  }

  close() {
    if (this.segmenter) {
      this.segmenter.close();
      this.segmenter = null;
      this.isInitialized = false;
    }
  }
}
