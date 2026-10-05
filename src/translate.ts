/**
 * Translate upstream freebuff SSE payloads (OpenAI chat-completions shaped,
 * optionally wrapped in {data: …}) into harness StreamChunks. Same protocol
 * mapping as the DeepSeek adapter: text / reasoning_content / tool_calls
 * deltas open stateful blocks; finish reason and usage are deferred until
 * the [DONE] sentinel.
 */
import { ToolCallId, EMPTY_RESPONSE_CODE, LlmError, type StreamChunk } from '@deepseek-ai/dsh-llm'

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  reasoningTokens?: number
}

interface Choice {
  delta?: {
    content?: string
    reasoning_content?: string
    tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[]
  }
  finish_reason?: string
}

interface WireChunk {
  choices?: Choice[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    prompt_tokens_details?: { cached_tokens?: number }
    prompt_cache_hit_tokens?: number
    completion_tokens_details?: { reasoning_tokens?: number }
  }
}

function mapFinishReason(reason: string): { kind: 'stop' } | { kind: 'tool-calls' } | { kind: 'max-tokens' } | { kind: 'error'; failure: { message: string; code: string } } {
  switch (reason) {
    case 'stop':
      return { kind: 'stop' }
    case 'tool_calls':
      return { kind: 'tool-calls' }
    case 'length':
      return { kind: 'max-tokens' }
    default:
      return { kind: 'error', failure: { message: `model stopped: ${reason}`, code: reason.toUpperCase() } }
  }
}

export function mapUsage(usage: NonNullable<WireChunk['usage']>): TokenUsage {
  const cacheRead = usage.prompt_tokens_details?.cached_tokens ?? usage.prompt_cache_hit_tokens
  const reasoning = usage.completion_tokens_details?.reasoning_tokens
  return {
    inputTokens: (usage.prompt_tokens ?? 0) - (cacheRead ?? 0),
    outputTokens: usage.completion_tokens ?? 0,
    ...(cacheRead !== undefined ? { cacheReadTokens: cacheRead } : {}),
    ...(reasoning !== undefined ? { reasoningTokens: reasoning } : {}),
  }
}

interface Block {
  index: number
  kind: 'text' | 'reasoning' | 'tool-call'
  text: string
  callId?: string
  name?: string
}

function closeBlock(block: Block) {
  switch (block.kind) {
    case 'text':
      return { type: 'text' as const, text: block.text }
    case 'reasoning':
      return { type: 'reasoning' as const, text: block.text }
    case 'tool-call':
      return { type: 'tool-call' as const, id: ToolCallId(block.callId ?? ''), name: block.name ?? '', arguments: block.text }
  }
}

/**
 * Consume parsed SSE payloads (ending with the string '[DONE]') and yield
 * harness StreamChunks. Malformed payloads abort with MALFORMED_RESPONSE; a
 * stream ending without [DONE] aborts with STREAM_CLOSED.
 */
export async function* translate(
  payloads: AsyncIterable<unknown>,
): AsyncGenerator<StreamChunk> {
  let nextIndex = 0
  let textBlock: Block | undefined
  let reasoningBlock: Block | undefined
  const toolBlocks = new Map<number, Block>()
  const order: Block[] = []
  let pendingFinish: ReturnType<typeof mapFinishReason> | undefined
  let pendingUsage: TokenUsage | undefined

  const open = (kind: Block['kind']): Block => {
    const block: Block = { index: nextIndex++, kind, text: '' }
    order.push(block)
    return block
  }

  for await (const raw of payloads) {
    if (raw === '[DONE]') {
      for (const block of order) {
        yield { type: 'block-end', index: block.index, block: closeBlock(block) }
      }
      if (pendingUsage) yield { type: 'usage', usage: pendingUsage }
      const reason = pendingFinish ?? { kind: 'stop' as const }
      yield {
        type: 'finish',
        reason:
          reason.kind === 'stop' && order.length === 0
            ? {
                kind: 'error',
                failure: {
                  message: 'model returned a completed response with no content',
                  code: EMPTY_RESPONSE_CODE,
                },
              }
            : reason,
      }
      return
    }
    let chunk: WireChunk
    if (typeof raw === 'string') {
      try {
        chunk = JSON.parse(raw) as WireChunk
      } catch {
        throw new LlmError(`malformed SSE payload: ${raw.slice(0, 120)}`, 'MALFORMED_RESPONSE')
      }
    } else {
      chunk = raw as WireChunk
    }
    for (const choice of chunk.choices ?? []) {
      const delta = choice.delta ?? {}
      const reasoning = delta.reasoning_content
      if (typeof reasoning === 'string' && reasoning.length > 0) {
        if (!reasoningBlock) {
          reasoningBlock = open('reasoning')
          yield { type: 'block-start', index: reasoningBlock.index, blockType: 'reasoning' }
        }
        reasoningBlock.text += reasoning
        yield { type: 'reasoning-delta', index: reasoningBlock.index, text: reasoning }
      }
      const content = delta.content
      if (typeof content === 'string' && content.length > 0) {
        if (!textBlock) {
          textBlock = open('text')
          yield { type: 'block-start', index: textBlock.index, blockType: 'text' }
        }
        textBlock.text += content
        yield { type: 'text-delta', index: textBlock.index, text: content }
      }
      for (const call of delta.tool_calls ?? []) {
        const idx = call.index ?? 0
        let block = toolBlocks.get(idx)
        if (!block) {
          block = open('tool-call')
          toolBlocks.set(idx, block)
          yield { type: 'block-start', index: block.index, blockType: 'tool-call' }
        }
        if (call.id !== undefined) block.callId = call.id
        if (call.function?.name !== undefined) block.name = call.function.name
        const fragment = call.function?.arguments ?? ''
        block.text += fragment
        yield {
          type: 'tool-call-delta',
          index: block.index,
          id: ToolCallId(block.callId ?? ''),
          ...(block.name !== undefined ? { name: block.name } : {}),
          argumentsDelta: fragment,
        }
      }
      if (typeof choice.finish_reason === 'string') pendingFinish = mapFinishReason(choice.finish_reason)
    }
    if (chunk.usage) pendingUsage = mapUsage(chunk.usage)
  }
  throw new LlmError('SSE stream ended without [DONE]', 'STREAM_CLOSED')
}
