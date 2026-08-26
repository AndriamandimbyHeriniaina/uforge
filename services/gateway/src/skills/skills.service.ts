import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type PromptSkill = {
  filename: string;
  name: string;
  priority: number;
  enabled: boolean;
  body: string;
};

export type LoadedSkills = {
  skills: PromptSkill[];
  block: string;
  names: string[];
  hash: string;
};

@Injectable()
export class SkillsService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Reads every markdown file from the skills deposit on this call.
   * No process cache: dropping a file is visible on the next user prompt.
   *
   * @example
   * const loaded = await skillsService.loadForPrompt();
   * const system = `${loaded.block}\n\nUser request:\n${prompt}`;
   */
  async loadForPrompt(): Promise<LoadedSkills> {
    const dir = this.config.get<string>('HFORGE_SKILLS_DIR', '/skills/prompt');
    const maxChars = Number(
      this.config.get<string>('HFORGE_SKILLS_MAX_CHARS', '32000'),
    );
    let filenames: string[] = [];
    try {
      filenames = (await readdir(dir)).filter(
        (name) =>
          name.endsWith('.md') &&
          name.toLowerCase() !== 'readme.md' &&
          !name.startsWith('.'),
      );
    } catch {
      return { skills: [], block: '', names: [], hash: 'empty' };
    }

    const parsed: PromptSkill[] = [];
    for (const filename of filenames.sort()) {
      const raw = await readFile(join(dir, filename), 'utf8');
      parsed.push(this.parseFile(filename, raw));
    }

    const enabled = parsed
      .filter((skill) => skill.enabled)
      .sort((a, b) => a.priority - b.priority || a.filename.localeCompare(b.filename));

    const parts: string[] = [];
    let used = 0;
    const names: string[] = [];
    for (const skill of enabled) {
      const chunk = `## Skill: ${skill.name}\n${skill.body.trim()}\n`;
      if (used + chunk.length > maxChars) {
        break;
      }
      parts.push(chunk);
      names.push(skill.name);
      used += chunk.length;
    }

    const block = parts.join('\n');
    const hash = createHash('sha256').update(block).digest('hex').slice(0, 16);
    return { skills: enabled, block, names, hash };
  }

  async list(): Promise<PromptSkill[]> {
    const loaded = await this.loadForPrompt();
    return loaded.skills;
  }

  private parseFile(filename: string, raw: string): PromptSkill {
    const fallback: PromptSkill = {
      filename,
      name: filename.replace(/\.md$/, ''),
      priority: 100,
      enabled: true,
      body: raw,
    };
    if (!raw.startsWith('---')) {
      return fallback;
    }
    const close = raw.indexOf('\n---', 3);
    if (close === -1) {
      return fallback;
    }
    const yaml = raw.slice(4, close);
    const body = raw.slice(close + 4).replace(/^\s*\n/, '');
    const skill = { ...fallback, body };
    for (const line of yaml.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const colon = trimmed.indexOf(':');
      if (colon === -1) {
        continue;
      }
      const key = trimmed.slice(0, colon).trim();
      const value = trimmed.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
      if (key === 'name') {
        skill.name = value;
      }
      if (key === 'priority') {
        skill.priority = Number(value) || 100;
      }
      if (key === 'enabled') {
        skill.enabled = value !== 'false';
      }
    }
    return skill;
  }
}
