import type {NewsRelease} from '../lib/news-seo';
import {videoForNews} from '../lib/news-video';

export function NewsVideo({release}:{release:NewsRelease}) {
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
