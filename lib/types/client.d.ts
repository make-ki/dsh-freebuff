/**
 * Client half of dsh-freebuff: a "Freebuff" section on the Settings page.
 * Mirrors the bg-rotator (wallpaper-rotator) registration pattern that is
 * confirmed working in this DSH build:
 *   ctx.slots.inject('settings.section', () => ctx.slots.register(
 *     { name, id, order, label },
 *     () => h('div', { className }, h(SettingsView)),
 *   ))
 * React and the styles service come from the client runtime (require / global).
 */
export declare const inject: string[];
export declare function apply(ctx: {
    slots: {
        inject: (name: string, factory: () => unknown) => unknown;
        register: (opts: unknown, comp?: unknown) => unknown;
    };
    effect: (fn: () => unknown, name?: string) => void;
}): void;
