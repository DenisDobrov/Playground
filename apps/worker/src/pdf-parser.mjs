// Isolated PDF text layer parsing: no network, JavaScript actions, attachments or OCR execution.
import {parentPort,workerData} from 'node:worker_threads';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
try {
 const packageDir=dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
 const task=getDocument({data:new Uint8Array(workerData),isEvalSupported:false,useSystemFonts:false,disableFontFace:true,stopAtErrors:true,verbosity:0,standardFontDataUrl:packageDir+'/standard_fonts/'});
 const pdf=await task.promise;
 if(pdf.numPages<1||pdf.numPages>40) throw new Error('PDF page limit: 40');
 const pages=[];let bytes=0;
 for(let n=1;n<=pdf.numPages;n++) {
  const page=await pdf.getPage(n),content=await page.getTextContent();
  const text=content.items.map(item=>'str' in item?item.str+(item.hasEOL?'\n':' '):'').join('');
  bytes+=Buffer.byteLength(text);if(bytes>262144) throw new Error('PDF text limit: 256 KiB');
  pages.push(text);page.cleanup();
 }
 await task.destroy();if(!pages.some(p=>p.trim())) throw new Error('No text layer; OCR/manual text required');
 parentPort.postMessage({pages});
} catch {parentPort.postMessage({error:'PDF extraction failed: check page/text limits, password, scan or malformed file.'});}
