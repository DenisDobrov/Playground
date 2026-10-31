import {describe,it,expect} from 'vitest';
import {extractPdf} from '../apps/worker/src/primary-document';
import {syntheticPdf} from './fixtures/pdf';
describe('bounded PDF text intake',()=>{
 it('extracts exact text with real PDF page boundaries in an isolated worker',async()=>{const pages=await extractPdf(syntheticPdf());expect(pages).toHaveLength(1);expect(pages[0]).toContain('Synthetic PDF text layer.');},25000);
 it('rejects malformed/oversized files without inventing OCR or page contents',async()=>{expect(()=>extractPdf(new Uint8Array(4194305))).toThrow();expect(()=>extractPdf(new Uint8Array([1,2,3]))).toThrow();await expect(extractPdf(Buffer.from('%PDF-garbage'))).rejects.toThrow();},25000);
});
