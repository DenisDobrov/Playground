import {mkdir,writeFile} from 'node:fs/promises';
import {runContent} from './content';
import {contentKinds,type ContentKind} from '@science/core';
const brief=process.argv[2],kind=process.argv[3];
if(!brief||!kind)throw new Error('content:local -- <approved-brief-uuid> <article_es|article_en|script_es|all> [--preflight]');
const kinds=kind==='all'?contentKinds:[kind as ContentKind],results=[];
for(const k of kinds)results.push(await runContent(brief,k,process.argv.includes('--preflight')));
await mkdir('artifacts/content-pilot',{recursive:true});await writeFile('artifacts/content-pilot/run.json',JSON.stringify(results,null,2));
console.log(JSON.stringify({event:'content.local',results,publication:'blocked'}));
