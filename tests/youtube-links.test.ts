import {describe,it,expect} from 'vitest';
import {normalizeYouTubeUrl,youtubeLinkLabels,videoLanguageLabel} from '../apps/web/lib/youtube-links';
describe('safe editorial YouTube links',()=>{
 it('normalizes supported video URLs without contacting YouTube',()=>{
  for(const url of ['https://www.youtube.com/watch?v=OfJnrExLe4M&t=12','https://youtu.be/OfJnrExLe4M?si=tracking','http://m.youtube.com/watch?v=OfJnrExLe4M','https://www.youtube.com/shorts/OfJnrExLe4M','https://youtube.com/live/OfJnrExLe4M','https://youtube.com/embed/OfJnrExLe4M','https://www.youtube-nocookie.com/embed/OfJnrExLe4M','https://music.youtube.com/watch?v=OfJnrExLe4M','https://youtube.com/v/OfJnrExLe4M'])expect(normalizeYouTubeUrl(url)).toEqual({id:'OfJnrExLe4M',url:'https://www.youtube.com/watch?v=OfJnrExLe4M'});
 });
 it('rejects deceptive hosts, executable URLs, credentials, playlists and ambiguous IDs',()=>{
  for(const url of ['javascript:alert(1)','https://youtube.com.evil.test/watch?v=OfJnrExLe4M','https://youtube.com@evil.test/watch?v=OfJnrExLe4M','https://user:pass@youtube.com/watch?v=OfJnrExLe4M','https://youtube.com:8443/watch?v=OfJnrExLe4M','https://youtu.be/OfJnrExLe4M/extra','https://youtube.com/watch?v=OfJnrExLe4M&v=AAAAAAAAAAA','https://youtube.com/playlist?list=OfJnrExLe4M','https://youtube.com/watch?v=short','https://youtube.com/watch?v=%3Cscript%3E','https://youtube-nocookie.com/watch?v=OfJnrExLe4M','file:///watch?v=OfJnrExLe4M'])expect(()=>normalizeYouTubeUrl(url),url).toThrow();
  expect(normalizeYouTubeUrl('  ')).toBeNull();
 });
 it('uses the requested labels and explicit video-language notices',()=>{
  expect(youtubeLinkLabels).toEqual({es:'Ver vídeo en YouTube',en:'Watch on YouTube',ru:'Смотреть видео на YouTube','zh-Hans':'在 YouTube 上观看视频'});
  expect(videoLanguageLabel('en','en')).toBe('Video in English');expect(videoLanguageLabel('ru','en')).toBe('Видео на английском');expect(videoLanguageLabel('zh-Hans','en')).toContain('英语');expect(videoLanguageLabel('es',null)).toBeNull();
 });
});
