import { Canvas as FabricCanvas, FabricObject } from "fabric";

// Layer type definitions
export type LayerType = 'scene' | 'character' | 'prop' | 'effect' | 'composite';

// Base offset for each layer type (multiplied by 1000 to leave room for custom depth values)
const LAYER_TYPE_BASE_OFFSET: Record<LayerType, number> = {
  scene: 0,
  character: 1000,
  prop: 2000,
  effect: 3000,
  composite: 4000,
};

/**
 * Get the layer type from an object
 */
export const getObjectLayerType = (obj: FabricObject): LayerType => {
  const data = (obj as any).data;
  if (data?.elementType) {
    const type = data.elementType as string;
    // Validate that the type is in LAYER_TYPE_BASE_OFFSET
    if (type in LAYER_TYPE_BASE_OFFSET) {
      return type as LayerType;
    }
  }
  // Default to prop if no valid type is set
  return 'prop';
};

/**
 * Set the layer type for an object
 */
export const setObjectLayerType = (obj: FabricObject, type: LayerType) => {
  const data = (obj as any).data || {};
  (obj as any).data = { ...data, elementType: type };
};

/**
 * Get the custom depth value for an object (within its layer type)
 * Default is 0 if not set
 */
export const getObjectDepth = (obj: FabricObject): number => {
  const data = (obj as any).data;
  return data?.layerDepth ?? 0;
};

/**
 * Set the custom depth value for an object (within its layer type)
 */
export const setObjectDepth = (obj: FabricObject, depth: number) => {
  const data = (obj as any).data || {};
  (obj as any).data = { ...data, layerDepth: depth };
};

/**
 * Get the final depth value for an object (base offset + custom depth)
 */
export const getFinalDepth = (obj: FabricObject): number => {
  const type = getObjectLayerType(obj);
  const baseOffset = LAYER_TYPE_BASE_OFFSET[type];
  const customDepth = getObjectDepth(obj);
  return baseOffset + customDepth;
};

/**
 * Sort all objects in the canvas by their final depth value
 * This ensures the correct stacking order based on base offset + custom depth
 */
export const sortCanvasByLayerType = (canvas: FabricCanvas) => {
  const objects = canvas.getObjects();
  
  // Separate frames (workframe and storyboard frames) from regular objects
  // Use data.isFrameElement for accurate identification
  const frames = objects.filter(obj => (obj as any).data?.isFrameElement === true);
  const regularObjects = objects.filter(obj => (obj as any).data?.isFrameElement !== true);
  
  // Sort regular objects by their final depth value
  regularObjects.sort((a, b) => {
    const depthA = getFinalDepth(a);
    const depthB = getFinalDepth(b);
    return depthA - depthB;
  });
  
  // Build the correct order: frames first, then sorted regular objects
  const correctOrder = [...frames, ...regularObjects];
  
  // Replace the canvas objects with the correctly sorted array
  // Using Fabric's internal _objects array for direct control
  (canvas as any)._objects = correctOrder;
  
  canvas.renderAll();
};

/**
 * Insert an object at the correct position based on its final depth
 */
export const insertObjectWithLayerType = (canvas: FabricCanvas, obj: FabricObject, type?: LayerType) => {
  // Set type if provided
  if (type) {
    setObjectLayerType(obj, type);
  }
  
  const objDepth = getFinalDepth(obj);
  const objects = canvas.getObjects();
  
  // Find the insertion index
  let insertIndex = 0;
  
  // Skip all frames (should always be at the bottom)
  const frames = objects.filter(obj => (obj as any).data?.isFrameElement === true);
  insertIndex = frames.length;
  
  // Find the correct position based on final depth
  for (let i = insertIndex; i < objects.length; i++) {
    const currentObj = objects[i];
    const currentDepth = getFinalDepth(currentObj);
    
    if (currentDepth <= objDepth) {
      insertIndex = i + 1;
    } else {
      // Found an object with higher depth, insert before it
      break;
    }
  }
  
  canvas.insertAt(insertIndex, obj);
  canvas.renderAll();
};

/**
 * Move an object up or down by adjusting its depth
 */
export const moveObjectInLayer = (canvas: FabricCanvas, obj: FabricObject, direction: 'up' | 'down') => {
  const currentDepth = getObjectDepth(obj);
  const newDepth = direction === 'up' ? currentDepth + 1 : currentDepth - 1;
  
  setObjectDepth(obj, newDepth);
  sortCanvasByLayerType(canvas);
};

/**
 * Move an object to the top or bottom within its type range
 */
export const moveObjectToEdgeInLayer = (canvas: FabricCanvas, obj: FabricObject, edge: 'top' | 'bottom') => {
  const objectType = getObjectLayerType(obj);
  const objects = canvas.getObjects();
  
  // Find all objects of the same type
  const sameTypeObjects = objects.filter(o => 
    getObjectLayerType(o) === objectType &&
    (o as any).data?.isFrameElement !== true
  );
  
  if (sameTypeObjects.length === 0) return;
  
  if (edge === 'top') {
    // Find the max depth among same type objects
    const maxDepth = Math.max(...sameTypeObjects.map(o => getObjectDepth(o)));
    setObjectDepth(obj, maxDepth + 1);
  } else {
    // Find the min depth among same type objects
    const minDepth = Math.min(...sameTypeObjects.map(o => getObjectDepth(o)));
    setObjectDepth(obj, minDepth - 1);
  }
  
  sortCanvasByLayerType(canvas);
};
