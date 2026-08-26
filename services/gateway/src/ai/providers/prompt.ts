import type { ProviderGenerateInput } from './provider.types';

export type ChatMessage = { role: 'system' | 'user'; content: string };

/**
 * Builds the provider messages: skills on every call, then spec + user prompt.
 *
 * @example
 * const messages = buildGenerateMessages(input);
 */
export function buildGenerateMessages(input: ProviderGenerateInput): ChatMessage[] {
  const recent = (input.currentSpec.conversation ?? []).slice(-12);
  return [
    {
      role: 'system',
      content: `${input.skillsBlock}

# Output format

You are the Uforge Builder. Reply with a single JSON object, no markdown:
{"reply":"French message to the end user","spec":{...},"refusal":null}

spec shape:
{
  "app": { "name": "string", "runtime": { "min_version": "1.0.0" } },
  "capabilities": ["storage","database","camera","files","share"],
  "pages": [{ "name": "string", "type": "crud|dashboard|custom|game" }]
}

Do not include conversation inside spec. The gateway appends it.
Speak to the user in French, short and plain. Do not mention JSON, APIs, or code.
If the request is forbidden by skills, set refusal to a French explanation and keep spec unchanged.`,
    },
    {
      role: 'user',
      content: `Current spec:\n${JSON.stringify(
        {
          app: input.currentSpec.app ?? {},
          pages: input.currentSpec.pages ?? [],
          capabilities: input.currentSpec.capabilities ?? [],
        },
        null,
        2,
      )}\n\nRecent conversation:\n${JSON.stringify(
        recent,
        null,
        2,
      )}\n\nUser message:\n${input.prompt}`,
    },
  ];
}
