import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

type Props = {
  value: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  ink?: string;
  background?: string;
  placeholder?: string;
  hideClear?: boolean;
  canvasClassName?: string;
  baseline?: boolean;
};

export function SignaturePad({ value, onChange, label, ink = "#111", background = "#fff", placeholder = "Assine aqui com o dedo", hideClear, canvasClassName = "h-28", baseline }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(!value);

  const dataRef = useRef<string>(value);
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 });

  // Dimensiona o canvas pelo tamanho exibido (e a cada mudança), redesenhando o conteúdo
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let token = 0;
    const setup = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width, h = rect.height;
      if (w <= 0 || h <= 0) return;
      const prev = sizeRef.current;
      if (prev.w === w && prev.h === h && prev.dpr === dpr) return;
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2;
      ctx.strokeStyle = ink;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
      const src = dataRef.current;
      if (src) {
        const my = ++token;
        const img = new Image();
        img.onload = () => {
          if (my !== token) return;
          const iw = img.naturalWidth / dpr, ih = img.naturalHeight / dpr;
          const s = Math.min(1, w / iw, h / ih);
          ctx.drawImage(img, 0, 0, iw * s, ih * s);
          setEmpty(false);
        };
        img.src = src;
      }
    };
    setup();
    const ro = new ResizeObserver(() => setup());
    ro.observe(canvas);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const dpr = sizeRef.current.dpr || 1;
    const sx = canvas.width / dpr / (rect.width || 1);
    const sy = canvas.height / dpr / (rect.height || 1);
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastRef.current = getPos(e);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !lastRef.current) return;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
    setEmpty(false);
  }
  function end() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    const data = canvasRef.current?.toDataURL("image/png");
    if (data) { dataRef.current = data; onChange(data); }
  }
  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
    dataRef.current = "";
    setEmpty(true);
    onChange("");
  }

  return (
    <div className="space-y-1.5">
      {label && <div className="text-sm font-medium">{label}</div>}
      <div className="relative rounded-md border border-input" style={{ background }}>
        <canvas
          ref={canvasRef}
          className={`block w-full ${canvasClassName} touch-none rounded-md`}
          style={{ touchAction: "none" }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            {placeholder}
          </span>
        )}
        {baseline && (
          <span className="pointer-events-none absolute left-4 right-4 bottom-4 border-b" style={{ borderColor: "#9aa6b8" }} />
        )}
      </div>
      {!hideClear && <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={clear}>
          <Eraser className="h-3.5 w-3.5 mr-1" /> Limpar
        </Button>
      </div>}
    </div>
  );
}
