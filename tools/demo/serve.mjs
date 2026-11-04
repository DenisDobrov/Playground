// Private loopback-only artifact viewer. No cloud, Auth, credentials, writes or publishing.
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
const root=await realpath(resolve(process.argv[2]||'artifacts/demo-001'));
const port=Number(process.argv[3]||3150);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local port');
const types={'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.srt':'text/plain; charset=utf-8','.ass':'text/plain; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.wav':'audio/wav','.mp4':'video/mp4'};
createServer(async(req,res)=>{
 const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"};
 try {
  if(!['GET','HEAD'].includes(req.method||'')||!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host||'')){res.writeHead(403,headers).end();return;}
  if(req.url==='/'){const latest=JSON.parse(await readFile(resolve(root,'latest.json'),'utf8'));if(!/^[a-f0-9]{64}$/.test(latest.revision))throw Error('Invalid revision');res.writeHead(302,{...headers,Location:'/revisions/'+latest.revision+'/index.html'}).end();return;}
  const path=await realpath(resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname)));
  if(!path.startsWith(root+sep)||!types[extname(path)]){res.writeHead(403,headers).end();return;}
  const file=await stat(path);if(!file.isFile())throw Error('Not a file');
  const range=req.headers.range;let start=0,end=file.size-1,status=200;
  if(range){const match=/^bytes=(\d+)-(\d*)$/.exec(range);if(!match||Number(match[1])>=file.size){res.writeHead(416,{...headers,'Content-Range':'bytes */'+file.size}).end();return;}start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;if(end<start){res.writeHead(416,headers).end();return;}status=206;}
  res.writeHead(status,{...headers,'Content-Type':types[extname(path)],'Content-Length':end-start+1,'Accept-Ranges':'bytes',...(status===206?{'Content-Range':`bytes ${start}-${end}/${file.size}`}:{})});
  if(req.method==='HEAD')res.end();else createReadStream(path,{start,end}).on('error',()=>res.destroy()).pipe(res);
 }catch{res.writeHead(404,headers).end('Artifact not found');}
}).listen(port,'127.0.0.1',()=>console.log(JSON.stringify({privateReview:'http://127.0.0.1:'+port,root,publicationEnabled:false})));
