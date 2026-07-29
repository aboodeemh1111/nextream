"use client";

import { useEffect, useRef } from "react";

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  layer: number;
  charge: number;
  chargeSpeed: number;
  hub: boolean;
};

type Edge = {
  a: number;
  b: number;
  strength: number;
};

type Signal = {
  edge: number;
  t: number;
  speed: number;
  dir: 1 | -1;
  intensity: number;
};

type Rgb = { r: number; g: number; b: number };

type ThemeCache = {
  primary: Rgb;
  background: Rgb;
  foreground: Rgb;
  isDark: boolean;
  washPrimary: string;
  washAccent: string;
  washEnd: string;
  edgeFg: string;
  edgePrimary: string;
  nodePrimary: string;
  nodeAccent: string;
  hubGlow: string;
  nodeGlowPrimary: string;
  nodeGlowAccent: string;
  signalPrimary: string;
  signalAccent: string;
  signalTrailPrimary: string;
  signalTrailAccent: string;
  arrivalPrimary: string;
  arrivalAccent: string;
};

const ACCENT: Rgb = { r: 56, g: 189, b: 248 };
const TWO_PI = Math.PI * 2;
const FRAME_MS = 1000 / 30;
const MAX_SIGNALS = 20;
const REBUILD_EVERY = 180;

function readCssColor(varName: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return value || fallback;
}

function hexToRgb(hex: string): Rgb | null {
  const cleaned = hex.replace("#", "").trim();
  if (cleaned.length === 3) {
    return {
      r: parseInt(cleaned[0] + cleaned[0], 16),
      g: parseInt(cleaned[1] + cleaned[1], 16),
      b: parseInt(cleaned[2] + cleaned[2], 16),
    };
  }
  if (cleaned.length === 6) {
    return {
      r: parseInt(cleaned.slice(0, 2), 16),
      g: parseInt(cleaned.slice(2, 4), 16),
      b: parseInt(cleaned.slice(4, 6), 16),
    };
  }
  return null;
}

function parseColor(input: string): Rgb {
  const hex = hexToRgb(input);
  if (hex) return hex;

  const rgbMatch = input.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i,
  );
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    };
  }

  return { r: 220, g: 38, b: 38 };
}

function rgba(color: Rgb, alpha: number): string {
  return `rgba(${color.r},${color.g},${color.b},${alpha})`;
}

function clamp(value: number, min: number, max: number) {
  return value < min ? min : value > max ? max : value;
}

function createNodes(width: number, height: number, count: number): Node[] {
  const layers = 5;
  const nodes: Node[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const layer = i % layers;
    const bandX = ((layer + 0.5) / layers) * width;
    const hub = Math.random() < 0.12;
    nodes[i] = {
      x: clamp(
        bandX + (Math.random() - 0.5) * (width / layers) * 1.35,
        16,
        width - 16,
      ),
      y: 16 + Math.random() * (height - 32),
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      size: hub ? 2.8 + Math.random() * 2.2 : 1.2 + Math.random() * 1.8,
      layer,
      charge: Math.random() * TWO_PI,
      chargeSpeed: 0.01 + Math.random() * 0.03,
      hub,
    };
  }
  return nodes;
}

/** Spatial-hash neighbor linking — O(n * cellNeighbors) instead of O(n²). */
function buildEdges(
  nodes: Node[],
  width: number,
  height: number,
  maxDist: number,
  maxEdges: number,
): { edges: Edge[]; adjacency: number[][] } {
  const count = nodes.length;
  const cellSize = Math.max(24, maxDist);
  const gridCols = Math.max(1, Math.ceil(width / cellSize));
  const gridRows = Math.max(1, Math.ceil(height / cellSize));
  const grid: number[][] = new Array(gridCols * gridRows);
  for (let i = 0; i < grid.length; i++) grid[i] = [];

  for (let i = 0; i < count; i++) {
    const cx = clamp(Math.floor(nodes[i].x / cellSize), 0, gridCols - 1);
    const cy = clamp(Math.floor(nodes[i].y / cellSize), 0, gridRows - 1);
    grid[cy * gridCols + cx].push(i);
  }

  const maxDistSq = maxDist * maxDist;
  const edges: Edge[] = [];
  const paired = new Uint8Array(count * count);

  for (let i = 0; i < count; i++) {
    const a = nodes[i];
    const cx = clamp(Math.floor(a.x / cellSize), 0, gridCols - 1);
    const cy = clamp(Math.floor(a.y / cellSize), 0, gridRows - 1);

    for (let oy = -1; oy <= 1; oy++) {
      const ny = cy + oy;
      if (ny < 0 || ny >= gridRows) continue;
      for (let ox = -1; ox <= 1; ox++) {
        const nx = cx + ox;
        if (nx < 0 || nx >= gridCols) continue;
        const bucket = grid[ny * gridCols + nx];

        for (let k = 0; k < bucket.length; k++) {
          const j = bucket[k];
          if (j <= i) continue;

          const key = i * count + j;
          if (paired[key]) continue;
          paired[key] = 1;

          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > maxDistSq || distSq === 0) continue;

          const layerGap =
            a.layer > b.layer ? a.layer - b.layer : b.layer - a.layer;
          if (layerGap > 2) continue;

          const dist = Math.sqrt(distSq);
          const layerBias = layerGap === 1 ? 1.35 : layerGap === 0 ? 0.75 : 1;
          const hubBias = a.hub || b.hub ? 1.25 : 1;
          edges.push({
            a: i,
            b: j,
            strength: (1 - dist / maxDist) * layerBias * hubBias,
          });
        }
      }
    }
  }

  if (edges.length > maxEdges) {
    edges.sort((x, y) => y.strength - x.strength);
    edges.length = maxEdges;
  }

  const adjacency: number[][] = new Array(count);
  for (let i = 0; i < count; i++) adjacency[i] = [];
  for (let e = 0; e < edges.length; e++) {
    adjacency[edges[e].a].push(e);
    adjacency[edges[e].b].push(e);
  }

  return { edges, adjacency };
}

function buildTheme(): ThemeCache {
  const primary = parseColor(readCssColor("--primary", "#dc2626"));
  const background = parseColor(readCssColor("--background", "#f6f7f9"));
  const foreground = parseColor(readCssColor("--foreground", "#0d1117"));
  const isDark =
    document.documentElement.classList.contains("dark") ||
    background.r + background.g + background.b < 120;

  return {
    primary,
    background,
    foreground,
    isDark,
    washPrimary: rgba(primary, isDark ? 0.12 : 0.08),
    washAccent: rgba(ACCENT, isDark ? 0.04 : 0.03),
    washEnd: rgba(background, 0),
    edgeFg: rgba(foreground, isDark ? 0.11 : 0.08),
    edgePrimary: rgba(primary, isDark ? 0.1 : 0.07),
    nodePrimary: rgba(primary, isDark ? 0.8 : 0.62),
    nodeAccent: rgba(ACCENT, isDark ? 0.75 : 0.55),
    hubGlow: rgba(primary, isDark ? 0.12 : 0.08),
    nodeGlowPrimary: rgba(primary, isDark ? 0.14 : 0.1),
    nodeGlowAccent: rgba(ACCENT, isDark ? 0.14 : 0.1),
    signalPrimary: rgba(primary, isDark ? 0.9 : 0.75),
    signalAccent: rgba(ACCENT, isDark ? 0.9 : 0.75),
    signalTrailPrimary: rgba(primary, isDark ? 0.55 : 0.4),
    signalTrailAccent: rgba(ACCENT, isDark ? 0.55 : 0.4),
    arrivalPrimary: rgba(primary, isDark ? 0.16 : 0.1),
    arrivalAccent: rgba(ACCENT, isDark ? 0.16 : 0.1),
  };
}

function qualityProfile(width: number, height: number) {
  const area = width * height;
  const cores = navigator.hardwareConcurrency || 4;
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean };
    }
  ).connection;
  const lowPower = cores <= 4 || connection?.saveData === true || area > 1_600_000;

  if (lowPower) {
    return {
      nodeCount: clamp(Math.round(area / 14000), 40, 72),
      maxEdges: clamp(Math.round(area / 5000), 90, 160),
      maxSignals: 14,
      dprCap: 1.25,
    };
  }

  return {
    nodeCount: clamp(Math.round(area / 10000), 55, 96),
    maxEdges: clamp(Math.round(area / 3800), 120, 220),
    maxSignals: MAX_SIGNALS,
    dprCap: 1.5,
  };
}

export default function StreamNetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });
    if (!ctx) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = 0;
    let disposed = false;
    let running = false;
    let frame = 0;
    let lastTs = 0;
    let resizeRaf = 0;

    const pointer = { x: 0, y: 0, active: false };
    let theme = buildTheme();

    let nodes: Node[] = [];
    let edges: Edge[] = [];
    let adjacency: number[][] = [];
    let signals: Signal[] = [];
    let signalCount = 0;
    let maxDist = 140;
    let maxEdges = 160;
    let maxSignals = MAX_SIGNALS;
    let rebuildTimer = 0;
    let washGradient: CanvasGradient | null = null;

    const signalPool: Signal[] = [];

    const acquireSignal = (): Signal =>
      signalPool.pop() || {
        edge: 0,
        t: 0,
        speed: 0,
        dir: 1,
        intensity: 0,
      };

    const releaseSignal = (s: Signal) => {
      signalPool.push(s);
    };

    const refreshTheme = () => {
      theme = buildTheme();
      washGradient = null;
    };

    const ensureWash = () => {
      if (washGradient) return washGradient;
      const g = ctx.createRadialGradient(
        width * 0.5,
        height * 0.35,
        0,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.85,
      );
      g.addColorStop(0, theme.washPrimary);
      g.addColorStop(0.5, theme.washAccent);
      g.addColorStop(1, theme.washEnd);
      washGradient = g;
      return g;
    };

    const spawnSignal = () => {
      if (!edges.length || signalCount >= maxSignals) return;
      const s = acquireSignal();
      s.edge = Math.floor(Math.random() * edges.length);
      s.t = 0;
      s.speed = 0.01 + Math.random() * 0.02;
      s.dir = Math.random() > 0.35 ? 1 : -1;
      s.intensity = 0.55 + Math.random() * 0.45;
      signals[signalCount++] = s;
    };

    const removeSignal = (index: number) => {
      const last = signalCount - 1;
      const removed = signals[index];
      signals[index] = signals[last];
      signalCount = last;
      releaseSignal(removed);
    };

    const rewire = () => {
      const built = buildEdges(nodes, width, height, maxDist, maxEdges);
      edges = built.edges;
      adjacency = built.adjacency;
      for (let i = signalCount - 1; i >= 0; i--) {
        if (signals[i].edge >= edges.length) removeSignal(i);
      }
    };

    const resize = () => {
      const parent = canvas.parentElement;
      width = parent?.clientWidth || window.innerWidth;
      height = parent?.clientHeight || window.innerHeight;
      if (width < 2 || height < 2) {
        width = window.innerWidth;
        height = window.innerHeight;
      }

      const quality = qualityProfile(width, height);
      dpr = Math.min(window.devicePixelRatio || 1, quality.dprCap);
      maxEdges = quality.maxEdges;
      maxSignals = quality.maxSignals;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      maxDist = clamp(Math.min(width, height) * 0.2, 100, 150);
      nodes = createNodes(width, height, quality.nodeCount);
      signalCount = 0;
      signals.length = 0;
      rewire();
      for (let i = 0; i < Math.min(12, maxSignals); i++) spawnSignal();
      rebuildTimer = 0;
      washGradient = null;
    };

    const scheduleResize = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        resize();
      });
    };

    const drawStatic = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = ensureWash();
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = theme.edgeFg;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        const a = nodes[e.a];
        const b = nodes[e.b];
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();

      ctx.fillStyle = theme.nodePrimary;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size, 0, TWO_PI);
        ctx.fill();
      }
    };

    const tick = (ts: number) => {
      if (disposed) return;
      rafId = requestAnimationFrame(tick);
      if (document.hidden) return;

      const elapsed = ts - lastTs;
      if (elapsed < FRAME_MS) return;
      lastTs = ts - (elapsed % FRAME_MS);
      frame += 1;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = ensureWash();
      ctx.fillRect(0, 0, width, height);

      const ptrActive = pointer.active;
      const ptrX = pointer.x;
      const ptrY = pointer.y;
      const w = width;
      const h = height;

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        node.charge += node.chargeSpeed;
        node.x += node.vx;
        node.y += node.vy;

        if (ptrActive) {
          const dx = ptrX - node.x;
          const dy = ptrY - node.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 28900 && distSq > 0.001) {
            const dist = Math.sqrt(distSq);
            const pull = (1 - dist / 170) * 0.05;
            node.vx += (dx / dist) * pull;
            node.vy += (dy / dist) * pull;
          }
        }

        if (((frame + i) & 1) === 0) {
          node.vx += (Math.random() - 0.5) * 0.004;
          node.vy += (Math.random() - 0.5) * 0.004;
        }

        node.vx *= 0.99;
        node.vy *= 0.99;
        if (node.vx > 0.28) node.vx = 0.28;
        else if (node.vx < -0.28) node.vx = -0.28;
        if (node.vy > 0.28) node.vy = 0.28;
        else if (node.vy < -0.28) node.vy = -0.28;

        if (node.x < 12 || node.x > w - 12) node.vx *= -1;
        if (node.y < 12 || node.y > h - 12) node.vy *= -1;
        if (node.x < 10) node.x = 10;
        else if (node.x > w - 10) node.x = w - 10;
        if (node.y < 10) node.y = 10;
        else if (node.y > h - 10) node.y = h - 10;
      }

      rebuildTimer += 1;
      if (rebuildTimer >= REBUILD_EVERY) {
        rebuildTimer = 0;
        rewire();
      }

      // Batch edge strokes into two paths
      ctx.strokeStyle = theme.edgeFg;
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        const a = nodes[e.a];
        const b = nodes[e.b];
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();

      ctx.strokeStyle = theme.edgePrimary;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        if (e.strength <= 0.75) continue;
        const a = nodes[e.a];
        const b = nodes[e.b];
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();

      if (signalCount < maxSignals && (frame & 3) === 0) spawnSignal();

      ctx.lineCap = "round";
      for (let i = signalCount - 1; i >= 0; i--) {
        const signal = signals[i];
        const edge = edges[signal.edge];
        if (!edge) {
          removeSignal(i);
          continue;
        }

        const a = nodes[edge.a];
        const b = nodes[edge.b];
        signal.t += signal.speed;

        if (signal.t >= 1) {
          const arrived = signal.dir === 1 ? edge.b : edge.a;
          const intensity = signal.intensity;
          removeSignal(i);

          const neighbors = adjacency[arrived];
          if (neighbors && signalCount < maxSignals) {
            let cascaded = 0;
            for (
              let n = 0;
              n < neighbors.length && cascaded < 2 && signalCount < maxSignals;
              n++
            ) {
              if (Math.random() > 0.5) continue;
              const eIdx = neighbors[n];
              const next = edges[eIdx];
              const s = acquireSignal();
              s.edge = eIdx;
              s.t = 0;
              s.speed = 0.012 + Math.random() * 0.02;
              s.dir = next.a === arrived ? 1 : -1;
              s.intensity = intensity * (0.7 + Math.random() * 0.3);
              signals[signalCount++] = s;
              cascaded += 1;
            }
          }
          continue;
        }

        const t = signal.dir === 1 ? signal.t : 1 - signal.t;
        const ease = t * t * (3 - 2 * t);
        const x = a.x + (b.x - a.x) * ease;
        const y = a.y + (b.y - a.y) * ease;
        const hot = signal.intensity > 0.75;
        const trailT = t > 0.08 ? t - 0.08 : 0;
        const trailEase = trailT * trailT * (3 - 2 * trailT);

        ctx.strokeStyle = hot
          ? theme.signalTrailPrimary
          : theme.signalTrailAccent;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(a.x + (b.x - a.x) * trailEase, a.y + (b.y - a.y) * trailEase);
        ctx.lineTo(x, y);
        ctx.stroke();

        ctx.fillStyle = hot ? theme.signalPrimary : theme.signalAccent;
        ctx.beginPath();
        ctx.arc(x, y, 1.6 + signal.intensity * 1.2, 0, TWO_PI);
        ctx.fill();

        if (t > 0.85) {
          const target = signal.dir === 1 ? b : a;
          ctx.fillStyle = hot ? theme.arrivalPrimary : theme.arrivalAccent;
          ctx.beginPath();
          ctx.arc(target.x, target.y, target.size * 2.8, 0, TWO_PI);
          ctx.fill();
        }
      }

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const charge = 0.5 + 0.5 * Math.sin(node.charge);
        const radius = node.size * (0.9 + 0.25 * charge);

        if (node.hub) {
          ctx.fillStyle = theme.hubGlow;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius * 2.8, 0, TWO_PI);
          ctx.fill();
        }

        ctx.fillStyle = node.hub ? theme.nodeGlowPrimary : theme.nodeGlowAccent;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 1.6, 0, TWO_PI);
        ctx.fill();

        ctx.fillStyle = node.hub ? theme.nodePrimary : theme.nodeAccent;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, TWO_PI);
        ctx.fill();
      }
    };

    const start = () => {
      if (running || disposed || reducedMotion) return;
      running = true;
      lastTs = performance.now();
      rafId = requestAnimationFrame(tick);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(rafId);
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
    };

    const onPointerLeave = () => {
      pointer.active = false;
    };

    const onThemeMutation = () => {
      refreshTheme();
      if (reducedMotion) drawStatic();
    };

    resize();
    refreshTheme();

    window.addEventListener("resize", scheduleResize, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);

    const themeObserver = new MutationObserver(onThemeMutation);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });

    if (reducedMotion) {
      drawStatic();
    } else {
      start();
    }

    return () => {
      disposed = true;
      stop();
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      window.removeEventListener("resize", scheduleResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
