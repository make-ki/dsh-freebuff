/**
 * Client half of dsh-freebuff: a "Freebuff" section on the Settings page
 * (settings.section slot) with visual credential / proxy / health editing.
 * Talks to the host JSON API under /freebuff/api.
 */
export declare const inject: string[];
interface SlotsLike {
    inject: (name: string, factory: () => unknown) => unknown;
    register: (opts: unknown) => unknown;
}
interface SlotsCtx {
    slots: SlotsLike;
    effect: (fn: () => unknown, name?: string) => void;
}
export declare function apply(ctx: SlotsCtx): void;
export {};
