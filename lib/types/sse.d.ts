/**
 * Minimal SSE parser (async generator over a node stream). Handles CRLF,
 * multi-line `data:` fields and comment lines; yields one object per event.
 */
export interface SseEvent {
    event?: string;
    data: string;
}
export declare function parseSse(stream: AsyncIterable<Buffer | string>): AsyncGenerator<SseEvent>;
