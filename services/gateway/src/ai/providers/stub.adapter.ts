import { Injectable } from '@nestjs/common';
import type {
  AppSpec,
  LlmProvider,
  ProviderGenerateInput,
  ProviderGenerateResult,
  StreamTokenFn,
} from './provider.types';
import { sanitizeSpec } from './spec.util';
import { emitReplySlowly } from './stream.util';

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

  generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    return this.generateStream(input, () => undefined);
  }

  async generateStream(
    input: ProviderGenerateInput,
    onToken: StreamTokenFn,
    signal?: AbortSignal,
  ): Promise<ProviderGenerateResult> {
    const { spec, reply } = this.conversationalStub(input.currentSpec, input.prompt);
    await emitReplySlowly(reply, onToken, signal);
    return {
      spec,
      reply,
      inputTokens: Math.ceil((input.skillsBlock.length + input.prompt.length) / 4),
      outputTokens: Math.ceil(JSON.stringify(spec).length / 4),
      provider: this.id,
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
        seed:
          existing.seed ??
          (prompt.toLowerCase().includes('stock')
            ? { produits: [{ title: 'Cahier', qty: 4 }] }
            : undefined),
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

  private pagesFromPrompt(prompt: string): AppSpec['pages'] {
    const lower = prompt.toLowerCase();
    if (lower.includes('jeu')) {
      return [
        {
          name: 'Jouer',
          type: 'game',
          description: 'Touche le point qui bouge.',
          game: {
            kind: 'script',
            goal: 'Un petit jeu généré',
            source:
              "resize();var s=0,x=canvas.width/2,y=canvas.height/2,vx=4,vy=3;function loop(){if(!ctx)return;x+=vx;y+=vy;if(x<20||x>canvas.width-20)vx*=-1;if(y<20||y>canvas.height-20)vy*=-1;ctx.fillStyle='#1c1814';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.beginPath();ctx.arc(x,y,20,0,Math.PI*2);ctx.fillStyle='#d4894a';ctx.fill();ctx.fillStyle='#fff';ctx.font='32px sans-serif';ctx.fillText(String(s),24,48);requestAnimationFrame(loop);}canvas.addEventListener('pointerdown',function(){s+=1;});loop();",
          },
        },
        { name: 'Scores', type: 'dashboard' },
      ];
    }
    if (lower.includes('stock')) {
      return [
        {
          name: 'Accueil',
          type: 'dashboard',
          description: 'Combien de produits tu as.',
        },
        {
          name: 'Produits',
          type: 'crud',
          collection: 'produits',
          fields: [
            { key: 'title', label: 'Produit', kind: 'text' },
            { key: 'qty', label: 'Quantité', kind: 'number' },
          ],
        },
      ];
    }
    return [
      {
        name: 'Accueil',
        type: 'custom',
        description: 'Ton application commence ici.',
      },
    ];
  }

  private extraPageFromPrompt(prompt: string): NonNullable<AppSpec['pages']>[number] | null {
    const lower = prompt.toLowerCase();
    if (lower.includes('photo') || lower.includes('caméra') || lower.includes('camera')) {
      return {
        name: 'Photos',
        type: 'custom',
        description: 'Des photos prises avec le téléphone.',
        actions: [{ label: 'Prendre une photo', run: 'camera' }],
      };
    }
    if (lower.includes('client')) {
      return {
        name: 'Clients',
        type: 'crud',
        collection: 'clients',
        fields: [
          { key: 'title', label: 'Nom', kind: 'text' },
          { key: 'note', label: 'Note', kind: 'note' },
        ],
      };
    }
    if (lower.includes('rdv') || lower.includes('rendez')) {
      return {
        name: 'Agenda',
        type: 'custom',
        description: 'Tes prochains rendez-vous.',
        items: ['Ajoute tes créneaux ici en me le disant.'],
      };
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
