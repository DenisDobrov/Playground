/** Original arithmetic illustration: no real measurements, paper or scientific approvals. */
export const disclosure='DEMO SINTÉTICA · NO ES UNA NOTICIA CIENTÍFICA REAL · NO PUBLICAR';
export const input={id:'dobrov-demo-001',version:1,synthetic:true,publicationEnabled:false,source:'urn:dobrov:demo-001:arithmetic:v1',rule:'next = previous / 2',seriesA:[100,50,25,12.5,6.25],seriesB:[40,20,10,5,2.5],
 caveats:['Datos inventados para una demostración matemática; no son mediciones ni resultados de una investigación.','Una curva normalizada oculta la escala absoluta; una coincidencia visual no demuestra igualdad física.','Sin verificación científica independiente, aprobación editorial ni autorización de publicación.']};
export const claims=[
 {id:'d0000000-0000-4000-8000-000000000001',key:'rule',textEn:'In this synthetic fixture each next value is defined as half the previous value.',evidence:'fixture.rule',status:'synthetic_arithmetic_only'},
 {id:'d0000000-0000-4000-8000-000000000002',key:'values',textEn:'Synthetic A is 100, 50, 25, 12.5, 6.25; synthetic B is 40, 20, 10, 5, 2.5.',evidence:'fixture.seriesA, fixture.seriesB',status:'synthetic_arithmetic_only'},
 {id:'d0000000-0000-4000-8000-000000000003',key:'normalization',textEn:'Dividing each synthetic sequence by its initial value makes their relative curves equal despite different absolute values.',evidence:'series[i]/series[0]',status:'synthetic_arithmetic_only'}];
export const c=claims.map(x=>x.id);
export const narration=[
 ['intro','Un gráfico puede parecer convincente. Pero antes de creerlo, necesitamos saber de dónde vienen sus números y qué representan.','¿Qué cuenta una curva?','scientific_diagram',[c[0]]],
 ['disclosure','Esto es una demostración sintética de Dobrov Academy. Los datos son inventados y no presentamos un descubrimiento científico real.','Datos inventados, límites visibles','scientific_caveat',[...c]],
 ['question','Nuestra pregunta es sencilla: ¿dos curvas con la misma forma representan necesariamente la misma cantidad? Vamos a comprobarlo con números.','La misma forma, ¿la misma cantidad?','concept_visualization',[c[2]]],
 ['rule','Definimos una regla matemática: en cada paso, el valor anterior se divide entre dos. Es una elección del ejemplo.','Una regla transparente','scientific_diagram',[c[0]]],
 ['series-a','La serie azul empieza en cien unidades inventadas. Después aparecen cincuenta, veinticinco, doce coma cinco y seis coma veinticinco.','Serie A · escala absoluta','research_evidence',[c[1]]],
 ['series-b','La segunda serie empieza en cuarenta. Aplicamos la misma regla y obtenemos veinte, diez, cinco y dos coma cinco.','Serie B · otro punto de partida','research_evidence',[c[1]]],
 ['compare','Las dos series disminuyen a la mitad en cada paso. Sin embargo, sus cantidades absolutas siguen siendo diferentes durante todo el ejemplo.','Igual regla, distintos valores','scientific_diagram',[c[0],c[1]]],
 ['normalize','Ahora dividimos cada serie por su primer valor. Este cambio permite comparar la evolución relativa, pero elimina la diferencia inicial.','Normalizar cambia la pregunta','concept_visualization',[c[2]]],
 ['relative','En esa escala relativa, las curvas coinciden. La coincidencia procede de la regla que elegimos, no de un experimento independiente.','Curvas relativas coincidentes','scientific_diagram',[c[2]]],
 ['limits','Este ejercicio no demuestra que dos dispositivos sean equivalentes. Tampoco mide eficiencia, precisión ni rendimiento de un sistema físico.','Lo que el ejemplo no demuestra','scientific_caveat',[c[2]]],
 ['sources','Para revisar la explicación, conservamos la tabla original, la regla utilizada y los pasos de cálculo. No inventamos artículos ni citas.','Fuente: fixture matemático local','research_evidence',[c[0],c[1]]],
 ['review','Una comprobación técnica confirma que los archivos y cálculos coinciden. La revisión humana del lenguaje, la voz y las imágenes sigue pendiente.','La revisión humana sigue pendiente','scientific_caveat',[c[0],c[2]]],
 ['takeaway','La próxima vez que veas una curva, pregunta por su origen, sus unidades y su escala. Esa información cambia lo que puedes concluir.','Origen · unidades · escala','concept_visualization',[c[2]]],
 ['outro','Dobrov Academy: ciencia con evidencia. Esta pieza es una prueba privada del proceso de producción, con datos sintéticos y publicación desactivada.','Ciencia con evidencia.','scientific_caveat',[c[0]]]
] as const;
export const articleKeys=['scientific_question','background','methods','results','significance','limitations','remaining_questions','original_sources'] as const;
const texts={es:[
 '¿Qué conserva una gráfica normalizada? Este ejercicio sintético compara dos secuencias inventadas; no presenta una investigación científica.',
 'Las secuencias comparten una regla matemática elegida: dividir el valor anterior entre dos. Las unidades son arbitrarias.',
 'Partimos de 100 y 40. Aplicamos la misma regla durante cuatro pasos y conservamos la tabla completa para comprobar la operación.',
 'A contiene 100, 50, 25, 12.5 y 6.25. B contiene 40, 20, 10, 5 y 2.5. Dividir cada secuencia por su primer valor produce 1, 0.5, 0.25, 0.125 y 0.0625 en ambas.',
 'La coincidencia relativa refleja la construcción del ejemplo. Los valores absolutos siguen siendo diferentes. Cada gráfica debe indicar su escala.',
 'No hay mediciones, dispositivos, ensayo ni paper detrás de estas tablas. No se infieren eficiencia, precisión ni equivalencia física. Comprobar el cálculo no es verificación científica independiente.',
 'Con datos reales, habría que comprobar procedencia, unidades, incertidumbre y método. Este paquete no responde esas preguntas para ningún sistema real.',
 'Fuente reproducible: fixture DEMO-001 v1, urn:dobrov:demo-001:arithmetic:v1. Ilustraciones originales Dobrov Academy; datos sintéticos, sin citas de investigaciones reales.'],en:[
 'What does a normalized chart preserve? This synthetic exercise compares two invented sequences; it does not report scientific research.',
 'Both sequences share a chosen mathematical rule: divide the previous value by two. Units are arbitrary.',
 'We start at 100 and 40, apply the rule for four steps and retain the complete table so the arithmetic can be checked.',
 'A contains 100, 50, 25, 12.5 and 6.25. B contains 40, 20, 10, 5 and 2.5. Dividing each sequence by its first value gives 1, 0.5, 0.25, 0.125 and 0.0625 in both cases.',
 'Matching relative curves follow from the construction of the example. Absolute values remain different. Each chart must state its scale.',
 'These tables describe no measurements, devices, experiment or paper. They establish no efficiency, accuracy or physical equivalence. Arithmetic checking is not independent scientific verification.',
 'For real data, provenance, units, uncertainty and methods require inspection. This package answers none of those questions for any real system.',
 'Reproducible local source: DEMO-001 fixture v1, urn:dobrov:demo-001:arithmetic:v1. Original Dobrov Academy illustrations; synthetic data, no citations to real research.']};
export function articles(){const mapping=[[c[0],c[2]],[c[0]],[c[0],c[1]],[c[1],c[2]],[c[2]],[c[0],c[2]],[c[2]],[c[0],c[1]]];return (['es','en'] as const).map(language=>({title:language==='es'?'Cuando dos curvas cuentan historias distintas':'When matching curves tell different stories',language,aiDisclosure:language==='es'?disclosure+' · Plantilla determinista; sin llamada a modelo.':'SYNTHETIC DEMO · NOT REAL SCIENTIFIC REPORTING · DO NOT PUBLISH · deterministic template; no model call.',sections:articleKeys.map((key,i)=>({key,paragraphs:[{text:texts[language][i],claimIds:mapping[i],caveatIds:['caveat-0','caveat-1','caveat-2']}]})),unsupportedStatements:[]}));}
export const pronunciation={version:'es-demo/2',locale:'es',voice:'es',wordsPerMinute:195,replacements:{'Dobrov Academy':'Dóbrov Académi','DEMO-001':'demostración uno','H264':'hache doscientos sesenta y cuatro','AAC':'a a ce','SVG':'ese uve ge'}};
