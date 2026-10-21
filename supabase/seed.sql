insert into academy.domain_packs(id,version,config) values
('ai','0.1.0','{"weeklyShare":0.7,"risk":"standard","evidenceLevels":["A0","A1","A2","A3","A-"]}'),
('physics','0.1.0','{"weeklyShare":0.3,"risk":"standard","evidenceLevels":["P0","P1","P2","P3","P-"]}')
on conflict(id) do nothing;
insert into academy.concepts(qid,term_en,term_es,wikipedia_en,wikipedia_es) values
('Q11660','artificial intelligence','inteligencia artificial','https://en.wikipedia.org/wiki/Artificial_intelligence','https://es.wikipedia.org/wiki/Inteligencia_artificial'),
('Q413','physics','física','https://en.wikipedia.org/wiki/Physics','https://es.wikipedia.org/wiki/F%C3%ADsica')
on conflict(qid) do nothing;
