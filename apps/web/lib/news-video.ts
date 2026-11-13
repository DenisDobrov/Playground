import type {NewsRelease} from './news-seo';

/** Owner-authorized finished master, published 13 November 2026. See docs/VIDEO-RELEASE-01.md. */
export function videoForNews(release:Pick<NewsRelease,'package_id'|'story_id'|'slug'|'language'>) {
  if(release.package_id!=='0c931448-f8f5-4223-bb57-55902553fbf7'||
    release.story_id!=='0e39b965-39f4-46ab-b0b8-274a9999b841'||
    release.slug!=='chatbot-personality-what-the-study-measures')return null;
  const en=release.language==='en';
  return {
    id:'OfJnrExLe4M',
    url:'https://www.youtube.com/watch?v=OfJnrExLe4M',
    heading:en?'Video · Additional context':'Vídeo · Contexto adicional',
    title:en?'Are AI subscriptions worth it? Usefulness, costs and valuations':'¿Vale la pena pagar por la IA? Utilidad, costes y valoraciones',
    context:en
      ?'This article examines the personality traits conveyed by chatbot language. The video explores a different question: how to assess AI’s economic usefulness, provider costs and business valuations. It does not analyse the experiment reported here.'
      :'Este artículo examina los rasgos de personalidad que comunica el lenguaje de los chatbots. El vídeo aborda otra cuestión: cómo evaluar la utilidad económica de la IA, los costes del proveedor y las valoraciones empresariales. No analiza el experimento descrito aquí.',
    disclosure:en?'Video in English. AI-generated presenter and illustrative scenes. Added on 13 November 2026.':'Vídeo en inglés. Presentador y escenas ilustrativas generados mediante IA. Añadido el 13 de noviembre de 2026.',
    link:en?'Watch the video on YouTube':'Ver el vídeo en YouTube',
  };
}
