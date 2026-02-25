import React, { useMemo, useState } from "react";
import { ALL_KEYBOARDS, LayoutId } from "../keyboard";
import type { InteractionId } from "../interaction/types";

type Props = {
    promptCount: 2 | 3 | 4;
    setPromptCount: (v: 2 | 3 | 4) => void;

    selectedLayouts: LayoutId[];
    setSelectedLayouts: (v: LayoutId[] | ((prev: LayoutId[]) => LayoutId[])) => void;

    selectedInteractions: InteractionId[];
    setSelectedInteractions: (v: InteractionId[] | ((prev: InteractionId[]) => InteractionId[])) => void;
};

export default function StudyConfigPanel({
                                             promptCount,
                                             setPromptCount,
                                             selectedLayouts,
                                             setSelectedLayouts,
                                             selectedInteractions,
                                             setSelectedInteractions,
                                         }: Props) {
    const [open, setOpen] = useState(true);

    const layouts = useMemo(() => ALL_KEYBOARDS.map((k) => k.id), []);

    const toggleLayout = (id: LayoutId, checked: boolean) => {
        setSelectedLayouts((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return Array.from(next);
        });
    };

    const toggleInteraction = (id: InteractionId, checked: boolean) => {
        setSelectedInteractions((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return Array.from(next);
        });
    };

    return (
        <div className="card" style={{ marginTop: 12, width: "100%" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <div className="label">Study Configuration (admin)</div>
                    <div style={{ color: "#64748b", fontSize: 13, marginTop: 2 }}>
                        Configure layouts, interactions, and prompt count.
                    </div>
                </div>
                <button className="btn" onClick={() => setOpen((x) => !x)}>
                    {open ? "Hide" : "Show"}
                </button>
            </div>

            {open && (
                <div className="row" style={{ gap: 18, flexWrap: "wrap", marginTop: 10 }}>
                    <div>
                        <div className="label">Prompts per condition</div>
                        <select value={promptCount} onChange={(e) => setPromptCount(Number(e.target.value) as any)}>
                            <option value={2}>2 (practice + 1)</option>
                            <option value={3}>3 (practice + 2)</option>
                            <option value={4}>4 (practice + 3)</option>
                        </select>
                    </div>

                    <div>
                        <div className="label">Layouts included</div>
                        {layouts.map((lid) => (
                            <label key={lid} style={{ display: "block", fontSize: 13 }}>
                                <input
                                    type="checkbox"
                                    checked={selectedLayouts.includes(lid)}
                                    onChange={(e) => toggleLayout(lid, e.target.checked)}
                                />{" "}
                                {lid.toUpperCase()}
                            </label>
                        ))}
                    </div>

                    <div>
                        <div className="label">Interactions included</div>
                        {(["dwell", "hybrid_c", "dwell_free_c"] as InteractionId[]).map((iid) => (
                            <label key={iid} style={{ display: "block", fontSize: 13 }}>
                                <input
                                    type="checkbox"
                                    checked={selectedInteractions.includes(iid)}
                                    onChange={(e) => toggleInteraction(iid, e.target.checked)}
                                />{" "}
                                {iid}
                            </label>
                        ))}
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 8, maxWidth: 360 }}>
                            Note: Action mappings are fixed per interaction mode for this study (to keep participant
                            training consistent).
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
