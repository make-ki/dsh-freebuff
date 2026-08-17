import { type ModelEntry } from './constants.js';
import type { SessionCache } from './freebuff.js';
export interface ContentBlock {
    type: string;
    text?: string;
    id?: string;
    name?: string;
    arguments?: string;
    toolCallId?: string;
    content?: ContentBlock[];
}
export interface HarnessMessage {
    role: 'system' | 'assistant' | 'user';
    content: ContentBlock[];
}
export interface HarnessRequest {
    model: string;
    messages: HarnessMessage[];
    system?: string;
    tools?: {
        name: string;
        description?: string;
        parameters?: unknown;
    }[];
    temperature?: number;
    maxTokens?: number;
    stop?: string[];
    reasoningEffort?: string;
    sessionId?: string;
    purpose?: string;
}
export interface UpstreamPayload {
    [key: string]: unknown;
    model: string;
    messages: unknown[];
    stream: boolean;
}
/** Serialize the conversation into wire messages. */
export declare function serializeMessages(messages: HarnessMessage[]): Record<string, unknown>[];
/**
 * Apply the free-mode marker rules: every system message gets a cache-control
 * marker and the first one must start with the Buffy sentence; when no system
 * message exists one is prepended.
 */
export declare function normalizeMessages(messages: Record<string, unknown>[]): Record<string, unknown>[];
/** Clamp a requested effort to the model's allowed ladder (official semantics). */
export declare function clampReasoningEffort(requested: string, allowed: string[]): string;
export declare function normalizeReasoningEffort(model: string, effort: unknown): unknown;
export declare function buildUpstreamPayload(params: HarnessRequest, mc: ModelEntry, sess: SessionCache, runId: string, clientId: string): UpstreamPayload;
