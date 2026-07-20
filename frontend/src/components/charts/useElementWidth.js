import { useEffect, useRef, useState } from "react";

/**
 * Measures an element's width, keeping it current as the layout changes.
 *
 * SVG charts here render at real pixel dimensions rather than scaling a fixed
 * viewBox: stretching a viewBox with preserveAspectRatio="none" would distort
 * stroke widths and text, so the chart is re-laid-out on resize instead.
 */
export function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
