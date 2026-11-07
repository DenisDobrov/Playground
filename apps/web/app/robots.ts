import type {MetadataRoute} from 'next';
export default function robots():MetadataRoute.Robots {
  return {rules:{userAgent:'*',allow:['/noticias/','/en/news/','/semana/','/en/week/'],disallow:['/editorial/','/login','/auth/','/api/']},sitemap:'https://dobrov.org/sitemap.xml'};
}
