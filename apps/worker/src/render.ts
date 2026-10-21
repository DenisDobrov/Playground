import { demoBundle } from '@science/core/demo';
import { renderSilentPreview } from '@science/video';
const path = await renderSilentPreview(demoBundle.script, 'artifacts/video-preview');
console.log(JSON.stringify({ event: 'video.preview', path, audio: false, publication: 'blocked' }));
