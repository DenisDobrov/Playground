import { createHash } from 'node:crypto';
import type { Scene } from '@science/core';

export interface SceneRenderInput {
  scene: Scene;
  /** Digests of resolved scientific data and licensed asset bytes, never just their URLs. */
  scientificDataHash: string; assetHashes: string[]; audioHash: string;
}
export interface RenderSettings {
  rendererBuildHash: string; styleHash: string; fontsHash: string;
  pronunciationVersion: string; voiceVersion: string;
  width: number; height: number; fps: number;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
const hash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
export const videoContentHash = hash;
const isHash = (value: string) => /^[a-f0-9]{64}$/.test(value);

/** Deterministic job identities, not a renderer or a proof that cached files still exist. */
export function planSceneRenders(inputs: SceneRenderInput[], settings: RenderSettings) {
  if (!inputs.length || new Set(inputs.map(i => i.scene.id)).size !== inputs.length) throw new Error('Unique scenes required');
  if (![settings.width, settings.height, settings.fps].every(v => Number.isSafeInteger(v) && v > 0) || !settings.pronunciationVersion.trim() || !settings.voiceVersion.trim()) throw new Error('Invalid render settings');
  if (![settings.rendererBuildHash, settings.styleHash, settings.fontsHash].every(isHash)) throw new Error('Build, style and font hashes required');
  const scenes = inputs.map(input => {
    if (![input.scientificDataHash, input.audioHash, ...input.assetHashes].every(isHash)) throw new Error('Resolved input hashes required');
    if (!input.scene.id.trim() || !input.scene.narrationEs.trim() || !Number.isFinite(input.scene.durationSeconds) || input.scene.durationSeconds <= 0) throw new Error('Invalid scene');
    const inputHash = hash({ contract: 'scene-render/1', input, settings });
    return { sceneId: input.scene.id, inputHash, idempotencyKey: `render_scene:${inputHash}` };
  });
  // Order matters to assembly, while unchanged scene renders can survive a reorder.
  const assemblyHash = hash({ contract: 'assemble/1', scenes: scenes.map(s => s.inputHash), settings });
  return { scenes, assemblyKey: `assemble:${assemblyHash}` };
}
