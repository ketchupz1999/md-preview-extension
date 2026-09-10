import { useEffect, useRef, useState } from 'preact/hooks';
import { IconButton } from './icons.jsx';

/** 用独立滚动区域查看长图，缩放不改变原文的阅读位置。 */
export function DiagramDialog({ svg, onClose }) {
  const dialog = useRef();
  const viewport = useRef();
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    const modal = dialog.current;
    modal.showModal();
    const graph = modal.querySelector('.diagram-zoom>svg');
    const naturalWidth = graph?.viewBox.baseVal.width || 900;
    setWidth(naturalWidth);
    setZoom(Math.min(1, Math.max(.25, (viewport.current.clientWidth - 80) / naturalWidth)));
    return () => modal.close();
  }, []);
  return <dialog class="diagram-dialog" ref={dialog} onCancel={onClose}>
    <header><span>图表预览</span><div><button aria-label="缩小图表" onClick={() => setZoom(Math.max(.25, zoom - .25))}>−</button><button title="原始大小" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button><button aria-label="放大图表" onClick={() => setZoom(Math.min(4, zoom + .25))}>+</button><IconButton icon="close" label="关闭图表预览" onClick={onClose}/></div></header>
    <div class="diagram-viewport" ref={viewport}><div class="diagram-zoom" style={{ width: `${width * zoom}px` }} dangerouslySetInnerHTML={{ __html: svg }}/></div>
    <footer>使用 + / − 缩放，滚动查看完整图表 · Esc 关闭</footer>
  </dialog>;
}
