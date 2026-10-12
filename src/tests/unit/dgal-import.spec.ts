import { describe, it, expect, vi } from "vitest";
import { Readable } from "node:stream";
import postgres from "postgres";
import { dgalInput, dgalWriter, downloadDgal, projectDgal, type DgalFileStats } from "../../../scripts/import/dgal";
import { DGAL_SECTIONS, DGAL_BASE, DGAL_APPROVAL } from "@/lib/ingestion/dgal-reference";
import { GROUPS, sourcesFor } from "../../../scripts/import/lib/groups";
const headers = ['SIRET', 'Numéro agrément/Approval number', 'Catégorie/Category', 'Activités associées/Associated activities', 'Raison SOCIALE - Enseigne commerciale/Name', 'Adresse/Adress'];
const row = (values: string[] = []) => ['35600000000002', '01.001.001', 'CS', 'IX(PP)', 'PRIVATE_PERSON_MARKER', 'PRIVATE_ADDRESS_MARKER'].map((v, i) => values[i] ?? v);
const csv = (rows = [row()], cols = headers) => [cols, ...rows].map(r => r.map(v => '"' + v.replaceAll('"', '""') + '"').join(',')).join('\r\n');
const limits = { minRetained: 1, maxFileBytes: 50000, maxTotalBytes: 1000000, maxRows: 100 };
const open = (data = csv()) => async () => ({ stream: Readable.from([Buffer.from(data)]), exportedOn: '2026-10-12' });
async function collect(i: ReturnType<typeof dgalInput>) { const result = []; for await (const r of i.rows) result.push(r); return result; }
const stats = (): DgalFileStats => ({ section: '0', url: DGAL_BASE + DGAL_SECTIONS[0].file, read: 0, usable: 0, missingSiret: 0, invalidSiren: 0, invalidApproval: 0, unknownCodes: 0, bytes: 0, sha256: '', exportedOn: null, seconds: 0 });
describe('DGAL — forme réelle, minimisation, fichiers complets', () => {
  it('élimine les champs privés dès le parseur ; codes fermés et identifiant d’établissement sans nom', async () => {
    const input = dgalInput(open(csv([row(['35600000000002', '01.001.001', 'CS;PRIVATE_PERSON_MARKER', 'IX(PP);RC(PRIVATE_PERSON_MARKER)'])])), limits);
    const rows = await collect(input);
    expect(rows).toHaveLength(18); expect(rows[0]).toMatchObject({ siren: '356000000', siret: '35600000000002', categories: ['CS'], associated: ['IX(PP)'] });
    expect(JSON.stringify(rows)).not.toMatch(/PRIVATE_|Raison|Adresse|Name/);
    expect(input.stats.files.every(s => s.unknownCodes === 2)).toBe(true);
  });
  it('SIREN Luhn uniquement : NIC malformé/La Poste admis ; SIRET absent/invalide compté sans rapprochement nominatif', () => {
    const s = stats(); const project = (id: string) => projectDgal(Object.fromEntries(headers.map((h,i) => [h,row([id])[i]])), '0', null, s);
    expect(project('35600000000002')?.siren).toBe('356000000'); expect(project('40149482840149')?.siren).toBe('401494828');
    for (const id of ['', '00000000000000', '35600000100002', '356000000']) expect(project(id)).toBeNull();
    expect(s).toMatchObject({ read: 6, usable: 2, missingSiret: 1, invalidSiren: 3 });
    for (const id of ['81.004.1269', '171401064', '2A004863', '2A.065.046.', 'FR-974-07-026-CE', '97409018']) expect(DGAL_APPROVAL.test(id)).toBe(true);
    expect(DGAL_APPROVAL.test('PRIVATE_PERSON_MARKER')).toBe(false);
  });
  it('tolère ordre de colonnes et champs additionnels, refuse perte/duplication des colonnes sélectionnées', async () => {
    const cols = [...headers].reverse(); expect(await collect(dgalInput(open(csv([[...row()].reverse()], cols)), limits))).toHaveLength(18);
    for (const cols of [headers.slice(1), [...headers, headers[0]]]) await expect(collect(dgalInput(open(csv([], cols)), limits))).rejects.toThrow();
  });
  it('déduplique dans une section en unionnant les activités, garde les sections et sites distincts', async () => {
    const i = dgalInput(open(csv([row(), row(['35600000000002', '01.001.001', 'RW', 'I(CP)']), row(['35600000000003'])])), limits);
    const rows = await collect(i); expect(rows).toHaveLength(36); expect(i.stats.duplicates).toBe(18);
    expect(rows[0].categories).toEqual(['CS', 'RW']); expect(rows[0].associated).toEqual(['I(CP)', 'IX(PP)']);
  });
  it('refuse un seul fichier vide/tronqué/HTML, encodage incorrect et plafonds, sans empreinte partielle', async () => {
    for (const data of [csv([]), 'HTML', csv().slice(0,-2)]) {
      const i = dgalInput(open(data), limits); await expect(collect(i)).rejects.toThrow(); expect(() => i.fingerprint()).toThrow();
    }
    await expect(collect(dgalInput(async () => ({ stream: Readable.from([Buffer.from([255])]), exportedOn: null }), limits))).rejects.toThrow();
    for (const opts of [{ ...limits, maxFileBytes: 5 }, { ...limits, maxTotalBytes: 5 }, { ...limits, maxRows: 1 }]) await expect(collect(dgalInput(open(), opts))).rejects.toThrow();
    const i = dgalInput(async s => { if (s.code === 'XV') throw Error('PRIVATE_NETWORK_MARKER'); return open()(); }, limits);
    await expect(collect(i)).rejects.toThrow(); expect(() => i.fingerprint()).toThrow();
  });
  it('empreinte reproductible, date export incluse, 95% identifiants et minimum national', async () => {
    const a = dgalInput(open(), limits), b = dgalInput(open(), limits), c = dgalInput(async () => ({ ...await open()(), exportedOn: '2026-10-11' }), limits);
    await collect(a); await collect(b); await collect(c); const sha = a.fingerprint(); expect(sha).toBe(b.fingerprint()); expect(sha).not.toBe(c.fingerprint());
    await expect(collect(dgalInput(open(csv([row(['']), row()])), limits))).rejects.toThrow();
    await expect(collect(dgalInput(open()))).rejects.toThrow();
  });
  it('utilise seulement les 18 URL officielles, sans redirection ni URL du formulaire, 404 annule le snapshot', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('data', { headers: { 'last-modified': 'Mon, 12 Oct 2026 02:20:29 GMT' } }));
    try {
      const r = await downloadDgal(DGAL_SECTIONS[0], AbortSignal.timeout(1000)); r.stream.destroy(); expect(r.exportedOn).toBe('2026-10-12');
      expect(fetchMock).toHaveBeenCalledWith(DGAL_BASE + 'SSA1_ACTIV_GEN.txt', expect.objectContaining({ redirect: 'error' }));
      await expect(downloadDgal({ ...DGAL_SECTIONS[0], file: 'PRIVATE_MARKER' } as never, AbortSignal.timeout(1000))).rejects.toThrow();
      fetchMock.mockResolvedValue(new Response('', { status: 404 })); await expect(downloadDgal(DGAL_SECTIONS[0], AbortSignal.timeout(1000))).rejects.toThrow();
      expect(sourcesFor('dgal')).toEqual(['dgal']); expect(GROUPS.all).toContain('dgal'); expect(GROUPS.daily).not.toContain('dgal');
    } finally { fetchMock.mockRestore(); }
  });
  it('transmet des tableaux au vrai sérialiseur jsonb postgres 3802, jamais du JSON pré-encodé', async () => {
    let values: Record<string, unknown>[] = [];
    const tx = (first: unknown) => { if (Array.isArray(first) && 'raw' in first) return Promise.resolve([]); values = first as typeof values; return 'values'; };
    const rows = await collect(dgalInput(open(), limits)); await dgalWriter.write(tx as never, 'new-import', rows);
    const client = postgres({ host: 'localhost' }), serialize = (client.options.serializers as Record<number, (x: unknown) => string>)[3802];
    for (const r of values) for (const c of ['categories','associated']) expect(Array.isArray(JSON.parse(serialize(r[c])))).toBe(true);
    expect(JSON.stringify(values)).not.toMatch(/PRIVATE_/); await client.end();
  });
});
