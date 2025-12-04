// VowelPlacement.ts
//
// Radial placement for Sinhala vowel popup suggestions using
// diacritic-aware scoring + brute-force optimisation.
//
// Key ideas:
//  - For each suggestion, we compute directional weights (top/right/bottom/left)
//    from its diacritics (incl. RAKA, YANSA, trailing ං / ඃ with low priority).
//  - From those weights we derive up to THREE preferred 8-way directions, e.g.:
//        "ේ" → [LEFT_TOP, LEFT, TOP]
//        "ො" → [RIGHT, LEFT]
//        "ෝ" → [TOP, RIGHT_TOP, RIGHT]
//  - For a page with n suggestions, we create n equally spaced angular slots.
//  - We try ALL permutations of suggestions in slots (n!; for n ≤ 7 this is fine).
//  - Each layout gets a score based on:
//        • how close each suggestion is to one of its preferred directions
//          (first preference highest weight, then second, then third);
//        • bonuses when neighbouring suggestions share the same coarse axis
//          (e.g. both left-ish).
//  - The highest-scoring layout wins.
//
//  NEW: Plain consonants (no diacritics, no RAKA/YANSA, no ං/ඃ influence)
//       do NOT get directional weights. In the optimiser they don't compete
//       with diacritics: they just get a small bonus for being placed in the
//       least-crowded quadrant, so they "fill gaps" instead of stealing
//       good vowel positions.
//
// No other files need to change; VowelPopup just calls computeVowelPlacementsForPage().

export type Direction = "TOP" | "RIGHT" | "BOTTOM" | "LEFT" | "SAFE";

export interface VowelPlacement {
    option: string;
    angle: number; // radians; 0 = right, π/2 = bottom, π = left, 3π/2 = top
}

/** Bases for composite clusters */
const RAKA_SUFFIX_BASE = "්‍ර";
const YANSA_SUFFIX_BASE = "්‍ය";

interface DirectionWeights {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

/**
 * Directional weights for each basic suffix.
 * Larger number = stronger pull in that direction.
 *
 * Notes:
 *   "්"    → strong TOP
 *   ""     → (handled separately; bare consonant now treated as "plain")
 *   "ා,ැ,ෑ" → RIGHT
 *   "ි,ී"   → TOP
 *   "ු,ූ"   → BOTTOM
 *   "ෙ"    → LEFT
 *   "ේ"    → LEFT + TOP  (LEFT_TOP preferred)
 *   "ෛ"    → LEFT
 *   "ො"    → RIGHT with some LEFT (ා dominates)
 *   "ෝ"    → TOP with some RIGHT/LEFT
 *   "ෞ"    → LEFT with some RIGHT
 *   "ං,ඃ"  → weak RIGHT decoration (never primary)
 */
const SIMPLE_SUFFIX_WEIGHTS: Record<string, DirectionWeights> = {
    "්":  { top: 4,   right: 0,   bottom: 0,   left: 0 },
    "ා":  { top: 0,   right: 4,   bottom: 0,   left: 0 },
    "ැ":  { top: 0,   right: 4,   bottom: 0,   left: 0 },
    "ෑ":  { top: 0,   right: 4,   bottom: 0,   left: 0 },
    "ි":  { top: 4,   right: 0,   bottom: 0,   left: 0 },
    "ී":  { top: 4,   right: 0,   bottom: 0,   left: 0 },
    "ු":  { top: 0,   right: 0,   bottom: 4,   left: 0 },
    "ූ":  { top: 0,   right: 0,   bottom: 4,   left: 0 },
    "ෘ":  { top: 0,   right: 2,   bottom: 0,   left: 0 }, // weak right
    "ෲ":  { top: 0,   right: 2,   bottom: 0,   left: 0 },
    "ෙ":  { top: 0,   right: 0,   bottom: 0,   left: 4 },
    "ේ":  { top: 2,   right: 0,   bottom: 0,   left: 3 }, // LEFT_TOP > LEFT > TOP
    "ෛ":  { top: 0,   right: 0,   bottom: 0,   left: 3 },
    "ො":  { top: 0,   right: 3,   bottom: 0,   left: 2 }, // RIGHT > LEFT
    "ෝ":  { top: 3,   right: 2,   bottom: 0,   left: 2 }, // TOP > RIGHT,LEFT
    "ෞ":  { top: 0,   right: 2,   bottom: 0,   left: 3 }, // LEFT > RIGHT
    "ං":  { top: 0,   right: 0.5, bottom: 0,   left: 0 }, // decoration (final)
    "ඃ":  { top: 0,   right: 0.5, bottom: 0,   left: 0 },
};

const SORTED_SUFFIXES = Object.keys(SIMPLE_SUFFIX_WEIGHTS).sort(
    (a, b) => b.length - a.length
);

/* ---------- Direction info (weights + plain flag) ---------- */

interface DirectionInfo {
    weights: DirectionWeights;
    isPlain: boolean; // bare consonant / independent char with no diacritics, no RAKA/YANSA, no ං/ඃ influence
}

/**
 * Compute directional weights for a suggestion + whether it's "plain".
 *
 * Important special handling:
 *  - We strip trailing ං / ඃ *first* and treat them as weak RIGHT decoration,
 *    so they never override the main vowel / cluster diacritic.
 *  - Then we detect RAKA / YANSA, and finally the main suffix (ා,ෙ,ේ,ො,ෝ, etc.).
 *  - If after all this we still have zero weights and no RAKA/YANSA, we treat
 *    this as a "plain" consonant/vowel: it will not get any directional weight
 *    in the optimiser and will just be used to balance empty sectors.
 */
function computeDirectionInfo(text: string): DirectionInfo {
    let weights: DirectionWeights = { top: 0, right: 0, bottom: 0, left: 0 };
    let working = text;

    // 1. Strip trailing ං / ඃ – decoration only, low-right bias
    //    NOTE: this means plain consonant *cannot* have ං/ඃ, by definition.
    while (working.endsWith("ං") || working.endsWith("ඃ")) {
        weights.right += 0.5; // very low priority decoration
        working = working.slice(0, -1);
    }

    // 2. Detect RAKA / YANSA inside, pull out vowelPart after them
    let vowelPart = working;
    const rakaIdx = working.indexOf(RAKA_SUFFIX_BASE);
    const yansaIdx = working.indexOf(YANSA_SUFFIX_BASE);

    if (rakaIdx !== -1) {
        const after = working.slice(rakaIdx + RAKA_SUFFIX_BASE.length);
        vowelPart = after || "";
        // pure RAKA vs RAKA + vowel
        weights.bottom += after.length === 0 ? 2 : 0.5;
    } else if (yansaIdx !== -1) {
        const after = working.slice(yansaIdx + YANSA_SUFFIX_BASE.length);
        vowelPart = after || "";
        weights.right += after.length === 0 ? 2 : 0.5;
    }

    // 3. Main suffix match (no ං / ඃ here; we stripped them)
    let matched = false;
    for (const suf of SORTED_SUFFIXES) {
        if (!suf) continue;
        if (vowelPart.endsWith(suf)) {
            const w = SIMPLE_SUFFIX_WEIGHTS[suf];
            weights.top += w.top;
            weights.right += w.right;
            weights.bottom += w.bottom;
            weights.left += w.left;
            matched = true;
            break;
        }
    }

    // 4. Decide if this is a plain consonant/vowel (for popup purposes)
    const isPlain =
        !matched &&
        rakaIdx === -1 &&
        yansaIdx === -1 &&
        weights.top === 0 &&
        weights.right === 0 &&
        weights.bottom === 0 &&
        weights.left === 0;

    return { weights, isPlain };
}

/**
 * Old API kept for compatibility: just return weights.
 * Plain consonants now get *zero* weights here.
 */
function computeDirectionWeights(text: string): DirectionWeights {
    return computeDirectionInfo(text).weights;
}

/**
 * Legacy simple classifier (kept for compatibility elsewhere).
 * For plain consonants, we keep previous behaviour: classify as TOP.
 */
export function classifyDirection(text: string): Direction {
    const info = computeDirectionInfo(text);
    const { top, right, bottom, left } = info.weights;

    if (info.isPlain) {
        // Old fallback behaviour
        return "TOP";
    }

    if (top > 0) return "TOP";
    if (bottom >= 1 && bottom >= left && bottom >= right) return "BOTTOM";
    if (left > right) return "LEFT";
    if (right > left) return "RIGHT";
    return "SAFE";
}

/* ---------- 8-direction model ---------- */

type Direction8 =
    | "RIGHT"
    | "RIGHT_BOTTOM"
    | "BOTTOM"
    | "LEFT_BOTTOM"
    | "LEFT"
    | "LEFT_TOP"
    | "TOP"
    | "RIGHT_TOP";

const D8_ANCHOR_ANGLES: Record<Direction8, number> = {
    RIGHT:        0,
    RIGHT_BOTTOM: Math.PI / 4,
    BOTTOM:       Math.PI / 2,
    LEFT_BOTTOM:  (3 * Math.PI) / 4,
    LEFT:         Math.PI,
    LEFT_TOP:     (5 * Math.PI) / 4,
    TOP:          (3 * Math.PI) / 2, // same as -π/2
    RIGHT_TOP:    (7 * Math.PI) / 4,
};

const AXIS_TO_D8: Record<"TOP" | "RIGHT" | "BOTTOM" | "LEFT", Direction8> = {
    TOP: "TOP",
    RIGHT: "RIGHT",
    BOTTOM: "BOTTOM",
    LEFT: "LEFT",
};

function angularDistance(a: number, b: number): number {
    let diff = Math.abs(a - b);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    return diff;
}

function compositeFromAxes(
    a: "TOP" | "RIGHT" | "BOTTOM" | "LEFT",
    b: "TOP" | "RIGHT" | "BOTTOM" | "LEFT"
): Direction8 | null {
    const set = new Set([a, b]);
    if (set.has("LEFT") && set.has("TOP")) return "LEFT_TOP";
    if (set.has("TOP") && set.has("RIGHT")) return "RIGHT_TOP";
    if (set.has("RIGHT") && set.has("BOTTOM")) return "RIGHT_BOTTOM";
    if (set.has("BOTTOM") && set.has("LEFT")) return "LEFT_BOTTOM";
    return null; // opposite or weird
}

/**
 * Build auto priority chain over 8 directions from axis weights.
 * We will later truncate to at most 3 preferences.
 */
function getDirection8PriorityChain(weights: DirectionWeights): Direction8[] {
    const axes = [
        { axis: "TOP" as const,    w: weights.top },
        { axis: "RIGHT" as const,  w: weights.right },
        { axis: "BOTTOM" as const, w: weights.bottom },
        { axis: "LEFT" as const,   w: weights.left },
    ];
    const positive = axes.filter(a => a.w > 0).sort((a, b) => b.w - a.w);

    if (positive.length === 0) {
        return ["TOP"]; // safe fallback for "no direction"
    }

    const chain: Direction8[] = [];
    const pushUnique = (d: Direction8 | null) => {
        if (!d) return;
        if (!chain.includes(d)) chain.push(d);
    };

    const primary = positive[0];

    // Composite with second-best axis if strong enough
    if (positive.length >= 2) {
        const second = positive[1];
        if (second.w >= primary.w * 0.5) {
            pushUnique(compositeFromAxes(primary.axis, second.axis));
        }
    }

    // Then individual axes by weight
    positive.forEach(p => pushUnique(AXIS_TO_D8[p.axis]));

    // Should never be empty here, but just in case:
    if (chain.length === 0) {
        chain.push(AXIS_TO_D8[primary.axis]);
    }

    return chain;
}

/** Coarse axis for grouping / adjacency scoring */
type Axis = "TOP" | "RIGHT" | "BOTTOM" | "LEFT";
function getMainAxis(weights: DirectionWeights): Axis {
    const entries: { axis: Axis; w: number }[] = [
        { axis: "TOP",    w: weights.top },
        { axis: "RIGHT",  w: weights.right },
        { axis: "BOTTOM", w: weights.bottom },
        { axis: "LEFT",   w: weights.left },
    ];
    entries.sort((a, b) => b.w - a.w);
    if (entries[0].w <= 0) return "TOP";
    return entries[0].axis;
}

/* ---------- Layout scoring + brute-force search ---------- */

interface SuggestionInfo {
    option: string;
    prefs: Direction8[];   // up to 3 preferred 8-way directions (empty for plain)
    mainAxis: Axis;        // coarse main axis for grouping (ignored for plain)
    isPlain: boolean;      // bare consonant / char with no diacritics
}

const PREF_WEIGHTS = [1.0, 0.6, 0.3]; // first, second, third preference
const MAX_DIR_DIST = Math.PI / 2;     // beyond 90° → score 0
const GROUP_BONUS = 0.15;             // bonus per neighbour pair with same mainAxis
const PLAIN_BALANCE_WEIGHT = 0.25;    // how strongly plain chars prefer least-crowded quadrant

// Map an angle to the nearest coarse axis (TOP/RIGHT/BOTTOM/LEFT)
function getAxisFromAngle(angle: number): Axis {
    const axes: { axis: Axis; anchor: number }[] = [
        { axis: "RIGHT",  anchor: 0 },
        { axis: "BOTTOM", anchor: Math.PI / 2 },
        { axis: "LEFT",   anchor: Math.PI },
        { axis: "TOP",    anchor: (3 * Math.PI) / 2 },
    ];
    let bestAxis: Axis = "RIGHT";
    let bestDist = Infinity;
    for (const a of axes) {
        const d = angularDistance(angle, a.anchor);
        if (d < bestDist) {
            bestDist = d;
            bestAxis = a.axis;
        }
    }
    return bestAxis;
}

function scoreSuggestionAtAngle(info: SuggestionInfo, angle: number): number {
    // Plain suggestions do not contribute directional closeness.
    if (info.isPlain || info.prefs.length === 0) return 0;

    let best = 0;
    const maxPref = Math.min(info.prefs.length, 3);

    for (let j = 0; j < maxPref; j++) {
        const dir = info.prefs[j];
        const anchor = D8_ANCHOR_ANGLES[dir];
        const dist = angularDistance(angle, anchor);
        if (dist > MAX_DIR_DIST) continue;
        const closeness = 1 - dist / MAX_DIR_DIST; // 1 at exact, 0 at 90°
        const score = closeness * PREF_WEIGHTS[j];
        if (score > best) best = score;
    }

    return best;
}

function scorePermutation(
    infos: SuggestionInfo[],
    slotAngles: number[],
    perm: number[]
): number {
    const n = infos.length;
    let total = 0;

    // 0. Quadrant occupancy for non-plain suggestions
    const occupancy: Record<Axis, number> = { TOP: 0, RIGHT: 0, BOTTOM: 0, LEFT: 0 };
    for (let s = 0; s < n; s++) {
        const info = infos[perm[s]];
        if (info.isPlain) continue;
        const axis = getAxisFromAngle(slotAngles[s]);
        occupancy[axis]++;
    }

    // 1. Direction closeness (only non-plain contribute)
    for (let s = 0; s < n; s++) {
        const info = infos[perm[s]];
        total += scoreSuggestionAtAngle(info, slotAngles[s]);
    }

    // 2. Neighbour grouping (circular), but ignore plain suggestions
    for (let s = 0; s < n; s++) {
        const next = (s + 1) % n;
        const infoA = infos[perm[s]];
        const infoB = infos[perm[next]];
        if (infoA.isPlain || infoB.isPlain) continue;
        if (infoA.mainAxis === infoB.mainAxis) {
            total += GROUP_BONUS;
        }
    }

    // 3. Plain consonant balancing: prefer least-crowded quadrant
    const occValues = Object.values(occupancy);
    const maxOcc = Math.max(...occValues);
    const minOcc = Math.min(...occValues);

    if (maxOcc !== minOcc) {
        const denom = maxOcc - minOcc || 1;
        for (let s = 0; s < n; s++) {
            const info = infos[perm[s]];
            if (!info.isPlain) continue;
            const axis = getAxisFromAngle(slotAngles[s]);
            const occ = occupancy[axis];
            // Higher score if this quadrant has lower occupancy.
            const factor = (maxOcc - occ) / denom; // 1 for least, 0 for most
            total += factor * PLAIN_BALANCE_WEIGHT;
        }
    }

    return total;
}

/**
 * Main entry point used by VowelPopup:
 * Given the suggestions for this page, compute angular placements
 * using brute-force optimisation over all permutations.
 */
export function computeVowelPlacementsForPage(
    pageItems: string[]
): VowelPlacement[] {
    const n = pageItems.length;
    if (n === 0) return [];
    if (n === 1) {
        // Place single item at TOP (nice default)
        return [{ option: pageItems[0], angle: (3 * Math.PI) / 2 }];
    }

    // 1. Precompute suggestion info (weights, prefs, mainAxis, isPlain)
    const infos: SuggestionInfo[] = pageItems.map((opt) => {
        const { weights, isPlain } = computeDirectionInfo(opt);
        const chain = isPlain ? [] : getDirection8PriorityChain(weights).slice(0, 3); // up to 3 prefs
        const mainAxis = isPlain ? "TOP" : getMainAxis(weights);
        return { option: opt, prefs: chain, mainAxis, isPlain };
    });

    // 2. Build n equally spaced slot angles (no offset; RIGHT at 0 rad)
    const slotAngles: number[] = [];
    for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * i) / n;
        slotAngles.push(angle);
    }

    // 3. Brute-force all permutations to find best-scoring layout
    const indices = Array.from({ length: n }, (_, i) => i);
    const used = new Array<boolean>(n).fill(false);
    const current: number[] = new Array(n);
    let bestScore = -Infinity;
    let bestPerm: number[] = indices.slice(); // default

    function backtrack(depth: number) {
        if (depth === n) {
            const score = scorePermutation(infos, slotAngles, current);
            if (score > bestScore) {
                bestScore = score;
                bestPerm = current.slice();
            }
            return;
        }
        for (let i = 0; i < n; i++) {
            if (used[i]) continue;
            used[i] = true;
            current[depth] = i;
            backtrack(depth + 1);
            used[i] = false;
        }
    }

    backtrack(0);

    // 4. Build final placements from best permutation
    const placements: VowelPlacement[] = [];
    for (let s = 0; s < n; s++) {
        const info = infos[bestPerm[s]];
        placements.push({ option: info.option, angle: slotAngles[s] });
    }

    return placements;
}
