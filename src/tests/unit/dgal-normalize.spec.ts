import { describe, it, expect } from 'vitest';
import { dgalAttributes, normalizeDgal } from '@/lib/ingestion/normalize-dgal';
import type { DgalRaw } from '@/lib/ingestion/dgal-data';
import type { CaseBundle } from '@/lib/graph/graph-types';
import { isInformationalEvent } from '@/lib/graph/informational-events';
import { buildGraph } from '@/lib/graph/build-graph';
import { computeRisk, explainQualitePreuve, SCORE_MODEL_VERSION } from '@/lib/risk/engine';
import { computeGraphMetrics } from '@/lib/graph/algorithms';
import { GraphologyQueryRepository } from '@/lib/data/graph-query-repository';
import { inferEventSource } from '@/lib/data/case-quality';
const data:DgalRaw={status:'ok',siren:'356000000',importedAt:'2026-10-12T12:00:00Z',observedAt:'2026-10-13T12:00:00Z',totalSites:1,totalApprovals:1,bySection:[{section:'IX',count:1}],items:[{siret:'35600000000002',approval:'01.001.001',exportedOn:'2026-10-12',activities:[{section:'IX',categories:['PP'],associated:['0(CS)']}]}]};
describe('DGAL — observations neutres et scores inchangés',()=>{
  it('établissement/activité propres, date d’observation explicite et couverture sans non-agrément/radiation déduite',()=>{
    const attr=dgalAttributes(data)['Agréments sanitaires CE (DGAL)']; expect(attr).toContain('Établissements agréés listés au 2026-10-13'); expect(attr).toContain('SIRET 35600000000002'); expect(attr).toContain('export du 2026-10-12');expect(attr).toContain('L’absence ne vaut pas non-agrément');
    const e=normalizeDgal(data,'co:356000000')[0];expect(e.occurredOn).toBe('2026-10-13');expect(e.kind).toBe('agrement_sanitaire_liste');expect(inferEventSource(e)).toBe('dgal');expect(isInformationalEvent(e)).toBe(true);expect(e.title).toContain('listé');expect(JSON.stringify({attr,e})).not.toMatch(/PRIVATE_|fraude|sanction|infraction/i);
  });
  it('schéma corrompu, homonyme ou champs privés/codes arbitraires : aucun fait utilisable',()=>{
    for(const raw of [null,[],{}, {...data,siren:'356000001'}, {...data,items:[{...data.items[0],siret:'55208131700001'}]}, {...data,items:[{...data.items[0],approval:'PRIVATE_PERSON_MARKER'}]}, {...data,items:[{...data.items[0],activities:[{section:'IX',categories:['PRIVATE_PERSON_MARKER'],associated:[]}]}]}, {...data,observedAt:'invalid'}]){expect(dgalAttributes(raw)).toEqual({});expect(normalizeDgal(raw,'x')).toEqual([]);}
    const extra={...data,person:'PRIVATE_PERSON_MARKER',items:data.items.map(i=>({...i,name:'PRIVATE_PERSON_MARKER'}))};expect(JSON.stringify(dgalAttributes(extra))).not.toContain('PRIVATE_');
  });
  it('préserve trois scores, signaux, règles, preuve et métriques avec des événements DGAL',async()=>{
    const baseline:CaseBundle={case:{id:'x',title:'SOCIETE TEMOIN',rootSiren:'356000000'},entities:[{id:'co:356000000',type:'company',label:'SOCIETE TEMOIN',evidenceLevel:'confirmed'},{id:'co:y',type:'company',label:'AUTRE SOCIETE',evidenceLevel:'inferred'}],edges:[{id:'edge',source:'co:356000000',target:'co:y',type:'DETIENT',evidenceLevel:'inferred'}],events:[{id:'old',entityId:'co:356000000',kind:'modification',title:'Annonce',evidenceLevel:'confirmed',source:'BODACC'}],riskSignals:[]};
    const enriched={...baseline,events:[...baseline.events,...normalizeDgal(data,'co:356000000')]},graph=buildGraph(enriched),before=graph.export();
    expect(computeRisk(enriched,graph)).toEqual(computeRisk(baseline,buildGraph(baseline)));expect(explainQualitePreuve(enriched)).toEqual(explainQualitePreuve(baseline));expect(computeGraphMetrics(graph)).toEqual(computeGraphMetrics(buildGraph(baseline)));expect(await new GraphologyQueryRepository().metrics(enriched)).toEqual(await new GraphologyQueryRepository().metrics(baseline));expect(graph.export()).toEqual(before);expect(SCORE_MODEL_VERSION).toBe('kyb-risk-2026.2');
  });
});
