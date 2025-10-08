/**
 * Intelligently detect and remove background color from an image
 * Samples the four corners to determine the background color
 * Uses edge feathering for cleaner results
 * @param imageUrl - The image URL to process
 * @param featherStrength - Edge feathering strength (0-100), higher = more aggressive
 */
export const convertMagentaToTransparent = async (
  imageUrl: string,
  featherStrength: number = 50
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      // Draw the image
      ctx.drawImage(img, 0, 0);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Sample the four corners to detect background color
      const sampleSize = 10;
      const corners = [
        { x: 0, y: 0 },
        { x: canvas.width - sampleSize, y: 0 },
        { x: 0, y: canvas.height - sampleSize },
        { x: canvas.width - sampleSize, y: canvas.height - sampleSize }
      ];
      
      // Collect color samples from corners
      const colorSamples: { r: number; g: number; b: number }[] = [];
      
      corners.forEach(corner => {
        for (let dy = 0; dy < sampleSize; dy++) {
          for (let dx = 0; dx < sampleSize; dx++) {
            const x = Math.min(corner.x + dx, canvas.width - 1);
            const y = Math.min(corner.y + dy, canvas.height - 1);
            const i = (y * canvas.width + x) * 4;
            colorSamples.push({
              r: data[i],
              g: data[i + 1],
              b: data[i + 2]
            });
          }
        }
      });
      
      // Calculate average background color
      const avgColor = colorSamples.reduce(
        (acc, color) => ({
          r: acc.r + color.r / colorSamples.length,
          g: acc.g + color.g / colorSamples.length,
          b: acc.b + color.b / colorSamples.length
        }),
        { r: 0, g: 0, b: 0 }
      );
      
      console.log('Detected background color:', avgColor);
      
      // Calculate tolerance based on featherStrength (0-100)
      const baseThreshold = 40; // Increased base threshold for more aggressive background detection
      const featherRange = 30 + (featherStrength * 1.2); // Wider feather range for smoother edges
      
      // Increased edge detection radius based on feather strength
      const baseEdgeRadius = 4; // Increased minimum edge detection radius
      const maxEdgeRadius = 20; // Increased maximum edge detection radius
      const featherRadius = baseEdgeRadius + Math.ceil((featherStrength / 100) * (maxEdgeRadius - baseEdgeRadius));
      
      // Enhanced magenta/purple detection
      const isMagentaLike = (r: number, g: number, b: number) => {
        // Magenta typically has high R and B, low G
        const isHighRed = r > 180;
        const isHighBlue = b > 180;
        const isLowGreen = g < 100;
        const magentaRatio = (r + b) / (g + 1); // Avoid division by zero
        return (isHighRed && isHighBlue && isLowGreen) || magentaRatio > 3.5;
      };
      
      console.log('Using threshold:', baseThreshold, 'feather range:', featherRange, 'feather radius:', featherRadius, 'strength:', featherStrength);
      
      // First pass: Identify background pixels (strict threshold) including magenta detection
      const isBackground = new Uint8Array(canvas.width * canvas.height);
      
      for (let i = 0; i < data.length; i += 4) {
        const pixelIndex = i / 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Calculate color distance from background
        const distance = Math.sqrt(
          Math.pow(r - avgColor.r, 2) +
          Math.pow(g - avgColor.g, 2) +
          Math.pow(b - avgColor.b, 2)
        );
        
        // Mark as background if similar to detected background OR if it's magenta-like
        if (distance < baseThreshold || isMagentaLike(r, g, b)) {
          isBackground[pixelIndex] = 1;
          data[i + 3] = 0; // Make fully transparent
        }
      }
      
      // Second pass: Detect edge pixels and apply feathering only to edges
      
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const pixelIndex = y * canvas.width + x;
          const i = pixelIndex * 4;
          
          // Skip if already marked as background
          if (isBackground[pixelIndex]) continue;
          
          // Check if this pixel is near a transparent pixel (i.e., it's an edge)
          let nearTransparent = false;
          let minDistToBackground = Infinity;
          
          // Check surrounding pixels within feather radius
          for (let dy = -featherRadius; dy <= featherRadius; dy++) {
            for (let dx = -featherRadius; dx <= featherRadius; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              
              // Skip out of bounds
              if (nx < 0 || nx >= canvas.width || ny < 0 || ny >= canvas.height) continue;
              
              const neighborIndex = ny * canvas.width + nx;
              
              if (isBackground[neighborIndex]) {
                nearTransparent = true;
                const dist = Math.sqrt(dx * dx + dy * dy);
                minDistToBackground = Math.min(minDistToBackground, dist);
              }
            }
          }
          
          // Apply feathering only to edge pixels
          if (nearTransparent && minDistToBackground < featherRadius) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Calculate color distance from background
            const colorDistance = Math.sqrt(
              Math.pow(r - avgColor.r, 2) +
              Math.pow(g - avgColor.g, 2) +
              Math.pow(b - avgColor.b, 2)
            );
            
            // Apply soft feathering based on both spatial and color distance
            const spatialFactor = minDistToBackground / featherRadius;
            const colorFactor = Math.min(1, colorDistance / featherRange);
            const alpha = Math.max(spatialFactor, colorFactor) * 255;
            
            data[i + 3] = Math.min(255, alpha);
            
            // Enhanced color spill removal for semi-transparent pixels
            if (alpha > 0 && alpha < 255) {
              const factor = alpha / 255;
              
              // Remove both detected background color AND magenta spill
              const bgRemovalStrength = 1 - factor;
              const magentaRemovalStrength = isMagentaLike(r, g, b) ? 0.5 : bgRemovalStrength;
              
              // Remove background color
              data[i] = Math.max(0, Math.min(255, (data[i] - avgColor.r * bgRemovalStrength) / Math.max(0.1, factor)));
              data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] - avgColor.g * bgRemovalStrength) / Math.max(0.1, factor)));
              data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] - avgColor.b * bgRemovalStrength) / Math.max(0.1, factor)));
              
              // Additional magenta spill removal
              if (isMagentaLike(data[i], data[i + 1], data[i + 2])) {
                // Reduce red and blue channels that contribute to magenta
                data[i] = Math.floor(data[i] * (1 - magentaRemovalStrength * 0.3));
                data[i + 2] = Math.floor(data[i + 2] * (1 - magentaRemovalStrength * 0.3));
                // Slightly boost green to neutralize
                data[i + 1] = Math.min(255, Math.floor(data[i + 1] * (1 + magentaRemovalStrength * 0.1)));
              }
            }
          }
        }
      }
      
      // Put the modified data back
      ctx.putImageData(imageData, 0, 0);
      
      // Convert to blob URL
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(URL.createObjectURL(blob));
        } else {
          reject(new Error('Failed to create blob'));
        }
      }, 'image/png');
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
};
