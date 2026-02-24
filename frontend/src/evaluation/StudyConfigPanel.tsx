import React, { useMemo, useState } from "react";
import { ALL_KEYBOARDS, LayoutId } from "../keyboard";
import type { GazeEventType, InteractionId, InteractionMapping } from "../interaction/types";

type Props = {
    promptCount: 2 | 3 | 4;
    setPromptCount: (v: 2 | 3 | 4) => void;

    selectedLayouts: LayoutId[];
    setSelectedLayouts: (v: LayoutId[] | ((prev: LayoutId[]) => LayoutId[])) => void;

    selectedInteractions: InteractionId[];
    setSelectedInteractions: (v: InteractionId[] | ((prev: InteractionId[]) => InteractionId[])) => void;

    interactionMappingsByMode: Record<InteractionId, InteractionMapping>;
    setInteractionMappingsByMode: (
        v:
            | Record<InteractionId, InteractionMapping>
            | ((prev: Record<InteractionId, InteractionMapping>) => Record<InteractionId, InteractionMapping>)
    ) => void;
};

const ALL_GESTURES: GazeEventType[] = [
    "BLINK",
    "DOUBLE_BLINK",
    "WINK_LEFT",
    "WINK_RIGHT",
    "FLICK_DOWN",
    "FLICK_LEFT",
    "FLICK_RIGHT",
] as any;

function isOptionUsedElsewhere(mapping: InteractionMapping, key: keyof InteractionMapping, option: GazeEventType) {
    return Object.entries(mapping).some(([k, v]) => k !== key && v === option);
}

export default function StudyConfigPanel({
                                             promptCount,
                                             setPromptCount,
                                             selectedLayouts,
                                             setSelectedLayouts,
                                             selectedInteractions,
                                             setSelectedInteractions,
                                             interactionMappingsByMode,
                                             setInteractionMappingsByMode,
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

    const updateMapping = (mode: InteractionId, patch: Partial<InteractionMapping>) => {
        setInteractionMappingsByMode((prev) => ({
            ...prev,
            [mode]: { ...(prev[mode] ?? {}), ...patch },
        }));
    };

    return (
        <div className="card" style={{ marginTop: 12, width: "100%" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <div className="label">Study Configuration (admin)</div>
                    <div style={{ color: "#64748b", fontSize: 13, marginTop: 2 }}>
                        Configure layouts, interactions, prompt count, and gesture mappings.
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
                    </div>

                    <div style={{ minWidth: 320, opacity: selectedInteractions.includes("hybrid_c") ? 1 : 0.5 }}>
                        <div className="label">Action mapping (hybrid)</div>
                        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                            Hybrid selection stays dwell-based; gestures map to popup/delete/space.
                        </div>

                        {(() => {
                            const disabled = !selectedInteractions.includes("hybrid_c");
                            const m = interactionMappingsByMode.hybrid_c ?? {};

                            return (
                                <>
                                    {(["toggle_vowel_popup", "delete", "space"] as (keyof InteractionMapping)[]).map(
                                        (k) => (
                                            <div
                                                key={String(k)}
                                                style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}
                                            >
                                                <span style={{ width: 130, fontSize: 13 }}>{String(k)}</span>
                                                <select
                                                    disabled={disabled}
                                                    value={(m[k] as any) ?? (k === "space" ? "BLINK" : "FLICK_DOWN")}
                                                    onChange={(e) =>
                                                        updateMapping("hybrid_c", { [k]: e.target.value as any })
                                                    }
                                                >
                                                    {ALL_GESTURES.map((g) => (
                                                        <option
                                                            key={g}
                                                            value={g}
                                                            disabled={disabled ? false : isOptionUsedElsewhere(m, k, g)}
                                                        >
                                                            {g}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )
                                    )}
                                </>
                            );
                        })()}
                    </div>

                    <div style={{ minWidth: 320, opacity: selectedInteractions.includes("dwell_free_c") ? 1 : 0.5 }}>
                        <div className="label">Action mapping (dwell-free)</div>
                        {(() => {
                            const disabled = !selectedInteractions.includes("dwell_free_c");
                            const m = interactionMappingsByMode.dwell_free_c ?? {};

                            return (
                                <>
                                    {(["select", "delete", "space", "toggle_vowel_popup"] as (keyof InteractionMapping)[]).map(
                                        (k) => (
                                            <div
                                                key={String(k)}
                                                style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}
                                            >
                                                <span style={{ width: 130, fontSize: 13 }}>{String(k)}</span>
                                                <select
                                                    disabled={disabled}
                                                    value={
                                                        (m[k] as any) ??
                                                        (k === "select" || k === "toggle_vowel_popup"
                                                            ? "FLICK_DOWN"
                                                            : k === "space"
                                                                ? "BLINK"
                                                                : "DOUBLE_BLINK")
                                                    }
                                                    onChange={(e) =>
                                                        updateMapping("dwell_free_c", { [k]: e.target.value as any })
                                                    }
                                                >
                                                    {ALL_GESTURES.map((g) => (
                                                        <option
                                                            key={g}
                                                            value={g}
                                                            disabled={disabled ? false : isOptionUsedElsewhere(m, k, g)}
                                                        >
                                                            {g}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}
