// scroll.worker.ts
export interface ScrollCalculationData {
  scrollY: number;
  innerHeight: number;
  elements: ElementData[];
  totalFrames: number[];
}

export interface ElementData {
  top: number;
  height: number;
  startOffset: number;
  endOffset: number;
}

export interface AnimationResult {
  frame: number;
  progress: number;
  elementIndex: number;
}

addEventListener('message', (event: MessageEvent<ScrollCalculationData>) => {
  const { scrollY, innerHeight, elements, totalFrames } = event.data;
  
  const results: AnimationResult[] = elements.map((element, index) => {
    const progress = calculateProgress(scrollY, innerHeight, element);
    const frame = Math.floor(progress * totalFrames[index]);
    return { frame, progress, elementIndex: index };
  });
  
  postMessage(results);
});

function calculateProgress(scrollY: number, innerHeight: number, element: ElementData): number {
  const { top, height, startOffset, endOffset } = element;
  
  const animationStart = top - innerHeight * startOffset;
  const animationEnd = top + height - innerHeight * endOffset;
  const animationRange = animationEnd - animationStart;

  if (animationRange <= 0) return 0;

  let progress = (scrollY - animationStart) / animationRange;
  progress = Math.max(0, Math.min(1, progress));
  
  // Smooth easing function
  return easeOutQuart(progress);
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}