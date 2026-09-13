"use client";

import { useCallback, useRef, useState } from "react";
import { ExtractError, countWords, extractText } from "@/lib/extract";
import type { Depth } from "@/lib/types";

const SUBJECT_CHIPS = [
  "Operating Systems",
  "Organic Chemistry",
  "Microeconomics",
  "Data Structures",
];

const FORMATS = ["PDF", "DOCX", "PPTX", "TXT", "MD"];

interface Props {
  subject: string;
  depth: Depth;
  count: number;
  busy: boolean;
  onSource: (text: string) => void;
  onSubject: (value: string) => void;
  onDepth: (value: Depth) => void;
  onCount: (value: number) => void;
  onGenerate: () => void;
}

export default function SourcePanel({
  subject,
  depth,
  count,
  busy,
  onSource,
  onSubject,
  onDepth,
  onCount,
  onGenerate,
}: Props) {
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [loaded, setLoaded] = useState<{ name: string; text: string } | null>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setFileError(null);
      setReading(true);
      try {
        const text = await extractText(file);
        if (countWords(text) < 40) {
          throw new ExtractError(
            `Only ${countWords(text)} words came out of that file. It may be a scan or mostly images. Paste the text instead.`,
          );
        }
        setLoaded({ name: file.name, text });
        onSource(text);
      } catch (err) {
        setLoaded(null);
        onSource("");
        setFileError(
          err instanceof Error ? err.message : "That file could not be read. Try another format.",
        );
      } finally {
        setReading(false);
      }
    },
    [onSource],
  );

  const clear = useCallback(() => {
    setLoaded(null);
    onSource("");
    if (inputRef.current) inputRef.current.value = "";
  }, [onSource]);

  return (
    <section className="card" aria-labelledby="srcH">
      <div className="card-head">
        <h3 className="card-h" id="srcH">
          Source material
        </h3>
        <button
          className="btn-text"
          type="button"
          onClick={() => setMode((m) => (m === "file" ? "paste" : "file"))}
        >
          {mode === "file" ? "Paste text" : "Use a file"}
        </button>
      </div>

      <div className="card-body">
        {mode === "file" && !loaded && (
          <>
            <div
              className={`drop${dragging ? " is-drag" : ""}`}
              role="button"
              tabIndex={0}
              aria-label="Choose a file, or drag one here"
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void handleFile(e.dataTransfer.files[0]);
              }}
            >
              <span className="drop-t">{reading ? "Reading the file" : "Drop a lecture file"}</span>
              <span className="drop-h">
                Slide decks, handouts, chapter exports. Or click to browse.
              </span>
              <div className="fmts">
                {FORMATS.map((f) => (
                  <span className="fmt" key={f}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
            <input
              ref={inputRef}
              id="file"
              type="file"
              className="sr"
              accept=".pdf,.docx,.pptx,.txt,.md,.markdown"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </>
        )}

        {mode === "file" && loaded && (
          <div className="loaded">
            <div className="loaded-top">
              <div>
                <div className="loaded-n">{loaded.name}</div>
                <div className="loaded-s">{countWords(loaded.text).toLocaleString()} words read</div>
              </div>
              <button className="btn btn-ghost btn-sm" type="button" onClick={clear}>
                Replace
              </button>
            </div>
            <div className="excerpt">{loaded.text.slice(0, 440)}</div>
          </div>
        )}

        {mode === "paste" && (
          <>
            <label className="sr" htmlFor="pasteBox">
              Paste your lecture text
            </label>
            <textarea
              id="pasteBox"
              className="paste"
              placeholder="Paste lecture text, a transcript, or your own rough notes here."
              onChange={(e) => onSource(e.target.value)}
            />
          </>
        )}

        {fileError && (
          <div className="notice" data-tone="error">
            <b>Could not read that file</b>
            <span>{fileError}</span>
          </div>
        )}

        <div className="field">
          <label htmlFor="subject">Subject or course</label>
          <input
            id="subject"
            className="text"
            type="text"
            value={subject}
            autoComplete="off"
            placeholder="Operating Systems"
            onChange={(e) => onSubject(e.target.value)}
          />
          <div className="chips">
            {SUBJECT_CHIPS.map((s) => (
              <button className="chip" type="button" key={s} onClick={() => onSubject(s)}>
                {s}
              </button>
            ))}
          </div>
          <p className="field-help">Steers the terminology and what counts as exam-worthy.</p>
        </div>

        <div className="field">
          <label id="depthLbl">Revision depth</label>
          <div className="seg" role="group" aria-labelledby="depthLbl">
            <button type="button" aria-pressed={depth === "quick"} onClick={() => onDepth("quick")}>
              Quick pass
            </button>
            <button
              type="button"
              aria-pressed={depth === "thorough"}
              onClick={() => onDepth("thorough")}
            >
              Thorough
            </button>
          </div>
          <p className="field-help">
            {depth === "thorough"
              ? "Fuller coverage, closer to a long-answer question. Takes a little longer."
              : "A tight sheet you can read in ten minutes."}
          </p>
        </div>

        <div className="field">
          <label id="countLbl">Quiz length</label>
          <div className="seg" role="group" aria-labelledby="countLbl">
            <button type="button" aria-pressed={count === 5} onClick={() => onCount(5)}>
              5 questions
            </button>
            <button type="button" aria-pressed={count === 10} onClick={() => onCount(10)}>
              10 questions
            </button>
          </div>
        </div>

        <button
          className="btn btn-fill"
          type="button"
          style={{ width: "100%" }}
          disabled={busy || reading}
          onClick={onGenerate}
        >
          {busy ? "Working" : reading ? "Reading the file" : "Make revision notes"}
        </button>
        <p className="field-help">
          The file is read in this browser. Only the extracted text is sent to Gemini.
        </p>
      </div>
    </section>
  );
}
