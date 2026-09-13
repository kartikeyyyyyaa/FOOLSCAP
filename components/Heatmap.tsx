"use client";

import { useEffect, useRef, useState } from "react";
import { heatmapCells } from "@/lib/stats";
import type { Attempt } from "@/lib/types";

const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;
const ROWS = 7;
const LABEL_H = 16;

/**
 * The grid is drawn on canvas, so it cannot inherit CSS. Read the palette
 * from the stylesheet instead of hardcoding it, so the light and dark token
 * blocks stay the single source of truth.
 */
function themeColor(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function readPalette() {
  return {
    levels: [
      themeColor("--heat-0", "#EEF2F8"),
      themeColor("--heat-1", "#D9D4FB"),
      themeColor("--heat-2", "#B4AAF6"),
      themeColor("--heat-3", "#7F6FEE"),
      themeColor("--heat-4", "#4633E0"),
    ],
    snake: themeColor("--heat-snake", "#0E2440"),
    label: themeColor("--heat-label", "#93A0B8"),
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Props {
  attempts: Attempt[];
  /** Runs the snake. Off under reduced motion regardless. */
  animate?: boolean;
}

/**
 * A GitHub-style activity grid with a snake that eats the filled days.
 *
 * Canvas rather than 180 DOM nodes: the snake redraws every frame, and a grid
 * of divs would thrash layout. The grid still reads correctly when the
 * animation is off, which is what reduced-motion viewers and the first paint
 * both get.
 */
export default function Heatmap({ attempts, animate = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [weeks, setWeeks] = useState(26);
  const [hover, setHover] = useState<string | null>(null);

  // Fit the number of weeks to the available width.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const measure = () => {
      const fit = Math.floor((el.clientWidth - 2) / STEP);
      setWeeks(Math.max(8, Math.min(53, fit)));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const grid = heatmapCells(attempts, weeks);
    const width = weeks * STEP - GAP;
    const height = ROWS * STEP - GAP + LABEL_H;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Levels the snake mutates, kept apart from the real data.
    const levels = grid.map((col) => col.map((c) => c.level as number));
    const original = grid.map((col) => col.map((c) => c.level as number));

    // Serpentine path: each row reverses, so the end of one row joins the
    // start of the next and the snake never teleports.
    const path: { x: number; y: number }[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let i = 0; i < weeks; i++) {
        path.push({ x: y % 2 === 0 ? i : weeks - 1 - i, y });
      }
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const running = animate && !reduced;

    let palette = readPalette();
    const repalette = () => {
      palette = readPalette();
    };
    const themeObserver = new MutationObserver(repalette);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const schemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    schemeQuery.addEventListener("change", repalette);

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fill();
    };

    const drawMonths = () => {
      ctx.fillStyle = palette.label;
      ctx.font = '10px ui-monospace, "SFMono-Regular", Menlo, monospace';
      ctx.textBaseline = "top";
      let lastMonth = -1;
      grid.forEach((col, w) => {
        const m = col[0].date.getMonth();
        if (m !== lastMonth && w < weeks - 1) {
          ctx.fillText(MONTHS[m], w * STEP, 2);
          lastMonth = m;
        }
      });
    };

    const SNAKE_LEN = 7;
    let t = 0;
    let raf = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      ctx.clearRect(0, 0, width, height);
      drawMonths();

      if (running) {
        t += dt * 11;
        if (t >= path.length) {
          t = 0;
          for (let w = 0; w < weeks; w++) {
            for (let d = 0; d < ROWS; d++) levels[w][d] = original[w][d];
          }
        }
        const headIndex = Math.floor(t);
        const head = path[headIndex];
        if (head) levels[head.x][head.y] = 0;
      }

      for (let w = 0; w < weeks; w++) {
        for (let d = 0; d < ROWS; d++) {
          ctx.fillStyle = palette.levels[levels[w][d]];
          roundRect(w * STEP, LABEL_H + d * STEP, CELL, CELL, 2.5);
        }
      }

      if (running) {
        for (let s = 0; s < SNAKE_LEN; s++) {
          const idx = Math.floor(t) - s;
          if (idx < 0) continue;
          const cell = path[idx];
          const next = path[idx + 1];
          if (!cell) continue;

          // Interpolate toward the next cell so movement is not stepwise.
          const frac = t - Math.floor(t);
          const px = next ? cell.x + (next.x - cell.x) * frac : cell.x;
          const py = next ? cell.y + (next.y - cell.y) * frac : cell.y;

          const fade = 1 - s / (SNAKE_LEN + 1);
          ctx.globalAlpha = 0.28 + fade * 0.72;
          ctx.fillStyle = palette.snake;
          const pad = s === 0 ? 0 : 1;
          roundRect(px * STEP + pad, LABEL_H + py * STEP + pad, CELL - pad * 2, CELL - pad * 2, 3);
        }
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.floor((e.clientX - rect.left) / STEP);
      const d = Math.floor((e.clientY - rect.top - LABEL_H) / STEP);
      if (w < 0 || w >= weeks || d < 0 || d >= ROWS) {
        setHover(null);
        return;
      }
      const cell = grid[w][d];
      const label = cell.date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      });
      setHover(
        cell.count === 0
          ? `No revision on ${label}`
          : `${cell.count} ${cell.count === 1 ? "quiz" : "quizzes"} on ${label}`,
      );
    };

    const onLeave = () => setHover(null);

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      themeObserver.disconnect();
      schemeQuery.removeEventListener("change", repalette);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, [attempts, weeks, animate]);

  return (
    <div className="heat" ref={wrapRef}>
      <canvas ref={canvasRef} className="heat-canvas" />
      <div className="heat-foot">
        <span className="heat-hint">{hover ?? "Every finished quiz marks a day."}</span>
        <span className="heat-legend">
          Less
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} style={{ background: `var(--heat-${i})` }} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
