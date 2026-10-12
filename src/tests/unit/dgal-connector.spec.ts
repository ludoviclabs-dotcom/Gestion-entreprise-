import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { DgalRaw } from '@/lib/ingestion/dgal-data';
const state = vi.hoisted(() => ({ db: null as unknown as PGlite, demo: false, enabled: true, fail: false, calls: 0 }));
vi.mock('@/lib/env', () => ({ isDemoMode: () => state.demo, isDgalEnabled: () => state.enabled }));
vi.mock('@/lib/db/client', () => ({ getDb: () => ({ execute: async (q: SQL) => {
  state.calls++; if (state.fail) throw Error('PRIVATE_SECRET_MARKER'); const query = new PgDialect().sqlToQuery(q); return state.db.query(query.sql, query.params);
} }) }));
import { dgal } from '@/lib/connectors/dgal';
import { dgalAttributes, normalizeDgal } from '@/lib/ingestion/normalize-dgal';
import { isDegradedEndpoint } from '@/lib/connectors/degraded';
beforeAll(async () => { state.db = new PGlite(); await state.db.exec("create type source_kind as enum ('sirene','manual');");
  for (const f of ['0014_open_data_imports.sql', '0023_dgal_approvals.sql', '0023_dgal_approvals.sql']) await state.db.exec(readFileSync('drizzle/'+f,'utf8').replace(/--> statement-breakpoint/g,'')); });
afterAll(async () => { await state.db.close(); });
beforeEach(async () => { state.demo=false; state.enabled=true; state.fail=false; state.calls=0; await state.db.exec('delete from open_data_imports;'); });
async function seed(status='ok', when='2026-10-12T12:00:00Z', size=2) {
  const id=crypto.randomUUID(); await state.db.query("insert into open_data_imports(id,source,version,source_url,status,imported_at,checked_at,started_at,sha256,record_count) values($1,'dgal','dgal-v1-ce','https://source.test',$2,$3,$4,$4,$5,$6)",[id,status,status==='ok'?when:null,when,'a'.repeat(64),size*2]);
  if(status==='ok') for(let i=0;i<size;i++) for(const section of ['0','IX']) await state.db.query("insert into dgal_approvals values($1,'356000000',$2,$3,$4,'[\"CS\"]','[\"I(CP)\"]','2026-10-12')",[id,'356000000'+String(i+2).padStart(5,'0'),`01.001.${String(i+1).padStart(3,'0')}`,section]);
  return id;
}
describe('DGAL — PostgreSQL réel et migrations idempotentes', () => {
  it('enum avant manual, jsonb tableaux contraints, FK cascade', async () => {
    const r=await state.db.query<{enumlabel:string}>("select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='source_kind' order by enumsortorder"); expect(r.rows.map(x=>x.enumlabel)).toEqual(['sirene','dgal','manual']);
    const id=await seed(); await expect(state.db.query("update dgal_approvals set categories='\"PRIVATE_MARKER\"'::jsonb where import_id=$1",[id])).rejects.toThrow();
    await state.db.query('delete from open_data_imports where id=$1',[id]); expect((await state.db.query('select * from dgal_approvals')).rows).toEqual([]);
  });
  it('une requête : totaux exacts, multi-sites/sections sans double compte, 20 détails/événements', async () => {
    await seed('ok',undefined,31); const r=await dgal.bySiren('356000000'), d=r.raw as DgalRaw;
    expect(r.httpStatus).toBe(200); expect(state.calls).toBe(1); expect(d).toMatchObject({totalSites:31,totalApprovals:31}); expect(d.items).toHaveLength(20);
    expect(d.items[0].activities).toHaveLength(2); expect(d.bySection).toEqual([{section:'0',count:31},{section:'IX',count:31}]); expect(normalizeDgal(d,'co:356000000')).toHaveLength(20);
  });
  it('absence, jamais importé et premier échec distincts ; panne sans secret', async () => {
    const missing=await dgal.bySiren('356000000'); expect(missing.endpoint).toContain('(source non importée)'); expect(dgalAttributes(missing.raw)).toEqual({});
    await seed('failed'); expect((await dgal.bySiren('356000000')).endpoint).toContain('(exception)');
    await seed(); const absent=await dgal.bySiren('123456782'); expect(absent.httpStatus).toBe(200); expect(dgalAttributes(absent.raw)['Agréments sanitaires CE (DGAL)']).toContain('L’absence ne vaut pas non-agrément');
    state.fail=true; const failed=await dgal.bySiren('356000000'); expect(isDegradedEndpoint(failed.endpoint)).toBe(true); expect(JSON.stringify(failed)).not.toContain('PRIVATE_');
  });
  it('un échec/rollback garde le dernier succès ; une suppression publiée ne devient pas une radiation', async () => {
    await seed(); await expect(state.db.transaction(async tx=>{await tx.exec('delete from dgal_approvals;');throw Error('INTERRUPTED');})).rejects.toThrow();
    await seed('failed','2026-10-13T12:00:00Z'); expect(((await dgal.bySiren('356000000')).raw as DgalRaw).totalSites).toBe(2);
    const next=await seed('ok','2026-10-14T12:00:00Z',1); await state.db.query('delete from dgal_approvals where import_id <> $1',[next]);
    const d=(await dgal.bySiren('356000000')).raw; expect(normalizeDgal(d,'co:356000000')).toHaveLength(1); expect(dgalAttributes(d)['Agréments sanitaires CE (DGAL)']).toContain('une disparition ne prouve pas une radiation');
  });
  it('démo/désactivé/SIREN invalide : sentinelle sans faux appel db ou https', async () => {
    state.demo=true; expect((await dgal.bySiren('356000000')).endpoint).toBe('fixture:dgal'); state.demo=false;state.enabled=false;expect((await dgal.bySiren('356000000')).isFixture).toBe(true);state.enabled=true;
    for(const s of ['000000000','356000001',"356000000' OR true"]){const r=await dgal.bySiren(s);expect(r.httpStatus).toBe(400);expect(r.endpoint).not.toMatch(/^https:|^db:/);expect(isDegradedEndpoint(r.endpoint)).toBe(true);} expect(state.calls).toBe(0);
  });
});
