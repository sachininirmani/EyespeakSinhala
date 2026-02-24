import { InteractionConfig } from "./types";

export function buildInteractionReminder(config: InteractionConfig): string {
    const lines: string[] = [];

    if (config.mapping.select)
        lines.push(`Select: ${config.mapping.select}`);

    if (config.mapping.delete)
        lines.push(`Delete: ${config.mapping.delete}`);

    if (config.mapping.space)
        lines.push(`Space: ${config.mapping.space}`);

    if (config.mapping.toggle_vowel_popup)
        lines.push(`Popup toggle: ${config.mapping.toggle_vowel_popup}`);

    return lines.join(" | ");
}