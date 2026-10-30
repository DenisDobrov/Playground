'use server';
import {parseExternalReview,prepareReviewImport,REVIEW_MAX_BYTES} from '@science/sources';
import {requireMember} from '../../../../lib/editorial-auth';
import {reviewPreview} from '../../../../lib/review-preview';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
export interface ImportState {markdown?:string;preview?:Awaited<ReturnType<typeof reviewPreview>>;hash?:string;error?:string;sourceType?:string}
export async function previewReview(_previous:ImportState,form:FormData):Promise<ImportState> {
  const {client}=await requireMember(true);
  const file=form.get('file');
  let markdown=String(form.get('markdown')||'');
  if(file instanceof File && file.size) {
    if(markdown.trim()) return {error:'Elige texto pegado o archivo, no ambos.'};
    if(!/\.(?:md|markdown)$/i.test(file.name) || file.size>REVIEW_MAX_BYTES) return {error:'Usa un archivo Markdown de hasta 256 KiB.'};
    markdown=await file.text();
  }
  try {
    const parsed=parseExternalReview(markdown);
    return {markdown,preview:await reviewPreview(client,parsed),hash:parsed.hash,sourceType:form.get('sourceType')==='chatgpt' ? 'chatgpt' : 'external_review'};
  } catch {return {error:'No se pudo preparar la vista previa. Revisa el Markdown, el límite de 256 KiB y la conexión editorial.'};}
}
export async function confirmReview(_previous:ImportState,form:FormData):Promise<ImportState> {
  const {client,user}=await requireMember(true);
  let id:string;
  try {
    const encoded=form.get('document');
    if(typeof encoded!=='string' || encoded.length>REVIEW_MAX_BYTES*6) throw new Error('Invalid document');
    const markdown=JSON.parse(encoded);
    if(typeof markdown!=='string') throw new Error('Invalid document');
    const selected=form.getAll('selected');
    if(!selected.length || selected.some(key=>typeof key!=='string')) throw new Error('Select a valid section');
    const selection=selected.map(value=>{const key=String(value);return {key,identity:String(form.get('identity:'+key)||'')||null,reopen:form.get('reopen:'+key)==='on'};});
    const submission=prepareReviewImport(markdown,form.get('sourceType')==='chatgpt' ? 'chatgpt' : 'external_review',user.id,selection,process.env.EDITORIAL_REVIEW_SIGNING_KEY||'');
    const {data,error}=await client.rpc('import_external_review',submission);
    if(error || !data) throw new Error('Import failed');
    id=data as string;
  } catch {return {error:'No se guardó la selección. Comprueba la migración 009, la clave de firma del servidor, los permisos y las publicaciones elegidas. Prepara de nuevo la vista previa para corregirla.'};}
  revalidatePath('/editorial');revalidatePath('/editorial/stories');revalidatePath('/editorial/imports');
  redirect('/editorial/imports/'+id);
}
