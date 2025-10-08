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
      // Higher strength = more aggressive background removal
      const minTolerance = 20 + (featherStrength * 0.3);  // 20-50
      const maxTolerance = 40 + (featherStrength * 0.6);  // 40-100
      
      console.log('Using tolerances:', { minTolerance, maxTolerance, featherStrength });
      
      // First pass: Mark pixels for transparency with feathering
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Calculate color distance from background
        const distance = Math.sqrt(
          Math.pow(r - avgColor.r, 2) +
          Math.pow(g - avgColor.g, 2) +
          Math.pow(b - avgColor.b, 2)
        );
        
        if (distance < minTolerance) {
          // Fully transparent
          data[i + 3] = 0;
        } else if (distance < maxTolerance) {
          // Gradual transparency for edge feathering
          const alpha = ((distance - minTolerance) / (maxTolerance - minTolerance)) * 255;
          data[i + 3] = Math.min(255, alpha);
        }
        // else: keep original alpha (fully opaque)
      }
      
      // Second pass: Edge cleanup - remove color spill from semi-transparent pixels
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        
        // For semi-transparent pixels, reduce the background color influence
        if (alpha > 0 && alpha < 255) {
          const factor = alpha / 255;
          
          // Remove background color tint from RGB channels
          data[i] = Math.min(255, (data[i] - avgColor.r * (1 - factor)) / factor);
          data[i + 1] = Math.min(255, (data[i + 1] - avgColor.g * (1 - factor)) / factor);
          data[i + 2] = Math.min(255, (data[i + 2] - avgColor.b * (1 - factor)) / factor);
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
