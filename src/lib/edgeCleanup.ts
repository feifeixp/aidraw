/**
 * 清理图片边缘的抠图不干净的像素
 * 用于修复AI生成或编辑图片后人物边缘残留的杂色
 */

interface EdgeCleanupOptions {
  threshold?: number;        // 边缘检测阈值 (0-255)，默认 30
  smoothRadius?: number;     // 边缘平滑半径 (像素)，默认 2
  colorTolerance?: number;   // 颜色容差 (0-255)，默认 20
  featherWidth?: number;     // 羽化宽度 (像素)，默认 3
}

/**
 * 清理图片边缘的不干净像素
 * @param imageDataUrl - 输入图片的 data URL (base64)
 * @param options - 清理选项
 * @returns 处理后的图片 data URL
 */
export async function cleanImageEdges(
  imageDataUrl: string,
  options: EdgeCleanupOptions = {}
): Promise<string> {
  const {
    threshold = 30,
    smoothRadius = 2,
    colorTolerance = 20,
    featherWidth = 3
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        // 创建画布
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (!ctx) {
          throw new Error('无法获取画布上下文');
        }

        // 绘制原图
        ctx.drawImage(img, 0, 0);
        
        // 获取图像数据
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;

        // 第一步：检测并清理边缘杂色
        cleanEdgeArtifacts(data, width, height, threshold, colorTolerance);

        // 第二步：平滑边缘
        smoothEdges(data, width, height, smoothRadius);

        // 第三步：边缘羽化（可选）
        if (featherWidth > 0) {
          featherEdges(data, width, height, featherWidth);
        }

        // 写回画布
        ctx.putImageData(imageData, 0, 0);

        // 转换为 data URL
        const outputDataUrl = canvas.toDataURL('image/png');
        resolve(outputDataUrl);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('图片加载失败'));
    };

    img.src = imageDataUrl;
  });
}

/**
 * 清理边缘区域的颜色伪影和杂色
 */
function cleanEdgeArtifacts(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
  colorTolerance: number
): void {
  // 创建边缘掩码
  const edgeMask = new Uint8Array(width * height);
  
  // 检测边缘像素 (alpha值在阈值范围内的像素)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      
      // 如果是半透明像素，标记为边缘
      if (alpha > 0 && alpha < 255 - threshold) {
        edgeMask[y * width + x] = 1;
      }
    }
  }

  // 处理边缘像素
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      if (edgeMask[y * width + x] === 1) {
        const alpha = data[idx + 3];
        
        // 检查周围像素，获取主体颜色
        const neighborColors = getNeighborColors(data, width, height, x, y, edgeMask);
        
        if (neighborColors.length > 0) {
          // 使用主体颜色替换边缘杂色
          const avgColor = averageColor(neighborColors);
          
          // 只有当当前像素与主体颜色差异较大时才替换
          const colorDiff = Math.abs(data[idx] - avgColor.r) +
                           Math.abs(data[idx + 1] - avgColor.g) +
                           Math.abs(data[idx + 2] - avgColor.b);
          
          if (colorDiff > colorTolerance * 3) {
            data[idx] = avgColor.r;
            data[idx + 1] = avgColor.g;
            data[idx + 2] = avgColor.b;
          }
        }
        
        // 如果alpha值很低，直接设为完全透明
        if (alpha < threshold) {
          data[idx + 3] = 0;
        }
      }
    }
  }
}

/**
 * 平滑边缘，减少锯齿
 */
function smoothEdges(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): void {
  const tempData = new Uint8ClampedArray(data);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = tempData[idx + 3];
      
      // 只处理半透明像素
      if (alpha > 0 && alpha < 255) {
        let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
        let count = 0;
        
        // 采样周围像素
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = (ny * width + nx) * 4;
              const weight = 1.0 / (1.0 + Math.sqrt(dx * dx + dy * dy));
              
              sumR += tempData[nIdx] * weight;
              sumG += tempData[nIdx + 1] * weight;
              sumB += tempData[nIdx + 2] * weight;
              sumA += tempData[nIdx + 3] * weight;
              count += weight;
            }
          }
        }
        
        if (count > 0) {
          data[idx] = Math.round(sumR / count);
          data[idx + 1] = Math.round(sumG / count);
          data[idx + 2] = Math.round(sumB / count);
          data[idx + 3] = Math.round(sumA / count);
        }
      }
    }
  }
}

/**
 * 边缘羽化，创建更自然的过渡
 */
function featherEdges(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  featherWidth: number
): void {
  const alphaMap = new Uint8Array(width * height);
  
  // 复制当前alpha值
  for (let i = 0; i < width * height; i++) {
    alphaMap[i] = data[i * 4 + 3];
  }
  
  // 对每个像素计算到最近完全不透明像素的距离
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const alpha = alphaMap[idx];
      
      // 只处理半透明和透明像素
      if (alpha < 255) {
        const distToSolid = getDistanceToSolidPixel(alphaMap, width, height, x, y, featherWidth);
        
        if (distToSolid < featherWidth) {
          // 根据距离调整alpha值，创建渐变
          const featherRatio = distToSolid / featherWidth;
          const newAlpha = Math.round(alpha * (1 - featherRatio * 0.5));
          data[(y * width + x) * 4 + 3] = Math.max(0, Math.min(255, newAlpha));
        }
      }
    }
  }
}

/**
 * 获取周围主体像素的颜色
 */
function getNeighborColors(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  edgeMask: Uint8Array
): Array<{ r: number; g: number; b: number }> {
  const colors: Array<{ r: number; g: number; b: number }> = [];
  
  // 检查周围3x3区域
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      
      const nx = x + dx;
      const ny = y + dy;
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIdx = (ny * width + nx) * 4;
        const alpha = data[nIdx + 3];
        
        // 只采样不透明的主体像素
        if (alpha > 200 && edgeMask[ny * width + nx] === 0) {
          colors.push({
            r: data[nIdx],
            g: data[nIdx + 1],
            b: data[nIdx + 2]
          });
        }
      }
    }
  }
  
  return colors;
}

/**
 * 计算颜色数组的平均值
 */
function averageColor(colors: Array<{ r: number; g: number; b: number }>): { r: number; g: number; b: number } {
  if (colors.length === 0) {
    return { r: 0, g: 0, b: 0 };
  }
  
  let sumR = 0, sumG = 0, sumB = 0;
  
  for (const color of colors) {
    sumR += color.r;
    sumG += color.g;
    sumB += color.b;
  }
  
  return {
    r: Math.round(sumR / colors.length),
    g: Math.round(sumG / colors.length),
    b: Math.round(sumB / colors.length)
  };
}

/**
 * 获取到最近完全不透明像素的距离
 */
function getDistanceToSolidPixel(
  alphaMap: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  maxDist: number
): number {
  let minDist = maxDist + 1;
  
  for (let dy = -maxDist; dy <= maxDist; dy++) {
    for (let dx = -maxDist; dx <= maxDist; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const alpha = alphaMap[ny * width + nx];
        
        if (alpha === 255) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          minDist = Math.min(minDist, dist);
        }
      }
    }
  }
  
  return minDist;
}
