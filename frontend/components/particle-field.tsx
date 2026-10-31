"use client";

import { useEffect, useRef } from "react";

// A decorative 3D dot cloud that follows the reader down the homepage. Each section marks an
// empty spot with <ParticleSlot shape="…" />; the cloud flies to the slot nearest the middle
// of the screen and re-forms into that slot's shape, extruded into depth, slowly turning and
// leaning toward the pointer. Desktop only, and never with reduced motion.

export type ParticleShape = "code" | "gear" | "browser" | "chat";

export function ParticleSlot({ shape, className }: { shape: ParticleShape; className?: string }) {
  return <span className={`particle-slot${className ? ` ${className}` : ""}`} data-shape={shape} aria-hidden="true" />;
}

const COUNT = 1100;
const COLORS = ["rgba(210, 19, 25, 0.85)", "rgba(169, 15, 20, 0.7)", "rgba(175, 174, 162, 0.9)"];

type Point = [number, number];
type Point3 = [number, number, number];

const FOCAL = 700;

function drawShape(ctx: CanvasRenderingContext2D, shape: ParticleShape, w: number, h: number) {
  const s = Math.min(w, h);
  ctx.lineWidth = Math.max(2, s * 0.018);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (shape === "code") {
    ctx.font = `700 ${h * 0.82}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.strokeText("</>", w / 2, h / 2);
  } else if (shape === "gear") {
    const cx = w / 2;
    const cy = h / 2;
    const outer = s * 0.46;
    const inner = s * 0.36;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const step = Math.PI / 10;
      for (const [angle, r] of [
        [a - step * 0.55, inner],
        [a - step * 0.35, outer],
        [a + step * 0.35, outer],
        [a + step * 0.55, inner],
      ] as Point[]) {
        ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      }
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.14, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape === "browser") {
    const pad = ctx.lineWidth * 2;
    const bw = w - pad * 2;
    const bh = h - pad * 2;
    ctx.beginPath();
    ctx.roundRect(pad, pad, bw, bh, s * 0.06);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pad, pad + bh * 0.2);
    ctx.lineTo(pad + bw, pad + bh * 0.2);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(pad + bw * 0.06 + i * bw * 0.05, pad + bh * 0.1, s * 0.022, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const [x, y, len] of [
      [0.08, 0.38, 0.5],
      [0.08, 0.52, 0.36],
      [0.08, 0.66, 0.44],
      [0.08, 0.8, 0.24],
    ] as [number, number, number][]) {
      ctx.beginPath();
      ctx.moveTo(pad + bw * x, pad + bh * y);
      ctx.lineTo(pad + bw * (x + len), pad + bh * y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.roundRect(pad + bw * 0.66, pad + bh * 0.34, bw * 0.26, bh * 0.5, s * 0.03);
    ctx.stroke();
  } else {
    const pad = ctx.lineWidth * 2;
    const bw = w - pad * 2;
    const bh = (h - pad * 2) * 0.8;
    ctx.beginPath();
    ctx.roundRect(pad, pad, bw, bh, s * 0.14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pad + bw * 0.22, pad + bh);
    ctx.lineTo(pad + bw * 0.16, h - pad);
    ctx.lineTo(pad + bw * 0.36, pad + bh);
    ctx.stroke();
    ctx.font = `700 ${bh * 0.78}px Georgia, serif`;
    ctx.fillText("?", pad + bw / 2, pad + bh / 2 + bh * 0.03);
  }
}

// Draws the shape off-screen, scatters COUNT points over its lines centred on (0, 0), then
// extrudes them: most land on the front or back face, the rest along the sides between.
function samplePoints(shape: ParticleShape, w: number, h: number): Point3[] {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.strokeStyle = ctx.fillStyle = "#000";
  drawShape(ctx, shape, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const hits: Point[] = [];
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if ((data[(y * canvas.width + x) * 4 + 3] ?? 0) > 110) hits.push([x - canvas.width / 2, y - canvas.height / 2]);
    }
  }
  if (!hits.length) return [];
  const depth = Math.min(w, h) * 0.22;
  return Array.from({ length: COUNT }, () => {
    const [x, y] = hits[(Math.random() * hits.length) | 0] ?? [0, 0];
    const r = Math.random();
    const z = r < 0.4 ? -depth / 2 : r < 0.8 ? depth / 2 : (Math.random() - 0.5) * depth;
    return [x + (Math.random() - 0.5) * 2.4, y + (Math.random() - 0.5) * 2.4, z];
  });
}

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const desktop = window.matchMedia("(min-width: 1100px) and (prefers-reduced-motion: no-preference)");

    let frame = 0;
    let running = false;
    const shapes = new Map<Element, { key: string; points: Point3[] }>();
    const px = new Float32Array(COUNT);
    const py = new Float32Array(COUNT);
    const speed = Float32Array.from({ length: COUNT }, () => 0.035 + Math.random() * 0.07);
    const phase = Float32Array.from({ length: COUNT }, () => Math.random() * Math.PI * 2);
    let active: Element | null = null;
    let anchorX = 0;
    let anchorY = 0;
    let placed = false;
    let dpr = 1;
    let mouseX = 0;
    let mouseY = 0;
    let tiltX = 0;
    let tiltY = 0;
    const onPointer = (event: PointerEvent) => {
      mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      mouseY = (event.clientY / window.innerHeight) * 2 - 1;
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      shapes.clear();
    };

    const pointsFor = (slot: Element, rect: DOMRect) => {
      const shape = (slot.getAttribute("data-shape") || "code") as ParticleShape;
      const key = `${shape}:${Math.round(rect.width)}x${Math.round(rect.height)}`;
      const cached = shapes.get(slot);
      if (cached?.key === key) return cached.points;
      const points = samplePoints(shape, rect.width, rect.height);
      shapes.set(slot, { key, points });
      return points;
    };

    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      const vh = window.innerHeight;
      // Follow the slot nearest the middle of the screen; keep the last one while none is in view.
      let best: { slot: Element; rect: DOMRect; d: number } | null = null;
      for (const slot of document.querySelectorAll(".particle-slot")) {
        const rect = slot.getBoundingClientRect();
        if (!rect.width) continue;
        const cy = rect.top + rect.height / 2;
        if (cy < vh * 0.08 || cy > vh * 0.92) continue;
        const d = Math.abs(cy - vh / 2);
        if (!best || d < best.d) best = { slot, rect, d };
      }
      if (best) active = best.slot;
      if (!active) return;
      const rect = best?.slot === active ? best.rect : active.getBoundingClientRect();
      const points = pointsFor(active, rect);
      if (!points.length) return;
      const tx = rect.left + rect.width / 2;
      const ty = rect.top + rect.height / 2;
      if (!placed) {
        // First appearance: the dots gather from a wide scatter around the shape.
        anchorX = tx;
        anchorY = ty;
        for (let i = 0; i < COUNT; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = 200 + Math.random() * 500;
          px[i] = tx + Math.cos(a) * r;
          py[i] = ty + Math.sin(a) * r;
        }
        placed = true;
      }
      anchorX += (tx - anchorX) * 0.16;
      anchorY += (ty - anchorY) * 0.16;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, window.innerWidth, vh);
      const t = time / 1000;
      // A slow turn on both axes, leaning toward the pointer.
      tiltX += (mouseX - tiltX) * 0.05;
      tiltY += (mouseY - tiltY) * 0.05;
      const yaw = Math.sin(t * 0.45) * 0.6 + tiltX * 0.45;
      const pitch = Math.sin(t * 0.32) * 0.2 - tiltY * 0.3;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      // Two passes per colour: the far half dimmer, then the near half on top.
      for (const near of [false, true]) {
        ctx.globalAlpha = near ? 1 : 0.45;
        for (let c = 0; c < COLORS.length; c++) {
          ctx.fillStyle = COLORS[c] ?? "#d21319";
          ctx.beginPath();
          for (let i = c; i < COUNT; i += COLORS.length) {
            const [ox, oy, oz] = points[i] ?? [0, 0, 0];
            const x1 = ox * cosY + oz * sinY;
            const z1 = -ox * sinY + oz * cosY;
            const y2 = oy * cosP - z1 * sinP;
            const z2 = oy * sinP + z1 * cosP;
            if (z2 < 0 !== near) continue;
            const scale = FOCAL / (FOCAL + z2);
            const p = phase[i] ?? 0;
            const gx = anchorX + x1 * scale + Math.sin(t * 1.3 + p) * 0.7;
            const gy = anchorY + y2 * scale + Math.cos(t * 1.1 + p) * 0.7;
            const lastX = px[i] ?? gx;
            const lastY = py[i] ?? gy;
            // Far from home the dots stream at their own pace; close by they lock on, so the turn stays crisp.
            const k = Math.abs(gx - lastX) + Math.abs(gy - lastY) > 40 ? (speed[i] ?? 0.06) : 0.35;
            const x = lastX + (gx - lastX) * k;
            const y = lastY + (gy - lastY) * k;
            px[i] = x;
            py[i] = y;
            if (y < -20 || y > vh + 20) continue;
            const size = (i % 7 === 0 ? 2.3 : 1.5) * scale;
            ctx.rect(x - size / 2, y - size / 2, size, size);
          }
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const start = () => {
      if (running || !desktop.matches) return;
      running = true;
      resize();
      canvas.hidden = false;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
      canvas.hidden = true;
      placed = false;
      active = null;
    };
    const onMedia = () => (desktop.matches ? start() : stop());
    const onResize = () => running && resize();

    start();
    desktop.addEventListener("change", onMedia);
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      stop();
      desktop.removeEventListener("change", onMedia);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return <canvas ref={canvasRef} className="particle-field" aria-hidden="true" hidden />;
}
