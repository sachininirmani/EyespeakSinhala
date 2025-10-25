import React from "react";
import KeyboardLoader from "./KeyboardLoader";
import type { LayoutId } from "./index";

export default function Keyboard({
                                     dwellMainMs,
                                     dwellPopupMs,
                                     onChange,
                                     layoutId = "eyespeak_v1"
                                 }: {
    dwellMainMs: number;
    dwellPopupMs: number;
    onChange: (text: string) => void;
    layoutId?: LayoutId;
}) {
    return (
        <KeyboardLoader
            layoutId={layoutId}
            dwellMainMs={dwellMainMs}
            dwellPopupMs={dwellPopupMs}
            onChange={onChange}
        />
    );
}
