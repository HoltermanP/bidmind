import type { Message } from '@anthropic-ai/sdk/resources/messages/messages'
import { openai, anthropic, isProviderAvailable } from '@/lib/ai/client'
import { getAgentConfig, type AgentConfig, type AgentId } from '@/lib/ai/agents'

export interface RunCompletionOptions {
  maxTokens?: number
  /** Vraag JSON-object in de response (OpenAI: response_format; Anthropic: in system prompt) */
  jsonMode?: boolean
}

/**
 * Alle tekst uit een Anthropic-assistantbericht (meerdere text-blokken kunnen voorkomen,
 * o.a. na thinking-blokken; alleen het eerste blok lezen gaf lege output).
 */
export function collectAnthropicTextFromMessage(response: Message): string {
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
}

async function anthropicMessagesCreate(
  config: AgentConfig,
  system: string,
  user: string,
  options: RunCompletionOptions
) {
  if (!anthropic) throw new Error('Anthropic not configured')
  const maxTokens = options.maxTokens ?? config.maxTokens ?? 2000
  const systemWithJson = options.jsonMode
    ? `${system}\n\nReageer uitsluitend met een geldig JSON-object, geen andere tekst.`
    : system
  return anthropic.messages.create({
    model: config.model,
    max_tokens: maxTokens,
    system: systemWithJson,
    messages: [{ role: 'user', content: user }],
  })
}

/**
 * Anthropic-completion met stop_reason (o.a. max_tokens-detectie voor lange HTML-rapporten).
 */
export async function runAnthropicCompletionDetailed(
  agentId: AgentId,
  system: string,
  user: string,
  options: RunCompletionOptions = {}
): Promise<{ text: string; stopReason: string | null }> {
  const config = getAgentConfig(agentId)
  if (config.platform !== 'anthropic') {
    throw new Error('Deze agent gebruikt geen Anthropic')
  }
  const response = await anthropicMessagesCreate(config, system, user, options)
  return {
    text: collectAnthropicTextFromMessage(response),
    stopReason: response.stop_reason,
  }
}

/**
 * Eén niet-streaming completion uitvoeren met het voor de agent geconfigureerde platform en model.
 * Gebruik voor documentanalyse en vraagengeneratie.
 */
export async function runCompletion(
  agentId: AgentId,
  system: string,
  user: string,
  options: RunCompletionOptions = {}
): Promise<string> {
  const config = getAgentConfig(agentId)
  const maxTokens = options.maxTokens ?? config.maxTokens ?? 2000

  if (config.platform === 'openai') {
    if (!openai) throw new Error('OpenAI not configured')
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      ...(options.jsonMode && { response_format: { type: 'json_object' as const } }),
      max_tokens: maxTokens,
    })
    return response.choices[0]?.message?.content ?? ''
  }

  if (config.platform === 'anthropic') {
    const response = await anthropicMessagesCreate(config, system, user, options)
    return collectAnthropicTextFromMessage(response)
  }

  throw new Error('Unsupported AI platform')
}

/**
 * Streaming completion: levert chunks in het formaat dat de bestaande frontend verwacht
 * (OpenAI SSE: data: {"choices":[{"delta":{"content":"..."}}]}\n\n).
 * Werkt voor zowel OpenAI als Anthropic (Anthropic-stream wordt omgezet naar dit formaat).
 */
export async function* runCompletionStream(
  agentId: AgentId,
  system: string,
  user: string,
  options: RunCompletionOptions = {}
): AsyncGenerator<string, void, unknown> {
  const config = getAgentConfig(agentId)
  const maxTokens = options.maxTokens ?? config.maxTokens ?? 1200

  if (config.platform === 'openai') {
    if (!openai) throw new Error('OpenAI not configured')
    const stream = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      stream: true,
      max_tokens: maxTokens,
    })
    for await (const chunk of stream) {
      yield JSON.stringify(chunk)
    }
    return
  }

  // Anthropic: stream omzetten naar OpenAI-achtige chunks zodat de frontend ongewijzigd werkt
  if (!anthropic) throw new Error('Anthropic not configured')
  const stream = anthropic.messages.stream({
    model: config.model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  })

  for await (const event of stream) {
    if (event.type === 'content_block_delta') {
      const delta = event.delta as { type?: string; text?: string }
      if (delta.type === 'text_delta' && typeof delta.text === 'string' && delta.text) {
        const openaiStyleChunk = {
          id: 'anon',
          object: 'chat.completion.chunk' as const,
          created: Math.floor(Date.now() / 1000),
          model: config.model,
          choices: [{ index: 0, delta: { content: delta.text }, finish_reason: null }],
        }
        yield JSON.stringify(openaiStyleChunk)
      }
    }
  }
  // Frontend verwacht geen expliciete [DONE]; die stopt bij geen content meer. Maar de bestaande code stuurt data: [DONE].
  // We laten de consumer (route) de laatste 'data: [DONE]' sturen na de loop.
}

/**
 * Controleert of de voor deze agent benodigde provider beschikbaar is.
 */
export function isAgentAvailable(agentId: AgentId): boolean {
  const config = getAgentConfig(agentId)
  return isProviderAvailable(config.platform)
}
