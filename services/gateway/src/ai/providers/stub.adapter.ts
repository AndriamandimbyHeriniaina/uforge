import { Injectable } from '@nestjs/common';
import type {
  AppSpec,
  LlmProvider,
  ProviderGenerateInput,
  ProviderGenerateResult,
} from './provider.types';
import { sanitizeSpec } from './spec.util';

/**
 * Offline fallback when no provider API key is configured.
 *
 * @example
 * const result = await stub.generate({ prompt: 'Un stock', currentSpec: {}, skillsBlock: '' });
 */
@Injectable()
export class StubAdapter implements LlmProvider {
  readonly id = 'stub';

  isConfigured(): boolean {
    return true;
  }

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    const { spec, reply } = this.conversationalStub(input.currentSpec, input.prompt);
    return {
      spec,
      reply,
      inputTokens: Math.ceil((input.skillsBlock.length + input.prompt.length) / 4),
      outputTokens: Math.ceil(JSON.stringify(spec).length / 4),
      provider: 'stub',
      model: 'hforge-stub-v0',
    };
  }

  private conversationalStub(existing: AppSpec, prompt: string) {
    const previousPages = Array.isArray(existing.pages) ? [...existing.pages] : [];
    const previousCaps = Array.isArray(existing.capabilities)
      ? [...existing.capabilities]
      : [];
    const first = previousPages.length === 0;
    if (first) {
      previousPages.push(...this.pagesFromPrompt(prompt));
    } else {
      const extra = this.extraPageFromPrompt(prompt);
      if (extra && !previousPages.some((page) => page.name === extra.name)) {
        previousPages.push(extra);
      }
    }
    const reply = first
      ? 'D’accord. Voici une première version. Dis-moi ce que tu veux ajouter ou changer — pas besoin de tout dire d’un coup.'
      : 'C’est noté, j’ai ajusté. Tu peux continuer, et quand c’est bon tu utilises l’appli.';
    const spec = sanitizeSpec(
      {
        app: {
          name: existing.app?.name || this.nameFromPrompt(prompt),
          runtime: { min_version: '1.0.0' },
        },
        capabilities: [
          ...new Set([...previousCaps, ...this.guessCapabilities(prompt)]),
        ],
        pages: previousPages,
      },
      existing,
      prompt,
      reply,
    );
    return { spec, reply };
  }

  private nameFromPrompt(prompt: string): string {
    const lower = prompt.toLowerCase();
    if (lower.includes('stock')) {
      return 'Mon stock';
    }
    if (lower.includes('salon') || lower.includes('coiff')) {
      return 'Mon salon';
    }
    if (lower.includes('jeu')) {
      return 'Mon jeu';
    }
    return 'Mon application';
  }

  private pagesFromPrompt(prompt: string): Array<{ name: string; type: string }> {
    const lower = prompt.toLowerCase();
    if (lower.includes('jeu')) {
      return [
        { name: 'Jouer', type: 'game' },
        { name: 'Scores', type: 'dashboard' },
      ];
    }
    if (lower.includes('stock')) {
      return [
        { name: 'Accueil', type: 'dashboard' },
        { name: 'Produits', type: 'crud' },
      ];
    }
    return [{ name: 'Accueil', type: 'custom' }];
  }

  private extraPageFromPrompt(prompt: string): { name: string; type: string } | null {
    const lower = prompt.toLowerCase();
    if (lower.includes('photo') || lower.includes('caméra') || lower.includes('camera')) {
      return { name: 'Photos', type: 'custom' };
    }
    if (lower.includes('client')) {
      return { name: 'Clients', type: 'crud' };
    }
    if (lower.includes('rdv') || lower.includes('rendez')) {
      return { name: 'Agenda', type: 'custom' };
    }
    return null;
  }

  private guessCapabilities(prompt: string): string[] {
    const lower = prompt.toLowerCase();
    const caps: string[] = ['storage', 'database'];
    if (lower.includes('camera') || lower.includes('photo') || lower.includes('barcode')) {
      caps.push('camera');
    }
    if (lower.includes('bluetooth')) {
      caps.push('bluetooth');
    }
    if (lower.includes('fichier') || lower.includes('file') || lower.includes('pdf')) {
      caps.push('files');
    }
    return caps;
  }
}
