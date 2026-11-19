import type {NewsRelease} from '../lib/news-seo';
import {videoForNews} from '../lib/news-video';
import {isYouTubeId,youtubeLinkLabels,videoLanguageLabel,type NewsMedia} from '../lib/youtube-links';
import {selectText} from '../lib/news-languages';

export function NewsVideo({release,media}:{release:NewsRelease;media?:NewsMedia|null}) {
  if(media?.youtube_configured){
    if(!isYouTubeId(media.youtube_id))return null;
    const label=videoLanguageLabel(release.language,media.youtube_language);
    return <aside className="news-video news-related-video" aria-label={selectText(release.language,'Vídeo relacionado','Related video','Видео по теме','相关视频')}>
      <p><a className="news-video-link" href={'https://www.youtube.com/watch?v='+media.youtube_id} rel="noopener noreferrer">{youtubeLinkLabels[release.language]}</a></p>
      {label&&<p className="news-video-disclosure">{label}</p>}
    </aside>;
  }
  const video=videoForNews(release);
  if(!video)return null;
  return <section className="news-video" aria-labelledby="news-video-title">
    <h2 id="news-video-title">{video.heading}</h2>
    <p>{video.context}</p>
    <iframe src={`https://www.youtube-nocookie.com/embed/${video.id}`} title={video.title}
      width="740" height="416" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"/>
    <p><a className="news-video-link" href={video.url} rel="noopener noreferrer">{video.link} ↗</a></p>
    <p className="news-video-disclosure">{video.disclosure}</p>
  </section>;
}
