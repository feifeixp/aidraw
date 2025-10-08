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
      const baseThreshold = 30; // Base threshold for background detection
      const featherRange = 10 + (featherStrength * 0.5); // 10-60 range for feathering
      
      console.log('Using threshold:', baseThreshold, 'feather range:', featherRange, 'strength:', featherStrength);
      
      // First pass: Identify background pixels (strict threshold)
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
        
        if (distance < baseThreshold) {
          isBackground[pixelIndex] = 1;
          data[i + 3] = 0; // Make fully transparent
        }
      }
      
      // Second pass: Detect edge pixels and apply feathering only to edges
      const featherRadius = Math.ceil(featherRange / 10); // Convert to pixel radius
      
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
            
            // Remove background color spill from semi-transparent pixels
            if (alpha > 0 && alpha < 255) {
              const factor = alpha / 255;
              data[i] = Math.min(255, (data[i] - avgColor.r * (1 - factor)) / factor);
              data[i + 1] = Math.min(255, (data[i + 1] - avgColor.g * (1 - factor)) / factor);
              data[i + 2] = Math.min(255, (data[i + 2] - avgColor.b * (1 - factor)) / factor);
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
