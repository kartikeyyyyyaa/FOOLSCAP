"use client";

import { useMemo, useState } from "react";
import CompareView from "./CompareView";
import Heatmap from "./Heatmap";
import TopicTracker from "./TopicTracker";
import { demoAttempts } from "@/lib/demo";
import { dayStreak } from "@/lib/stats";

/**
 * The landing page version of the progress panel, driven by the demo history
 * so the section is populated before a visitor has answered anything. It uses
 * the same components as the live tool, so nothing here is a mockup.
 */
export default function ProgressShowcase() {
  const attempts = useMemo(() => demoAttempts(), []);
  const [picked, setPicked] = useState<string | null>(
    "Nucleophilic substitution: SN1 against SN2",
  );

  return (
    <div className="showreel">
      <div className="panel-lite wide">
        <div className="panel-lite-head">
          <span className="panel-lite-t">Revision activity</span>
          <div className="streak">
            <span className="streak-n">{dayStreak(attempts)}</span>
            <span className="streak-l">day streak</span>
          </div>
        </div>
        <Heatmap attempts={attempts} />
      </div>

      <div className="panel-lite">
        <div className="panel-lite-head">
          <span className="panel-lite-t">Per topic</span>
          <span className="mono-s">Accuracy by section</span>
        </div>
        <TopicTracker attempts={attempts} onPick={setPicked} selected={picked} />
      </div>

      <div className="panel-lite">
        <div className="panel-lite-head">
          <span className="panel-lite-t">Attempt against attempt</span>
          <span className="mono-s">Same topic, two sittings</span>
        </div>
        <CompareView attempts={attempts} topicTitle={picked} />
      </div>
    </div>
  );
}
