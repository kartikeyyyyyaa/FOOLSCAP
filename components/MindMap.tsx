"use client";

import { useMemo } from "react";
import { isHighYield } from "@/lib/reading";
import type { RevisionSheet } from "@/lib/types";

/**
 * The sheet as a map rather than a list.
 *
 * Drawn as SVG from the sections that already exist, so it cannot show a
 * relationship the sheet does not contain. It is a second view of the same
 * material, not a second opinion about it: headings become branches, and the
 * points under them stay in the order the sheet put them.
 */

const CARD_W = 214;
const CENTRE_W = 190;
const GAP_X = 86;
const GAP_Y = 18;
const PAD = 13;

const HEAD_LH = 17;
const POINT_LH = 15;
const MAX_POINTS = 3;

/** Rough, but consistent: the layout only needs to know how tall a card is. */
function wrap(text: string, charsPerLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= charsPerLine) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }

  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (last.length > charsPerLine - 1 || words.join(" ").length > lines.join(" ").length) {
      lines[maxLines - 1] = `${last.slice(0, charsPerLine - 1).trimEnd()}…`;
    }
  }
  return lines;
}

interface Node {
  heading: string[];
  points: string[][];
  side: "left" | "right";
  x: number;
  y: number;
  height: number;
}

export default function MindMap({ sheet }: { sheet: RevisionSheet }) {
  const { nodes, width, height, centreY } = useMemo(() => {
    const terms = sheet.concepts.map((c) => c.term);

    const cards = sheet.sections.map((section) => {
      // The high-yield points first, because a map that truncates should keep
      // the examinable lines rather than the first three it happened to find.
      const ordered = [...section.points].sort(
        (a, b) => Number(isHighYield(b, terms)) - Number(isHighYield(a, terms)),
      );

      const heading = wrap(section.heading, 23, 2);
      const points = ordered.slice(0, MAX_POINTS).map((p) => wrap(p, 27, 2));
      const body = points.reduce((n, lines) => n + lines.length * POINT_LH + 6, 0);

      return { heading, points, height: PAD * 2 + heading.length * HEAD_LH + 6 + body };
    });

    // Alternate sides so the map stays balanced whatever the section count.
    const left = cards.filter((_, i) => i % 2 === 1);
    const right = cards.filter((_, i) => i % 2 === 0);

    const stack = (list: typeof cards) =>
      list.reduce((n, c) => n + c.height + GAP_Y, 0) - GAP_Y;

    const leftH = Math.max(stack(left), 0);
    const rightH = Math.max(stack(right), 0);
    const total = Math.max(leftH, rightH, 120);

    const placed: Node[] = [];
    let ly = (total - leftH) / 2;
    let ry = (total - rightH) / 2;

    for (const card of cards) {
      const side = right.includes(card) ? "right" : "left";
      const y = side === "left" ? ly : ry;
      placed.push({
        ...card,
        side,
        x: side === "left" ? 0 : CARD_W + GAP_X * 2 + CENTRE_W,
        y,
      });
      if (side === "left") ly += card.height + GAP_Y;
      else ry += card.height + GAP_Y;
    }

    return {
      nodes: placed,
      width: CARD_W * 2 + CENTRE_W + GAP_X * 2,
      height: total,
      centreY: total / 2,
    };
  }, [sheet]);

  const centreX = CARD_W + GAP_X;
  const titleLines = wrap(sheet.title, 20, 3);
  const centreH = PAD * 2 + titleLines.length * 19;

  return (
    <div className="map">
      <div className="map-scroll">
        <svg
          className="map-svg"
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label={`Mind map of ${sheet.title}`}
        >
          {nodes.map((node) => {
            const from = node.side === "left" ? centreX : centreX + CENTRE_W;
            const to = node.side === "left" ? CARD_W : node.x;
            const toY = node.y + node.height / 2;
            const mid = (from + to) / 2;

            return (
              <path
                className="map-link"
                key={`link-${node.heading.join()}-${node.y}`}
                d={`M ${from} ${centreY} C ${mid} ${centreY}, ${mid} ${toY}, ${to} ${toY}`}
              />
            );
          })}

          <g>
            <rect
              className="map-centre"
              x={centreX}
              y={centreY - centreH / 2}
              width={CENTRE_W}
              height={centreH}
              rx={12}
            />
            {titleLines.map((line, i) => (
              <text
                className="map-title"
                key={line}
                x={centreX + CENTRE_W / 2}
                y={centreY - centreH / 2 + PAD + 14 + i * 19}
                textAnchor="middle"
              >
                {line}
              </text>
            ))}
          </g>

          {nodes.map((node) => {
            let cursor = node.y + PAD + 12;
            return (
              <g key={`card-${node.heading.join()}-${node.y}`}>
                <rect
                  className="map-card"
                  x={node.x}
                  y={node.y}
                  width={CARD_W}
                  height={node.height}
                  rx={10}
                />
                {node.heading.map((line, i) => (
                  <text className="map-head" key={line} x={node.x + PAD} y={cursor + i * HEAD_LH}>
                    {line}
                  </text>
                ))}
                {(() => {
                  cursor += node.heading.length * HEAD_LH + 4;
                  return node.points.map((lines, pi) => {
                    const block = lines.map((line, li) => (
                      <text
                        className="map-point"
                        key={`${pi}-${li}-${line}`}
                        x={node.x + PAD + 9}
                        y={cursor + li * POINT_LH}
                      >
                        {line}
                      </text>
                    ));
                    const dot = (
                      <circle
                        className="map-dot"
                        key={`dot-${pi}`}
                        cx={node.x + PAD + 3}
                        cy={cursor - 4}
                        r={2}
                      />
                    );
                    cursor += lines.length * POINT_LH + 6;
                    return [dot, ...block];
                  });
                })()}
              </g>
            );
          })}
        </svg>
      </div>

      <p className="reel-note">
        Drawn from the sheet itself. Each branch is a section heading, and the lines under it are
        that section&apos;s most examinable points, in the order they were written.
      </p>
    </div>
  );
}
