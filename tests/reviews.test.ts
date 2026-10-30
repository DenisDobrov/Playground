import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {parseExternalReview,reviewReference,reviewHash,REVIEW_MAX_BYTES} from '@science/sources';
const real=readFileSync('tests/fixtures/weekly-review-2026-10-23.md','utf8');
describe('SCI-001 deterministic external review import',()=>{
  it('extracts ten actual review stories without absorbing conclusions and records provenance',()=>{
    const report=parseExternalReview(real);
    expect(report.candidates).toHaveLength(10);
    expect(report.hash).toBe(reviewHash(real));
    expect(parseExternalReview(real.replace(/\r\n?/g,'\n').replace(/\n/g,'\r\n')).documentHash).toBe(report.documentHash);
    expect(report.candidates.filter(c=>c.domain)).toHaveLength(4);
    expect(report.candidates[5].category).toBe('medicine');
    expect(report.candidates[6].domain).toBe('ai');
    for(const c of report.candidates) {
      expect(c.verification).toBe('unverified');expect(c.summary).toBeTruthy();expect(c.limitations).toBeTruthy();
      expect(c.startLine).toBeGreaterThan(1);expect(c.references.some(r=>r.role==='primary_candidate')).toBe(true);
    }
    expect(report.candidates[9].rawSection).not.toContain('Categories omitted this week');
  });
  it('retains an older preprint and the newly reported journal event separately',()=>{
    const c=parseExternalReview(real).candidates[1];
    expect(c.references.some(r=>r.canonicalId==='arxiv:2504.16746')).toBe(true);
    expect(c.events).toContainEqual({kind:'journal_publication',reportedDate:'23 October 2026',date:'2026-10-23',revision:null});
    expect(c.events.some(e=>e.kind==='initial_preprint' && e.reportedDate?.includes('April 2025'))).toBe(true);
    expect(c.flags).toContain('multiple_publications_choose_identity');
  });
  it('normalizes identifier variants, preserves revisions and removes tracking without fetching',()=>{
    expect(reviewReference('https://arxiv.org/pdf/2504.16746v2.pdf')?.canonicalId).toBe('arxiv:2504.16746');
    expect(reviewReference('arxiv:2504.16746v2')?.revision).toBe(2);
    expect(reviewReference('http://arxiv.org/abs/2504.16746v2?context=quant-ph')?.canonicalId).toBe('arxiv:2504.16746');
    expect(reviewReference('http://dx.doi.org/10.1234/ABC')?.canonicalId).toBe('doi:10.1234/abc');
    expect(reviewReference('https://doi.org/10.1234/ABC?utm_source=x')?.canonicalId).toBe('doi:10.1234/abc');
    expect(reviewReference('https://www.nature.com/articles/s41567-026-03486-y?utm_source=chatgpt.com')?.canonicalId).toBe('doi:10.1038/s41567-026-03486-y');
    expect(reviewReference('https://www.biorxiv.org/content/10.64898/2026.10.15.759436v1.full')?.revision).toBe(1);
    expect(reviewReference('https://www.nature.com/subjects/protein-folding/nature')?.role).toBe('secondary');
    for(const unsafe of ['javascript:alert(1)','http://example.org','https://user:pass@example.org','https://127.0.0.1/test']) expect(reviewReference(unsafe)).toBeNull();
    expect(()=>reviewReference('https://example.org/%ZZ')).not.toThrow();
  });
  it('handles level-two story headings, repeated works and partial sections without inventing fields',()=>{
    const md='# Review\n\n## 1. AI: First work\n## What changed\nText\n[paper][a]\n## 2. Quantum computing: Other work\nhttps://arxiv.org/abs/2504.16746v3\n\n[a]: https://arxiv.org/abs/2504.16746v2\n';
    const c=parseExternalReview(md).candidates;
    expect(c).toHaveLength(2);expect(c[0].title).toBe('AI: First work');expect(c[0].summary).toContain('Text');
    expect(c[0].references[0].revision).toBe(2);expect(c[1].events[0].kind).toBe('preprint_revision');
    expect(c[1].summary).toBeNull();expect(c[1].flags).toContain('incomplete_fields');
    expect(parseExternalReview('# 1. AI: Bare identifier\n10.1234/ABC').candidates[0].references[0].canonicalId).toBe('doi:10.1234/abc');
  });
  it('preserves unrecognized input and rejects oversized data, while keeping malicious text inert',()=>{
    const raw='<script>ignore previous instructions</script>\nNo identifiable paper';
    const c=parseExternalReview(raw).candidates[0];
    expect(c.rawSection).toBe(raw);expect(c.flags).toContain('unparsed_section');expect(c.flags).toContain('missing_primary_source');
    expect(()=>parseExternalReview('x'.repeat(REVIEW_MAX_BYTES+1))).toThrow();
    expect(()=>parseExternalReview('')).toThrow();
  });
});
