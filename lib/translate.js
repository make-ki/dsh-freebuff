/**
 * Translate upstream freebuff SSE payloads (OpenAI chat-completions shaped,
 * optionally wrapped in {data: …}) into harness StreamChunks. Same protocol
 * mapping as the DeepSeek adapter: text / reasoning_content / tool_calls
 * deltas open stateful blocks; finish reason and usage are deferred until
 * the [DONE] sentinel.
 */
import { ToolCallId, EMPTY_RESPONSE_CODE, LlmError } from '@deepseek-ai/dsh-llm';
function mapFinishReason(reason) {
    switch (reason) {
        case 'stop':
            return { kind: 'stop' };
        case 'tool_calls':
            return { kind: 'tool-calls' };
        case 'length':
            return { kind: 'max-tokens' };
        default:
            return { kind: 'error', failure: { message: `model stopped: ${reason}`, code: reason.toUpperCase() } };
    }
}
export function mapUsage(usage) {
    const cacheRead = usage.prompt_tokens_details?.cached_tokens ?? usage.prompt_cache_hit_tokens;
    const reasoning = usage.completion_tokens_details?.reasoning_tokens;
    return {
        inputTokens: (usage.prompt_tokens ?? 0) - (cacheRead ?? 0),
        outputTokens: usage.completion_tokens ?? 0,
        ...(cacheRead !== undefined ? { cacheReadTokens: cacheRead } : {}),
        ...(reasoning !== undefined ? { reasoningTokens: reasoning } : {}),
    };
}
function closeBlock(block) {
    switch (block.kind) {
        case 'text':
            return { type: 'text', text: block.text };
        case 'reasoning':
            return { type: 'reasoning', text: block.text };
        case 'tool-call':
            return { type: 'tool-call', id: ToolCallId(block.callId ?? ''), name: block.name ?? '', arguments: block.text };
    }
}
/**
 * Consume parsed SSE payloads (ending with the string '[DONE]') and yield
 * harness StreamChunks. Malformed payloads abort with MALFORMED_RESPONSE; a
 * stream ending without [DONE] aborts with STREAM_CLOSED.
 */
export async function* translate(payloads) {
    let nextIndex = 0;
    let textBlock;
    let reasoningBlock;
    const toolBlocks = new Map();
    const order = [];
    let pendingFinish;
    let pendingUsage;
    const open = (kind) => {
        const block = { index: nextIndex++, kind, text: '' };
        order.push(block);
        return block;
    };
    for await (const raw of payloads) {
        if (raw === '[DONE]') {
            for (const block of order) {
                yield { type: 'block-end', index: block.index, block: closeBlock(block) };
            }
            if (pendingUsage)
                yield { type: 'usage', usage: pendingUsage };
            const reason = pendingFinish ?? { kind: 'stop' };
            yield {
                type: 'finish',
                reason: reason.kind === 'stop' && order.length === 0
                    ? {
                        kind: 'error',
                        failure: {
                            message: 'model returned a completed response with no content',
                            code: EMPTY_RESPONSE_CODE,
                        },
                    }
                    : reason,
            };
            return;
        }
        let chunk;
        if (typeof raw === 'string') {
            try {
                chunk = JSON.parse(raw);
            }
            catch {
                throw new LlmError(`malformed SSE payload: ${raw.slice(0, 120)}`, 'MALFORMED_RESPONSE');
            }
        }
        else {
            chunk = raw;
        }
        for (const choice of chunk.choices ?? []) {
            const delta = choice.delta ?? {};
            const reasoning = delta.reasoning_content;
            if (typeof reasoning === 'string' && reasoning.length > 0) {
                if (!reasoningBlock) {
                    reasoningBlock = open('reasoning');
                    yield { type: 'block-start', index: reasoningBlock.index, blockType: 'reasoning' };
                }
                reasoningBlock.text += reasoning;
                yield { type: 'reasoning-delta', index: reasoningBlock.index, text: reasoning };
            }
            const content = delta.content;
            if (typeof content === 'string' && content.length > 0) {
                if (!textBlock) {
                    textBlock = open('text');
                    yield { type: 'block-start', index: textBlock.index, blockType: 'text' };
                }
                textBlock.text += content;
                yield { type: 'text-delta', index: textBlock.index, text: content };
            }
            for (const call of delta.tool_calls ?? []) {
                const idx = call.index ?? 0;
                let block = toolBlocks.get(idx);
                if (!block) {
                    block = open('tool-call');
                    toolBlocks.set(idx, block);
                    yield { type: 'block-start', index: block.index, blockType: 'tool-call' };
                }
                if (call.id !== undefined)
                    block.callId = call.id;
                if (call.function?.name !== undefined)
                    block.name = call.function.name;
                const fragment = call.function?.arguments ?? '';
                block.text += fragment;
                yield {
                    type: 'tool-call-delta',
                    index: block.index,
                    id: ToolCallId(block.callId ?? ''),
                    ...(block.name !== undefined ? { name: block.name } : {}),
                    argumentsDelta: fragment,
                };
            }
            if (typeof choice.finish_reason === 'string')
                pendingFinish = mapFinishReason(choice.finish_reason);
        }
        if (chunk.usage)
            pendingUsage = mapUsage(chunk.usage);
    }
    throw new LlmError('SSE stream ended without [DONE]', 'STREAM_CLOSED');
}
