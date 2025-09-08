// scroll-worker.loader.ts
export const createScrollWorker = (): Worker => {
  const workerCode = `
    ${calculateProgress.toString()}
    ${easeOutQuart.toString()}
    
    self.calculateProgress = ${calculateProgress.toString()};
    self.easeOutQuart = ${easeOutQuart.toString()};
    
    self.addEventListener('message', function(e) {
      const { scrollY, innerHeight, elements, totalFrames } = e.data;
      
      const results = elements.map((element, index) => {
        const progress = self.calculateProgress(scrollY, innerHeight, element);
        const frame = Math.floor(progress * totalFrames[index]);
        return { frame, progress, elementIndex: index };
      });
      
      self.postMessage(results);
    });
  `;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
};

// Helper functions that will be stringified and sent to the worker
function calculateProgress(scrollY: number, innerHeight: number, element: any): number {
  const { top, height, startOffset, endOffset } = element;
  
  const animationStart = top - innerHeight * startOffset;
  const animationEnd = top + height - innerHeight * endOffset;
  const animationRange = animationEnd - animationStart;

  if (animationRange <= 0) return 0;

  let progress = (scrollY - animationStart) / animationRange;
  progress = Math.max(0, Math.min(1, progress));
  
  return easeOutQuart(progress);
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}