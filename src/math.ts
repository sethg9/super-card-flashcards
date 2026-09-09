type MathEngine = {
  startup: { promise: Promise<void> };
  typesetPromise(elements: HTMLElement[]): Promise<void>;
  typesetClear(elements: HTMLElement[]): void;
};
let engine: Promise<MathEngine> | undefined;
let queue = Promise.resolve();
export function loadMath(): Promise<MathEngine> {
  if (!engine)
    engine = new Promise((resolve, reject) => {
      const scope = window as unknown as { MathJax: any };
      scope.MathJax = {
        loader: {
          paths: { mathjax: '/mathjax' },
          load: [
            'input/tex-base',
            '[tex]/ams',
            '[tex]/newcommand',
            '[tex]/noundefined',
            'output/svg',
            'a11y/assistive-mml',
          ],
        },
        startup: { typeset: false },
        tex: {
          inlineMath: [['\\(', '\\)']],
          displayMath: [['\\[', '\\]']],
          packages: ['base', 'ams', 'newcommand', 'noundefined'],
          maxBuffer: 20_000,
          maxMacros: 1000,
        },
        output: {
          font: 'mathjax-newcm',
          fontPath: '/mathjax-newcm-font',
          displayOverflow: 'linebreak',
        },
        svg: { fontCache: 'local' },
        options: { enableAssistiveMml: true },
      };
      const script = document.createElement('script');
      script.src = '/mathjax/startup.js';
      script.onload = () =>
        scope.MathJax.startup.promise.then(() => resolve(scope.MathJax), reject);
      script.onerror = () => reject(new Error('The bundled math renderer could not load.'));
      document.head.appendChild(script);
    });
  return engine;
}
export function typeset(
  element: HTMLElement,
  html: string,
  isCurrent: () => boolean,
): Promise<void> {
  const job = queue.then(async () => {
    const math = await loadMath();
    if (!isCurrent()) return;
    math.typesetClear([element]);
    element.innerHTML = html;
    await math.typesetPromise([element]);
  });
  queue = job.catch(() => {});
  return job;
}
export function clearMath(element: HTMLElement) {
  if (engine) void engine.then((math) => math.typesetClear([element])).catch(() => {});
}
