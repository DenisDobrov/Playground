import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Script } from '@science/core';
export * from './scene-plan';
export * from './hybrid';
export * from './pan-fallback';

function timestamp(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
}
export function validateTimeline(script: Script): void {
  if (!script.scenes.length) throw new Error('Timeline needs scenes');
  for (const scene of script.scenes) {
    if (!Number.isFinite(scene.durationSeconds) || scene.durationSeconds <= 0 || !scene.narrationEs.trim()) throw new Error('Invalid scene timing or narration');
  }
}
export function createSubtitles(script: Script): string {
  validateTimeline(script);
  let cursor = 0;
  return script.scenes.map((scene, i) => {
    const start = cursor;
    cursor += scene.durationSeconds;
    return `${i + 1}\n${timestamp(start)} --> ${timestamp(cursor)}\n${scene.narrationEs.replace(/\r?\n/g, ' ')}\n`;
  }).join('\n');
}
function runFfmpeg(executable: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(executable, args, { cwd, shell: false, windowsHide: true, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolvePromise() : reject(new Error(`FFmpeg exited ${code}`)));
  });
}

/** Preview renderer: original background + captions. No voice, music or licensed source images. */
export async function renderSilentPreview(script: Script, outputDirectory: string): Promise<string> {
  validateTimeline(script);
  const dir = resolve(outputDirectory);
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, 'captions.srt'), createSubtitles(script));
  const duration = script.scenes.reduce((total, scene) => total + scene.durationSeconds, 0);
  await runFfmpeg(process.env.FFMPEG_PATH || 'ffmpeg', [
    '-hide_banner', '-n', '-f', 'lavfi', '-i', 'color=c=0x143a34:s=1280x720:r=25',
    '-t', String(duration), '-vf', 'subtitles=captions.srt:force_style=\'FontSize=24,Alignment=2,MarginV=80\'',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'preview-silent.mp4'
  ], dir);
  return resolve(dir, 'preview-silent.mp4');
}

export interface VoiceProvider {
  synthesize(input: { textEs: string; voiceId: string; outputPath: string }): Promise<{ path: string; durationSeconds: number; costUsd: number }>;
}
export interface YouTubePublishRequest {
  videoPath: string; titleEs: string; descriptionEs: string;
  privacyStatus: 'private'; releaseApprovalId: string;
}
// The future uploader accepts only an approved release and initially uploads as private.
export interface YouTubePublisher { upload(request: YouTubePublishRequest): Promise<{ videoId: string }> }
