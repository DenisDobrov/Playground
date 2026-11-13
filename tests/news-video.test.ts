import {describe,it,expect} from 'vitest';
import {videoForNews} from '../apps/web/lib/news-video';

const release={package_id:'0c931448-f8f5-4223-bb57-55902553fbf7',story_id:'0e39b965-39f4-46ab-b0b8-274a9999b841',slug:'chatbot-personality-what-the-study-measures',language:'es' as const};
describe('published video association',()=>{
  it('cannot attach an authorized video to another story or revision',()=>{
    expect(videoForNews(release)?.url).toBe('https://www.youtube.com/watch?v=OfJnrExLe4M');
    for(const key of ['package_id','story_id','slug'] as const)expect(videoForNews({...release,[key]:'unreviewed'})).toBeNull();
  });
  it('keeps both language versions explicit about the different topic and synthetic presentation',()=>{
    const es=videoForNews(release)!,en=videoForNews({...release,language:'en'})!;
    expect(en.id).toBe(es.id);
    expect(es.context).toContain('No analiza el experimento');
    expect(en.context).toContain('does not analyse the experiment');
    expect(es.disclosure).toContain('generados mediante IA');
    expect(en.disclosure).toContain('AI-generated');
    expect(es.link).toBe('Ver el vídeo en YouTube');
    expect(en.link).toBe('Watch the video on YouTube');
  });
});
