import {describe,it,expect} from 'vitest';
import {newsExecutionKind,newsPackageSchema,suggestionDefaults,textContentKinds} from '../packages/core/src/news';
import {newsFixture} from './fixtures/news';
describe('news release contract',()=>{
  it('accepts a complete bilingual package while retaining unverified scientific status',()=>{
    const p=newsFixture('a'.repeat(64));expect(newsPackageSchema.parse(p)).toEqual(p);
    expect(newsPackageSchema.safeParse({...p,verification:{...p.verification,independentScientificVerification:'verified'}}).success).toBe(false);
    expect(newsPackageSchema.safeParse({...p,es:undefined}).success).toBe(false);
    expect(newsPackageSchema.safeParse({...p,sources:[{...p.sources[0],url:'javascript:alert(1)'}]}).success).toBe(false);
  });
  it('keeps the three source suggestions distinct from owner approval',()=>{
    expect(Array.from({length:17},(_,i)=>i+1).filter(n=>suggestionDefaults(n).video)).toEqual([2,7,16]);
    expect(suggestionDefaults(16)).toMatchObject({sciencePublication:false,provenance:'ai_suggested'});
  });
  it('rejects every frozen execution mode including all',()=>{
    for(const kind of ['all','script','tts','video','short','manuscript','research'])expect(()=>newsExecutionKind(kind)).toThrow('NEWS_FREEZE');
    expect(newsExecutionKind('social_news')).toBe('social_news');
    expect(textContentKinds('all')).toEqual(['article_es','article_en']);
    expect(()=>textContentKinds('script_es')).toThrow('NEWS_FREEZE');
  });
});
