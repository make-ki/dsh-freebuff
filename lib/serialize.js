/**
 * Serialize harness messages and request options into the freebuff upstream
 * chat-completions payload. Mirrors the official client's wire shape:
 * Buffy system-prefix (server-enforced), `'"cb_easp"'` default stop, the
 * `end_turn` tool signature for tool-bearing requests, and codebuff_metadata
 * carrying instance/run/fingerprint/cost_mode.
 */
import { randomUUID } from 'node:crypto';
import { BUFFY, CB_EASP, MODEL_EFFORTS, REASONING_EFFORT_RANK } from './constants.js';
/** Flatten the text blocks of a message (user / tool-result content). */
function flattenText(blocks) {
    return blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
}
/** Serialize one assistant message (text + reasoning + tool calls). */
function serializeAssistant(message) {
    const text = flattenText(message.content);
    const reasoning = message.content
        .filter((b) => b.type === 'reasoning')
        .map((b) => b.text ?? '')
        .join('');
    const toolCalls = message.content
        .filter((b) => b.type === 'tool-call')
        .map((b) => ({
        id: b.id ?? '',
        type: 'function',
        function: { name: b.name ?? '', arguments: b.arguments ?? '' },
    }));
    return {
        role: 'assistant',
        content: text,
        ...(toolCalls.length > 0 && reasoning.length > 0 ? { reasoning_content: reasoning } : {}),
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    };
}
/** Serialize the conversation into wire messages. */
export function serializeMessages(messages) {
    const wire = [];
    for (const message of messages) {
        if (message.role === 'tool') {
            wire.push({ role: 'tool', tool_call_id: message.toolCallId, content: flattenText(message.content) || '(no output)' });
            continue;
        }
        if (message.role === 'system' || message.role === 'developer') {
            wire.push({ role: message.role, content: flattenText(message.content) });
            continue;
        }
        if (message.role === 'assistant') {
            wire.push(serializeAssistant(message));
            continue;
        }
        const toolResults = message.content.filter((b) => b.type === 'tool-result');
        const text = flattenText(message.content);
        if (text.length > 0 || toolResults.length === 0) {
            wire.push({ role: 'user', content: text });
        }
        for (const result of toolResults) {
            wire.push({
                role: 'tool',
                tool_call_id: result.toolCallId ?? '',
                content: flattenText(result.content ?? []) || '(no output)',
            });
        }
    }
    return wire;
}
/**
 * Apply the free-mode marker rules: every system message gets a cache-control
 * marker and the first one must start with the Buffy sentence; when no system
 * message exists one is prepended.
 */
export function normalizeMessages(messages) {
    const out = [];
    let hasSystem = false;
    for (const m of messages) {
        const item = { ...m };
        if (item.role === 'developer')
            item.role = 'system';
        if (item.role === 'system') {
            hasSystem = true;
            item.cache_control = { type: 'ephemeral' };
            if (typeof item.content === 'string') {
                if (!item.content.startsWith(BUFFY))
                    item.content = BUFFY + item.content;
            }
            else if (Array.isArray(item.content)) {
                const firstText = item.content.find((c) => c && typeof c === 'object' && c.type === 'text' && typeof c.text === 'string');
                if (firstText && !firstText.text.startsWith(BUFFY))
                    firstText.text = BUFFY + firstText.text;
            }
        }
        out.push(item);
    }
    if (!hasSystem)
        out.unshift({ role: 'system', content: BUFFY, cache_control: { type: 'ephemeral' } });
    return out;
}
/** Clamp a requested effort to the model's allowed ladder (official semantics). */
export function clampReasoningEffort(requested, allowed) {
    const wanted = REASONING_EFFORT_RANK.indexOf(requested);
    if (wanted < 0)
        return requested;
    let best = null;
    let bestRank = -1;
    for (const cand of allowed) {
        const rank = REASONING_EFFORT_RANK.indexOf(cand);
        if (rank < 0 || rank > wanted)
            continue;
        if (rank > bestRank) {
            best = cand;
            bestRank = rank;
        }
    }
    if (best !== null)
        return best;
    return allowed.reduce((lo, c) => REASONING_EFFORT_RANK.indexOf(c) <
        REASONING_EFFORT_RANK.indexOf(lo)
        ? c
        : lo);
}
export function normalizeReasoningEffort(model, effort) {
    if (effort === undefined || effort === null || effort === 'off')
        return undefined;
    const allowed = MODEL_EFFORTS[model];
    if (!allowed)
        return effort;
    const clamped = clampReasoningEffort(String(effort), allowed);
    return clamped === String(effort) ? effort : clamped;
}
export function buildUpstreamPayload(params, mc, sess, runId, clientId) {
    const payload = { model: mc.upstream, messages: [], stream: true };
    if (params.maxTokens !== undefined)
        payload.max_tokens = params.maxTokens;
    if (params.temperature !== undefined)
        payload.temperature = params.temperature;
    if (params.stop !== undefined)
        payload.stop = params.stop;
    if (params.tools !== undefined && params.tools.length > 0) {
        payload.tools = params.tools.map((t) => ({
            type: 'function',
            function: {
                name: t.name,
                ...(t.description !== undefined ? { description: t.description } : {}),
                parameters: t.parameters ?? { type: 'object', properties: {} },
            },
        }));
    }
    if (params.reasoningEffort !== undefined) {
        const effort = normalizeReasoningEffort(mc.id, params.reasoningEffort);
        if (effort !== undefined)
            payload.reasoning_effort = effort;
    }
    payload.model = mc.upstream;
    payload.messages = normalizeMessages([
        ...(params.system !== undefined ? [{ role: 'system', content: params.system }] : []),
        ...serializeMessages(params.messages),
    ]);
    if (!payload.stop)
        payload.stop = [CB_EASP];
    payload.provider = { data_collection: 'deny' };
    if (Array.isArray(payload.tools) && payload.tools.length > 0) {
        const hasSignature = payload.tools.some((t) => t && typeof t === 'object' && t.function?.name === 'end_turn');
        if (!hasSignature) {
            payload.tools = [
                ...payload.tools,
                {
                    type: 'function',
                    function: {
                        name: 'end_turn',
                        description: 'Signal the end of the current task.',
                        parameters: { type: 'object', properties: {} },
                    },
                },
            ];
        }
    }
    payload.codebuff_metadata = {
        freebuff_instance_id: sess.instanceId,
        trace_session_id: randomUUID(),
        run_id: runId,
        client_id: clientId,
        cost_mode: 'free',
    };
    return payload;
}
