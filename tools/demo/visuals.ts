import {input,disclosure} from './fixture';
export const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const palette={ink:'#172B46',blue:'#315BDA',paper:'#F7F5EF',mist:'#E9EDF5',slate:'#596C82',orange:'#A64C21'};
const wrap=(s:string,n:number)=>s.split(' ').reduce<string[]>((a,w)=>{if(!a.length||a.at(-1)!.length+w.length+1>n)a.push(w);else a[a.length-1]+=' '+w;return a;},[]);
const markAt=(mark:string,x:number,y:number,size:number)=>Buffer.from(mark,'base64').toString('utf8').replace('<svg ',`<svg x="${x}" y="${y}" width="${size}" height="${size}" `);
export function svgCard(title:string,index:number,mark:string,width=1920,height=1080,kind='scene') {
 const vertical=height>width,scale=width/1920;
 const relative=['normalize','relative'].includes(kind),W=vertical?1080:1920,H=vertical?1920:1080;
 const chartX=vertical?95:200,chartY=vertical?700:390,chartW=vertical?890:1520,chartH=vertical?600:350;
 const text=(x:number,y:number,t:string,size:number,fill=palette.ink,extra='')=>`<text x="${x}" y="${y}" fill="${fill}" font-family="DejaVu Sans" font-size="${size}" ${extra}>${esc(t)}</text>`;
 const series=(values:number[],color:string,dashed=false)=>{
  const max=relative?1:100,points=values.map((v,i)=>[chartX+i*chartW/4,chartY+chartH-v/max*chartH]);
  return `<polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="9" ${dashed?'stroke-dasharray="18 15"':''}/>`+points.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="11" fill="${color}"/>`+(dashed?'':text(i===4?x:x-10,y-25,String(values[i]).replace('.',','),vertical?33:36,color,i===4?'text-anchor="end"':''))).join('');
 };
 const a=relative?input.seriesA.map(v=>v/input.seriesA[0]):input.seriesA,b=relative?input.seriesB.map(v=>v/input.seriesB[0]):input.seriesB;
 const titleLines=wrap(title,vertical?23:48);
 const body=`<rect width="${W}" height="${H}" fill="${palette.paper}"/><rect width="${W}" height="14" fill="${palette.blue}"/>
 ${markAt(mark,vertical?65:85,48,64)}
 ${text(vertical?150:172,88,'dobrov.',43,palette.ink,'font-weight="700"')}${text(vertical?150:172,119,'ACADEMY',19,palette.slate,'letter-spacing="5"')}
 <rect x="${vertical?65:1280}" y="58" width="${vertical?950:550}" height="55" rx="12" fill="${palette.ink}" ${vertical?'transform="translate(0,115)"':''}/>
 ${text(vertical?95:1310,vertical?209:94,'DEMO SINTÉTICA · NO PUBLICAR',vertical?32:26,palette.paper)}
 ${titleLines.map((l,i)=>text(vertical?65:95,(vertical?360:240)+i*(vertical?86:80),l,vertical?68:70,palette.ink,'font-weight="700"')).join('')}
 ${text(chartX,chartY-65,relative?'ESCALA RELATIVA · valor / valor inicial':'ESCALA ABSOLUTA · unidades inventadas',vertical?29:30,palette.slate)}
 ${[0,.25,.5,.75,1].map(t=>`<path d="M ${chartX} ${chartY+chartH*t} H ${chartX+chartW}" stroke="${palette.mist}" stroke-width="3"/>`).join('')}
 <path d="M ${chartX} ${chartY-10} V ${chartY+chartH} H ${chartX+chartW+10}" fill="none" stroke="${palette.slate}" stroke-width="3"/>
 ${series(a,palette.blue)}${series(b,palette.orange,relative)}
 ${[0,1,2,3,4].map((v,i)=>text(chartX+i*chartW/4-8,chartY+chartH+55,String(v),32,palette.slate)).join('')}
 ${text(chartX+chartW-140,chartY+chartH+100,'PASO',26,palette.slate)}
 ${text(chartX,chartY+chartH+115,'● Serie A',34,palette.blue)}${text(chartX+(vertical?300:360),chartY+chartH+115,'● Serie B',34,palette.orange)}
 ${text(vertical?65:95,vertical?1760:1010,'Fuente: fixture matemático DEMO-001 · datos inventados',vertical?28:26,palette.slate)}
 ${text(vertical?65:95,vertical?1810:1050,'Sin experimento, paper ni verificación científica independiente.',vertical?25:24,palette.slate)}
 ${text(vertical?900:1780,vertical?1820:1030,String(index+1).padStart(2,'0'),30,palette.blue)}
 `;
 return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${W} ${H}" role="img"><title>${esc(disclosure+' — '+title)}</title>${body}</svg>`;
}
export function socialCard(width:number,height:number,mark:string,label:string) {
 const title=wrap('La misma curva. Otra historia.',width/height>1.4?28:18),font=Math.round(width/17);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${palette.ink}"/><path d="M0 ${height*.72} Q${width*.25} ${height*.95} ${width*.5} ${height*.65} T${width} ${height*.55}" stroke="${palette.blue}" stroke-width="${width*.07}" fill="none"/>${markAt(mark,width*.07,height*.07,width*.08)}<text x="${width*.18}" y="${height*.15}" font-family="DejaVu Sans" font-size="${width*.04}" fill="${palette.paper}">dobrov. ACADEMY</text>${title.map((s,i)=>`<text x="${width*.07}" y="${height*.36+i*font*1.25}" font-family="DejaVu Sans" font-weight="700" font-size="${font}" fill="${palette.paper}">${esc(s)}</text>`).join('')}<text x="${width*.07}" y="${height*.78}" font-family="DejaVu Sans" font-size="${width*.027}" fill="#B5C8FF">DEMO SINTÉTICA · DATOS INVENTADOS</text><text x="${width*.07}" y="${height*.87}" font-family="DejaVu Sans" font-size="${width*.022}" fill="${palette.paper}">NO PUBLICAR · ${esc(label)}</text></svg>`;
}
