import {describe,it,expect} from 'vitest';
import {createHmac} from 'node:crypto';
import {prepareReviewImport,reviewHash} from '@science/sources';
const key='a1'.repeat(32); // Synthetic test secret, never a deployed key.
const actor='09000000-0000-4000-8000-000000000001';
const markdown='# 1. Artificial intelligence: Original title\n## What changed\nOriginal summary.\nhttps://arxiv.org/abs/2504.16746v2\n## Hype check\nUnverified.\n';
describe('trusted review submission boundary',()=>{
  it('rebuilds extraction from Markdown and signs document, exact payload, source, parser and actor',()=>{
    const choices=[{key:'section-1',identity:'arxiv:2504.16746',reopen:true,extraction:{title:'Forged'}}];
    const request=prepareReviewImport(markdown,'chatgpt',actor,choices,key);
    const item=JSON.parse(request.p_items)[0];
    expect(item.extraction.title).toBe('Artificial intelligence: Original title');
    expect(item.extraction.verification).toBe('unverified');
    const message=['review-import/1',actor,request.p_parser_version,'chatgpt',reviewHash(markdown),reviewHash(request.p_items)].join('\n');
    expect(request.p_attestation).toBe(createHmac('sha256',Buffer.from(key,'hex')).update(message).digest('hex'));
    expect(prepareReviewImport(markdown+' ', 'chatgpt',actor,choices,key).p_attestation).not.toBe(request.p_attestation);
    expect(prepareReviewImport(markdown,'external_review',actor,choices,key).p_attestation).not.toBe(request.p_attestation);
    expect(prepareReviewImport(markdown,'chatgpt',actor.replace(/1$/,'2'),choices,key).p_attestation).not.toBe(request.p_attestation);
    expect(prepareReviewImport(markdown,'chatgpt',actor,[{...choices[0],reopen:false}],key).p_attestation).not.toBe(request.p_attestation);
  });
  it('fails closed without a server key or when choices do not belong to the parsed original',()=>{
    const choices=[{key:'section-1',identity:'arxiv:2504.16746'}];
    expect(()=>prepareReviewImport(markdown,'chatgpt',actor,choices,'')).toThrow();
    expect(()=>prepareReviewImport(markdown,'chatgpt',actor,[{key:'section-9',identity:null}],key)).toThrow();
    expect(()=>prepareReviewImport(markdown,'chatgpt',actor,[{key:'section-1',identity:'doi:10.9999/forged'}],key)).toThrow();
  });
});
