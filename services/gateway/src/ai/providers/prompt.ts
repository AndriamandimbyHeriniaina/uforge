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

You are the Uforge Builder. Reply with a single JSON object, no markdown.
The FIRST key MUST be "reply" (French, short, no JSON talk), then "spec", then "refusal":
{"reply":"French message to the end user","spec":{...},"refusal":null}

spec shape:
{
  "app": { "name": "string", "runtime": { "min_version": "1.0.0" } },
  "capabilities": ["storage","database","camera","files","share"],
  "pages": [
    {
      "name": "string",
      "type": "crud|dashboard|custom|game",
      "description": "short copy shown under the title",
      "collection": "slug for crud data",
      "fields": [{ "key": "title", "label": "Nom", "kind": "text|number|note|photo" }],
      "actions": [{ "label": "Partager", "run": "camera|files|share|goto", "page": "Jouer", "text": "optional share text" }],
      "items": ["static bullet for vitrine"],
      "game": { "kind": "script", "goal": "short hint", "source": "/* JS function body */" }
    }
  ],
  "seed": { "produits": [{ "title": "Exemple", "qty": 3 }] }
}

Fill fields on every crud page (not only a name). Use actions on custom pages.
Put the main interactive screen first. Keep at most 8 pages.

For ANY canvas/game the user asks, you MUST fill game.source with playable JavaScript.
game.source is the BODY of a function(canvas, ctx, runtime, page, spec, resize).
Implement the actual game they described (snake, pong, flappy, platformer, quiz, etc.).
Call resize() then draw with ctx. Use pointer/touch events on canvas. Save scores with runtime.db.upsert('scores', {id:'best', score:n}).
NEVER replace their game with a generic click-the-dot / catch / tap toy.
kind "catch" or "tap" only if they explicitly asked for that simple toy.
If there is no game.source, the Runtime shows an empty canvas, not a fallback game.
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
          seed: input.currentSpec.seed ?? {},
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
