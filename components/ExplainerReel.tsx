"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExplainResponse, Reel, RevisionSheet } from "@/lib/types";

interface Props {
  sheet: RevisionSheet;
  isSample: boolean;
}

/**
 * A spoken explanation of the topic, composed in the browser.
 *
 * Gemini writes the script: scenes, what appears on screen, what is said over
 * each one. The narration is spoken by the browser's own speech synthesis, so
 * there is no audio file to fetch, no second API key, and nothing to wait for
 * after the script arrives. Captions carry the same words for anyone with the
 * sound off or no voice installed.
 */
export default function ExplainerReel({ sheet, isSample }: Props) {
  const [reel, setReel] = useState<Reel | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [long, setLong] = useState(false);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const [voiceOn, setVoiceOn] = useState(true);
  const [canSpeak, setCanSpeak] = useState(false);

  const frame = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const keepAlive = useRef<number | null>(null);

  // `speechSynthesis` existing is not the same as a voice being installed.
  // Plenty of Linux and Android browsers expose the API with an empty voice
  // list, where speak() ends instantly and the reel would race to the end. The
  // list also arrives asynchronously, hence the event.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const check = () => setCanSpeak(window.speechSynthesis.getVoices().length > 0);
    check();
    window.speechSynthesis.addEventListener("voiceschanged", check);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", check);
  }, []);

  // A different sheet means a different explanation. Keeping the old one on
  // screen under a new title would be a lie the player tells silently.
  useEffect(() => {
    setReel(null);
    setError(null);
    setIndex(0);
    setPlaying(false);
    setDone(false);
  }, [sheet.title]);

  const stopAll = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (keepAlive.current !== null) window.clearInterval(keepAlive.current);
    frame.current = null;
    timer.current = null;
    keepAlive.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  useEffect(() => stopAll, [stopAll]);

  const build = useCallback(async () => {
    if (busy) return;
    stopAll();
    setBusy(true);
    setError(null);
    setPlaying(false);
    setDone(false);
    setIndex(0);

    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet, length: long ? "long" : "short" }),
      });
      const payload: ExplainResponse = await res.json();

      if (!res.ok || !payload.reel) {
        setError(payload.error ?? "The explanation could not be written. Try again.");
        return;
      }
      setReel(payload.reel);
    } catch {
      setError("The request did not reach the server.");
    } finally {
      setBusy(false);
    }
  }, [busy, sheet, long, stopAll]);

  /* ---------------------------------------------------------------- *
   * Playback. One effect owns the clock, the voice and the teardown,
   * so there is exactly one place a scene can start or end.
   * ---------------------------------------------------------------- */
  useEffect(() => {
    if (!reel || !playing) {
      stopAll();
      return;
    }

    const scene = reel.scenes[index];
    if (!scene) return;

    // Cancelling speech fires `onend` in most browsers, which would otherwise
    // read as "the scene finished" and skip a scene every time you pause.
    let stopped = false;

    const advance = () => {
      if (stopped) return;
      if (index + 1 < reel.scenes.length) {
        setIndex(index + 1);
        setProgress(0);
      } else {
        setPlaying(false);
        setDone(true);
        setProgress(1);
      }
    };

    // Roughly the pace of a lecture voice. Used for the progress bar while a
    // voice is speaking, since speech synthesis reports no duration.
    const words = scene.narration.split(/\s+/).length;
    const spoken = Math.max((words / 2.6) * 1000, 3500);
    const silent = scene.seconds * 1000;
    const span = voiceOn && canSpeak ? spoken : silent;

    const started = performance.now();
    let last = 0;
    const tick = () => {
      const value = Math.min((performance.now() - started) / span, 1);
      // Repainting the whole player sixty times a second to move one bar is
      // waste, so the state only moves in visible steps.
      if (value - last > 0.02 || value === 1) {
        last = value;
        setProgress(value);
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    if (voiceOn && canSpeak) {
      const utterance = new SpeechSynthesisUtterance(scene.narration);
      utterance.rate = 0.98;
      utterance.pitch = 1;

      const voice = window.speechSynthesis
        .getVoices()
        .find((v) => /en[-_](GB|US|IN)/i.test(v.lang) && !/novelty|whisper/i.test(v.name));
      if (voice) utterance.voice = voice;

      // A scene that "finishes" in a fraction of its narration did not play:
      // the voice failed, or the utterance was dropped. Falling back to the
      // scene's own timing keeps it readable instead of flashing past.
      const settle = () => {
        const elapsed = performance.now() - started;
        if (elapsed < Math.min(2000, span * 0.4)) {
          timer.current = window.setTimeout(advance, Math.max(silent - elapsed, 1500));
          return;
        }
        advance();
      };

      utterance.onend = settle;
      utterance.onerror = settle;

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);

      // Chrome stops speaking after about fifteen seconds unless it is nudged.
      keepAlive.current = window.setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 9000);
    } else {
      timer.current = window.setTimeout(advance, silent);
    }

    return () => {
      stopped = true;
      stopAll();
    };
  }, [reel, playing, index, voiceOn, canSpeak, stopAll]);

  const jump = useCallback(
    (to: number) => {
      if (!reel) return;
      stopAll();
      setIndex(Math.max(0, Math.min(to, reel.scenes.length - 1)));
      setProgress(0);
      setDone(false);
    },
    [reel, stopAll],
  );

  /* ---------------------------------------------------------------- *
   * Before the script exists
   * ---------------------------------------------------------------- */
  if (!reel) {
    return (
      <div className="reel-empty">
        <h4 className="block-h">Watch the explanation</h4>
        <p className="ask-sub">
          Gemini writes a short spoken explainer from this sheet and your browser narrates it. Nothing
          is fetched from a video site, so every word comes from your own material.
        </p>

        {error && (
          <div className="notice" data-tone="error">
            <b>That did not work</b>
            <span>{error}</span>
          </div>
        )}

        <div className="reel-start">
          <div className="seg" role="group" aria-label="Length">
            <button type="button" aria-pressed={!long} onClick={() => setLong(false)}>
              About 2 minutes
            </button>
            <button type="button" aria-pressed={long} onClick={() => setLong(true)}>
              About 4 minutes
            </button>
          </div>

          <button className="btn btn-fill" type="button" onClick={() => void build()} disabled={busy}>
            {busy ? "Writing the script" : "Build the explanation"}
          </button>
        </div>

        {isSample && <p className="reel-note">This will explain the sample sheet.</p>}
        {!canSpeak && (
          <p className="reel-note">
            This browser has no speech voice installed, so the explainer plays on its own timing with
            captions instead.
          </p>
        )}
      </div>
    );
  }

  const scene = reel.scenes[index];
  const youtube = `https://www.youtube.com/results?search_query=${encodeURIComponent(reel.search)}`;

  return (
    <div className="reel">
      <div className="reel-stage" data-playing={playing ? "true" : "false"}>
        <div className="reel-meta">
          <span className="reel-count">
            {String(index + 1).padStart(2, "0")} / {String(reel.scenes.length).padStart(2, "0")}
          </span>
          <span className="reel-title">{reel.title}</span>
        </div>

        <div className="reel-slide" key={index}>
          <h3 className="reel-h">{scene.heading}</h3>
          <ul className="reel-lines">
            {scene.lines.map((line, i) => (
              <li key={line} style={{ animationDelay: `${0.12 + i * 0.1}s` }}>
                {line}
              </li>
            ))}
          </ul>
        </div>

        <p className="reel-caption">{scene.narration}</p>
      </div>

      <div className="reel-rail" aria-hidden="true">
        {reel.scenes.map((s, i) => (
          <span className="reel-seg" key={s.heading + i}>
            <span
              className="reel-fill"
              style={{ transform: `scaleX(${i < index ? 1 : i === index ? progress : 0})` }}
            />
          </span>
        ))}
      </div>

      <div className="reel-controls">
        <button
          className="btn btn-fill btn-sm"
          type="button"
          onClick={() => {
            if (done) {
              jump(0);
              setPlaying(true);
              return;
            }
            setPlaying((p) => !p);
          }}
        >
          {done ? "Watch again" : playing ? "Pause" : index === 0 && progress === 0 ? "Play" : "Resume"}
        </button>

        <button className="btn btn-ghost btn-sm" type="button" onClick={() => jump(index - 1)} disabled={index === 0}>
          Back
        </button>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={() => jump(index + 1)}
          disabled={index >= reel.scenes.length - 1}
        >
          Skip
        </button>

        {canSpeak && (
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            aria-pressed={voiceOn}
            onClick={() => {
              setVoiceOn((v) => !v);
              setProgress(0);
            }}
          >
            {voiceOn ? "Narration on" : "Narration off"}
          </button>
        )}

        <span className="reel-spacer" />

        <a className="btn btn-ghost btn-sm" href={youtube} target="_blank" rel="noreferrer noopener">
          Find a lecture on this
        </a>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => void build()} disabled={busy}>
          {busy ? "Rewriting" : "Rewrite"}
        </button>
      </div>

      {reel.promise && <p className="reel-note">{reel.promise}</p>}
    </div>
  );
}
