import { eyespeak_v1 } from "./layouts/eyespeak_v1";
import { eyespeak_v2 } from "./layouts/eyespeak_v2";
import { wijesekara } from "./layouts/wijesekara";

export const ALL_KEYBOARDS = [eyespeak_v1, eyespeak_v2, wijesekara] as const;

/**
 * LayoutId automatically derives from ALL_KEYBOARDS
 * — no manual updates required when you add new layouts.
 */
export type LayoutId = typeof ALL_KEYBOARDS[number]["id"];
