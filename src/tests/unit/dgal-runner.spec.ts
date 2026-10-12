import { describe,it,expect,vi,beforeEach } from 'vitest';
import { Readable } from 'node:stream';
const state=vi.hoisted(()=>({transaction:false,downloads:0,fail:false,failed:false}));
vi.mock('../../../scripts/import/lib/postgres-store',()=>({postgresImportStore:()=>({transaction:async(_id:unknown,work:(tx:unknown)=>Promise<unknown>)=>{
  state.transaction=true;try{return await work({write:async()=>{},count:async()=>18,publish:async()=>false});}catch(e){state.failed=true;throw e;}
}})}));
import { importDgal } from '../../../scripts/import/dgal';
beforeEach(()=>{state.transaction=false;state.downloads=0;state.fail=false;state.failed=false;});
describe('DGAL cycle de préparation avant transaction',()=>{
  it('les 18 téléchargements/analyse sont terminés avant le verrou SQL ; vraie empreinte et version',async()=>{
    const header='"SIRET","Numéro agrément/Approval number","Catégorie/Category","Activités associées/Associated activities"\n';
    const text=header+Array.from({length:600},(_,i)=>`"356000000${String(i+1).padStart(5,'0')}","01.001.001","CS",""`).join('\n');
    const mock=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>{expect(state.transaction).toBe(false);state.downloads++;return new Response(Readable.toWeb(Readable.from([Buffer.from(text)])) as never);});
    try{const report=await importDgal({} as never);expect(state.downloads).toBe(18);expect(report.sha256).toMatch(/^[a-f0-9]{64}$/);expect(report.stats.retained).toBe(10800);expect(state.failed).toBe(false);}finally{mock.mockRestore();}
  });
  it('échec réseau amont enregistré comme failed, aucun import partiel ou erreur privée',async()=>{
    const mock=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('PRIVATE_SECRET_MARKER'));
    try{await expect(importDgal({} as never)).rejects.toThrow('IMPORT_FAILED_PREVIOUS_DATA_PRESERVED');expect(state.failed).toBe(true);}finally{mock.mockRestore();}
  });
});
