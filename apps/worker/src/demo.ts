import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { demoBundle } from '@science/core/demo';
import { rehearse } from '@science/pipeline';
import { createSubtitles } from '@science/video';

const report = rehearse(demoBundle);
const dir = resolve('artifacts/demo');
await mkdir(dir, { recursive: true });
await writeFile(resolve(dir, 'bundle.json'), JSON.stringify(demoBundle, null, 2));
await writeFile(resolve(dir, 'report.json'), JSON.stringify(report, null, 2));
await writeFile(resolve(dir, 'captions.srt'), createSubtitles(demoBundle.script));
console.log(JSON.stringify({ event: 'demo.finished', mode: 'synthetic_fixture', output: dir, paidCalls: 0, publication: 'blocked', stages: report.events }));
