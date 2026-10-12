import { describe, it, expect, afterEach, vi } from 'vitest';
const state=vi.hoisted(()=>({enabled:true,status:'ok',calls:0}));
vi.mock('@/lib/env',async()=>({...await vi.importActual('@/lib/env'),isDgalEnabled:()=>state.enabled}));
const ok=(raw:unknown)=>({raw,endpoint:'db:source',httpStatus:200,isFixture:false});
vi.mock('@/lib/connectors/sirene',()=>({sirene:{getUniteLegale:async()=>ok({uniteLegale:{siren:'356000000',dateCreationUniteLegale:'1991-01-01',periodesUniteLegale:[{denominationUniteLegale:'SOCIETE TEMOIN',categorieJuridiqueUniteLegale:'5599',etatAdministratifUniteLegale:'A'}]}}),getEtablissementSiege:async()=>ok({})}}));
vi.mock('@/lib/connectors/bodacc',()=>({bodacc:{bySiren:async()=>ok({results:[]})}}));
vi.mock('@/lib/connectors/dgal',()=>({dgal:{bySiren:async()=>{
  state.calls++;if(state.status!=='ok'&&state.status!=='absent')return {raw:{status:state.status},endpoint:`db:dgal (${state.status==='non_importe'?'source non importée':'exception'})`,httpStatus:503,isFixture:false};
  return ok({status:'ok',siren:'356000000',importedAt:'2026-10-12T12:00:00Z',observedAt:'2026-10-12T12:00:00Z',totalSites:state.status==='absent'?0:1,totalApprovals:state.status==='absent'?0:1,bySection:[],items:state.status==='absent'?[]:[{siret:'35600000000002',approval:'01.001.001',exportedOn:null,activities:[{section:'0',categories:['CS'],associated:[]}]}]});
}}}));
import { assembleCase } from '@/lib/ingestion/assemble-case';
describe('assemblage DGAL',()=>{
  afterEach(()=>{delete process.env.NEXT_PUBLIC_DEMO_MODE;state.enabled=true;state.status='ok';state.calls=0;});
  it('source/provenance/timings et faits informatifs, aucun changement des trois scores, signaux ou liens',async()=>{
    process.env.NEXT_PUBLIC_DEMO_MODE='false';state.enabled=false;const baseline=await assembleCase('356000000');state.enabled=true;
    for(const status of ['ok','absent','non_importe','indisponible']){state.status=status;const r=await assembleCase('356000000');expect(r.sources.filter(s=>s.source==='dgal')).toHaveLength(1);expect(r.timings.dgal).toBeGreaterThanOrEqual(0);expect(r.bundle.case.scores).toEqual(baseline.bundle.case.scores);expect(r.bundle.riskSignals).toEqual(baseline.bundle.riskSignals);expect(r.bundle.edges).toEqual(baseline.bundle.edges);
      const attr=r.bundle.entities.find(e=>e.id==='co:356000000')?.attributes?.['Agréments sanitaires CE (DGAL)'];if(status==='ok'){expect(attr).toContain('1 établissement(s)');expect(r.bundle.events.some(e=>e.kind==='agrement_sanitaire_liste')).toBe(true);}else if(status==='absent')expect(attr).toContain('Aucun établissement rapproché');else{expect(attr).toBeUndefined();expect(r.bundle.events).toEqual(baseline.bundle.events);}
    }
  });
  it('démo ou drapeau éteint : zéro appel et aucune source inventée',async()=>{
    expect((await assembleCase('356000000')).sources.some(s=>s.source==='dgal')).toBe(false);process.env.NEXT_PUBLIC_DEMO_MODE='false';state.enabled=false;expect((await assembleCase('356000000')).sources.some(s=>s.source==='dgal')).toBe(false);expect(state.calls).toBe(0);
  });
});
