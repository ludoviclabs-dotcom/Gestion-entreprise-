export type DifficultyKey = "junior" | "senior" | "expert";

export type EntityType = "company" | "person" | "account";

export type FraudPatternType =
  | "cycle"
  | "director"
  | "offshore"
  | "address"
  | "alias"
  | "nominee"
  | "batch_creation";

export type EdgeType = "owns" | "directs" | "shares_account" | "same_address";

export type FraudNode = {
  id: string;
  type: EntityType;
  name: string;
  country: string;
  sector?: string;
  revenue?: number;
  declaredRevenue?: number;
  address?: string;
  incorp?: number;
  personId?: string;
  birth?: number;
  bank?: string;
  iban?: string;
  fraudPatterns: string[];
  aliasOf?: string | null;
  decoy?: boolean;
  notes?: string[];
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
};

export type FraudEdge = {
  id: string;
  source: string | FraudNode;
  target: string | FraudNode;
  type: EdgeType;
  percent?: number | null;
  fraudPatterns: string[];
  decoy?: boolean;
};

export type FraudPattern = {
  id: string;
  type: FraudPatternType;
  label: string;
  explanation: string;
  items: string[];
  replayPath: string[];
};

export type DifficultyConfig = {
  label: string;
  nodes: [number, number];
  patterns: number;
  time: number;
  decoys: boolean;
  desc: string;
  capacity?: number;
};

export type FraudCase = {
  nodes: FraudNode[];
  edges: FraudEdge[];
  patterns: FraudPattern[];
  caseId: string;
};

export type VerdictKind = "validé" | "temps écoulé" | "incomplet";

export type VerdictResult = {
  correct: number;
  wrong: number;
  solved: Set<string>;
  correctIds: Set<string>;
  wrongIds: Set<string>;
  score: number;
  victory: boolean;
  verdict: VerdictKind;
  breakdown: {
    base: number;
    speed: number;
    penalty: number;
    combo: number;
  };
};

export type FraudReport = {
  case_id: string;
  timestamp: string;
  difficulty: DifficultyKey;
  score: number;
  flagged_nodes: Array<{
    id: string;
    name: string;
    reason: string;
    correct: boolean;
  }>;
  verdict: VerdictKind;
  time_elapsed: number;
};

export const difficulties: Record<DifficultyKey, DifficultyConfig> = {
  junior: {
    label: "Junior",
    nodes: [8, 12],
    patterns: 1,
    time: 90,
    decoys: false,
    desc: "8-12 noeuds · 1 fraude · 90 s",
  },
  senior: {
    label: "Senior",
    nodes: [15, 25],
    patterns: 2,
    time: 60,
    decoys: false,
    desc: "15-25 noeuds · 2 fraudes · 60 s",
  },
  expert: {
    label: "Expert",
    nodes: [30, 50],
    patterns: 3,
    time: 45,
    decoys: true,
    desc: "30-50 noeuds · 3 fraudes · capacité limitée",
    capacity: 20,
  },
};

const countries = [
  "France",
  "Allemagne",
  "Italie",
  "Espagne",
  "Pays-Bas",
  "Belgique",
  "Suisse",
  "Royaume-Uni",
  "Irlande",
  "Luxembourg",
  "Chypre",
  "Malte",
  "Estonie",
  "Pologne",
  "Portugal",
  "Autriche",
];

const offshore = [
  "Îles Caïmans",
  "Îles Vierges britanniques",
  "Panama",
  "Seychelles",
  "Belize",
  "Bermudes",
  "Jersey",
  "Guernesey",
];

const sectors = [
  "Énergie",
  "Pharma",
  "Télécoms",
  "Transport",
  "Immobilier",
  "Fintech",
  "Agroalimentaire",
  "Défense",
  "Médias",
  "Construction",
  "Négoce",
  "Logiciel",
];

const streets = [
  "Rue du Port",
  "Avenue Atlas",
  "Quai Mercure",
  "Boulevard Nova",
  "Place Orion",
  "Victoria Road",
  "Harbour Street",
  "Kingfisher Lane",
  "Rue des Docks",
  "Station Road",
];

const corpA = [
  "Aster",
  "Northbridge",
  "Helio",
  "Maris",
  "Quant",
  "Orion",
  "Baltic",
  "Cobalt",
  "Nexa",
  "Vega",
  "Atlas",
  "Novum",
  "Meridian",
  "Solstice",
  "Crescent",
  "Vertex",
  "Axion",
  "Silex",
  "Arden",
  "Kestrel",
];

const corpB = [
  "Holdings",
  "Trading",
  "Industries",
  "Capital",
  "Logistics",
  "Systems",
  "Labs",
  "Foods",
  "Energy",
  "Media",
  "Works",
  "Partners",
  "Group",
  "Invest",
  "Networks",
  "Pharma",
];

const first = [
  "Alexandre",
  "Sofia",
  "Milan",
  "Nadia",
  "Victor",
  "Elena",
  "Karim",
  "Laura",
  "Mateo",
  "Inès",
  "David",
  "Maya",
  "Oscar",
  "Clara",
  "Noah",
  "Lina",
  "Hugo",
  "Sara",
  "Romain",
  "Eva",
];

const last = [
  "Moreau",
  "Rossi",
  "Schmidt",
  "Dubois",
  "Klein",
  "Bernard",
  "Novak",
  "Leroy",
  "Costa",
  "Martin",
  "Fischer",
  "Diaz",
  "Petrov",
  "Silva",
  "Jansen",
  "Weber",
  "Lambert",
  "Nolan",
];

const patternPool: FraudPatternType[] = [
  "cycle",
  "director",
  "offshore",
  "address",
  "alias",
  "nominee",
  "batch_creation",
];

const rand = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]!;
const shuffle = <T,>(arr: T[]) =>
  arr
    .map((value) => [Math.random(), value] as const)
    .sort((a, b) => a[0] - b[0])
    .map((entry) => entry[1]);

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function formatMoney(value?: number) {
  if (value === undefined) return "—";
  if (value === 0) return "0 €";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function newId(prefix: string, arr: unknown[]) {
  return `${prefix}-${String(arr.length + 1).padStart(3, "0")}`;
}

function company(nodes: FraudNode[], opt: Partial<FraudNode> = {}) {
  const sector = opt.sector || pick(sectors);
  const country = opt.country || pick(countries);
  const node: FraudNode = {
    id: newId("CO", nodes),
    type: "company",
    name: opt.name || `${pick(corpA)} ${pick(corpB)}`,
    country,
    sector,
    revenue: opt.revenue ?? rand(2, 480) * 1_000_000,
    address: opt.address || `${rand(1, 199)} ${pick(streets)}, ${country}`,
    incorp: opt.incorp ?? 2026 - rand(1, 18),
    fraudPatterns: [],
    decoy: !!opt.decoy,
    notes: [],
  };
  nodes.push(node);
  return node;
}

function person(nodes: FraudNode[], opt: Partial<FraudNode> = {}) {
  const given = opt.name ? opt.name.split(" ")[0] : opt.name;
  const family = opt.name ? opt.name.split(" ").slice(1).join(" ") : opt.name;
  const f = given || pick(first);
  const l = family || pick(last);
  const node: FraudNode = {
    id: newId("PE", nodes),
    type: "person",
    name: opt.name || `${f} ${l}`,
    country: opt.country || pick(countries),
    sector: "—",
    personId: opt.personId || `PID-${rand(100000, 999999)}-${pick("ABCDEFGH".split(""))}`,
    address: opt.address || `${rand(1, 199)} ${pick(streets)}, ${pick(countries)}`,
    birth: opt.birth ?? rand(1962, 1994),
    declaredRevenue: opt.declaredRevenue ?? rand(0, 180) * 1_000,
    fraudPatterns: [],
    aliasOf: opt.aliasOf || null,
    decoy: !!opt.decoy,
    notes: [],
  };
  nodes.push(node);
  return node;
}

function account(nodes: FraudNode[], opt: Partial<FraudNode> = {}) {
  const node: FraudNode = {
    id: newId("BA", nodes),
    type: "account",
    name: opt.name || `Compte ${pick(["IBAN", "Treasury", "Settlement", "Escrow"])} ${rand(100, 999)}`,
    country: opt.country || pick(countries),
    bank: opt.bank || pick(["EuroClear Bank", "Baltic Trust", "Helvetia Bank", "Mercury Finance", "Atlantic Bank", "Crown Bank"]),
    iban: opt.iban || `${pick(["FR", "DE", "IT", "NL", "BE", "CH", "GB", "IE"])}${rand(10, 99)} ${rand(1000, 9999)} ${rand(1000, 9999)} ${rand(1000, 9999)}`,
    fraudPatterns: [],
    decoy: !!opt.decoy,
    notes: [],
  };
  nodes.push(node);
  return node;
}

function edge(
  edges: FraudEdge[],
  source: FraudNode,
  target: FraudNode,
  type: EdgeType,
  opt: Partial<FraudEdge> = {},
) {
  const created: FraudEdge = {
    id: `E-${String(edges.length + 1).padStart(3, "0")}`,
    source: source.id,
    target: target.id,
    type,
    percent: opt.percent ?? null,
    fraudPatterns: [],
    decoy: !!opt.decoy,
  };
  edges.push(created);
  return created;
}

function mark(pattern: FraudPattern, items: Array<FraudNode | FraudEdge>, replayPath?: string[]) {
  items.forEach((item) => item.fraudPatterns.push(pattern.id));
  pattern.items = items.map((item) => item.id);
  pattern.replayPath = replayPath || pattern.items;
}

function addPattern(
  patterns: FraudPattern[],
  type: FraudPatternType,
  label: string,
  explanation: string,
  generator: (pattern: FraudPattern) => void,
) {
  const pattern: FraudPattern = {
    id: `P${patterns.length + 1}`,
    type,
    label,
    explanation,
    items: [],
    replayPath: [],
  };
  patterns.push(pattern);
  generator(pattern);
}

export function nodeIdOf(value: string | FraudNode) {
  return typeof value === "string" ? value : value.id;
}

export function endpoints(edgeValue: FraudEdge, nodes: FraudNode[]) {
  return [
    nodes.find((node) => node.id === nodeIdOf(edgeValue.source)),
    nodes.find((node) => node.id === nodeIdOf(edgeValue.target)),
  ] as const;
}

export function edgeLabel(edgeValue: FraudEdge) {
  if (edgeValue.type === "owns") return `détient ${edgeValue.percent || ""}%`;
  if (edgeValue.type === "directs") return "dirige";
  if (edgeValue.type === "shares_account") return "compte commun";
  return "même adresse";
}

export function generateCase(
  difficulty: DifficultyKey,
  options: { forcedPatternTypes?: FraudPatternType[]; nowYear?: number } = {},
): FraudCase {
  const config = difficulties[difficulty];
  const target = rand(config.nodes[0], config.nodes[1]);
  const nodes: FraudNode[] = [];
  const edges: FraudEdge[] = [];
  const patterns: FraudPattern[] = [];
  const nowYear = options.nowYear ?? 2026;
  const selectedPatterns =
    options.forcedPatternTypes ?? shuffle(patternPool).slice(0, config.patterns);

  selectedPatterns.slice(0, config.patterns).forEach((type) => {
    if (type === "cycle") {
      addPattern(
        patterns,
        type,
        "Boucle d'actionnariat circulaire",
        "Une boucle A → B → C → A masque le bénéficiaire final et peut être utilisée pour gonfler artificiellement le contrôle économique.",
        (pattern) => {
          const a = company(nodes);
          const b = company(nodes);
          const c = company(nodes);
          const e1 = edge(edges, a, b, "owns", { percent: rand(28, 49) });
          const e2 = edge(edges, b, c, "owns", { percent: rand(30, 55) });
          const e3 = edge(edges, c, a, "owns", { percent: rand(22, 44) });
          mark(pattern, [a, b, c, e1, e2, e3], [a.id, e1.id, b.id, e2.id, c.id, e3.id, a.id]);
        },
      );
    }

    if (type === "director") {
      addPattern(
        patterns,
        type,
        "Administrateur commun concurrentiel",
        "Le même individu dirige au moins trois sociétés non liées dans le même secteur concurrentiel : signal de prête-nom ou de coordination illicite.",
        (pattern) => {
          const sector = pick(sectors);
          const director = person(nodes);
          const companies = [
            company(nodes, { sector, country: pick(countries) }),
            company(nodes, { sector, country: pick(countries) }),
            company(nodes, { sector, country: pick(countries) }),
          ];
          const rels = companies.map((item) => edge(edges, director, item, "directs"));
          mark(pattern, [director, ...companies, ...rels], [
            director.id,
            rels[0]!.id,
            companies[0]!.id,
            rels[1]!.id,
            companies[1]!.id,
            rels[2]!.id,
            companies[2]!.id,
          ]);
        },
      );
    }

    if (type === "offshore") {
      addPattern(
        patterns,
        type,
        "Holding offshore sans revenus",
        "Une holding offshore déclarant 0 € de revenus détient des sociétés opérationnelles : incohérence économique et risque d'opacité de propriété.",
        (pattern) => {
          const hold = company(nodes, {
            country: pick(offshore),
            sector: "Holding",
            revenue: 0,
            name: `${pick(corpA)} Offshore Holdings`,
          });
          const c1 = company(nodes, {
            sector: pick(sectors),
            country: pick(countries),
            revenue: rand(80, 600) * 1_000_000,
          });
          const c2 = company(nodes, {
            sector: pick(sectors),
            country: pick(countries),
            revenue: rand(50, 450) * 1_000_000,
          });
          const e1 = edge(edges, hold, c1, "owns", { percent: rand(51, 95) });
          const e2 = edge(edges, hold, c2, "owns", { percent: rand(35, 88) });
          mark(pattern, [hold, e1, e2], [hold.id, e1.id, c1.id, hold.id, e2.id, c2.id]);
        },
      );
    }

    if (type === "address") {
      addPattern(
        patterns,
        type,
        "Adresse partagée transfrontalière",
        "Deux entités de pays différents déclarent exactement la même adresse enregistrée : anomalie KYC forte, souvent liée à des sociétés-écrans.",
        (pattern) => {
          const address = `42 ${pick(streets)}, ${pick(["Londres", "Amsterdam", "Paris", "Dublin"])}`;
          const a = company(nodes, { country: pick(countries), address });
          let country = pick(countries);
          while (country === a.country) country = pick(countries);
          const b = company(nodes, { country, address });
          const rel = edge(edges, a, b, "same_address");
          mark(pattern, [a, b, rel], [a.id, rel.id, b.id]);
        },
      );
    }

    if (type === "alias") {
      addPattern(
        patterns,
        type,
        "Bénéficiaire effectif sous alias",
        "Deux fiches personne ont des noms quasi identiques mais des identifiants différents : risque d'alias pour contourner les contrôles de bénéficiaire effectif.",
        (pattern) => {
          const f = pick(first);
          const l = pick(last);
          const p1 = person(nodes, { name: `${f} ${l}` });
          const aliasName = Math.random() > 0.5 ? `${f[0]}. ${l}` : `${f} ${l.replace(/[aeiou]/i, "")}`;
          const p2 = person(nodes, { name: aliasName, aliasOf: p1.id });
          const c1 = company(nodes);
          const c2 = company(nodes);
          const e1 = edge(edges, p1, c1, "owns", { percent: rand(22, 48) });
          const e2 = edge(edges, p2, c2, "owns", { percent: rand(25, 49) });
          mark(pattern, [p1, p2, e1, e2], [p1.id, e1.id, c1.id, p2.id, e2.id, c2.id]);
        },
      );
    }

    if (type === "nominee") {
      addPattern(
        patterns,
        type,
        "Prête-nom",
        "Un individu déclarant moins de 5 000 € de revenus détient 100 % d'une société réalisant plus de 1 M€ : disproportion économique forte et risque de prête-nom.",
        (pattern) => {
          const owner = person(nodes, {
            country: "France",
            declaredRevenue: rand(0, 4_500),
          });
          const nomineeCompany = company(nodes, {
            country: pick(["Luxembourg", "Malte", "Chypre", "Irlande"]),
            revenue: rand(2, 12) * 1_000_000,
            incorp: nowYear - rand(0, 2),
          });
          const rel = edge(edges, owner, nomineeCompany, "owns", { percent: 100 });
          owner.notes?.push("revenus personnels déclarés très faibles");
          mark(pattern, [owner, nomineeCompany, rel], [owner.id, rel.id, nomineeCompany.id]);
        },
      );
    }

    if (type === "batch_creation") {
      addPattern(
        patterns,
        type,
        "Création groupée",
        "Trois sociétés ou plus partagent exactement la même date de création et le même dirigeant : signal de montage groupé ou de réseau de sociétés-écrans.",
        (pattern) => {
          const director = person(nodes);
          const incorp = nowYear - rand(0, 4);
          const sector = pick(sectors);
          const companies = [
            company(nodes, { incorp, sector, country: "France" }),
            company(nodes, { incorp, sector, country: "Belgique" }),
            company(nodes, { incorp, sector, country: "Luxembourg" }),
          ];
          const rels = companies.map((item) => edge(edges, director, item, "directs"));
          mark(pattern, [director, ...companies, ...rels], [
            director.id,
            rels[0]!.id,
            companies[0]!.id,
            rels[1]!.id,
            companies[1]!.id,
            rels[2]!.id,
            companies[2]!.id,
          ]);
        },
      );
    }
  });

  while (nodes.length < target) {
    const roll = Math.random();
    if (roll < 0.58) company(nodes);
    else if (roll < 0.84) person(nodes);
    else account(nodes);
  }

  const companies = nodes.filter((node) => node.type === "company");
  const people = nodes.filter((node) => node.type === "person");
  const accounts = nodes.filter((node) => node.type === "account");
  const neededEdges = Math.max(target + rand(2, 8), edges.length);
  let guard = 0;
  while (edges.length < neededEdges && guard++ < 500) {
    const roll = Math.random();
    if (roll < 0.48 && companies.length > 1) {
      const a = pick(companies);
      const b = pick(companies);
      if (a !== b && !edges.some((item) => nodeIdOf(item.source) === a.id && nodeIdOf(item.target) === b.id)) {
        edge(edges, a, b, "owns", { percent: rand(5, 49) });
      }
    } else if (roll < 0.78 && people.length && companies.length) {
      edge(edges, pick(people), pick(companies), "directs");
    } else if (accounts.length && companies.length) {
      edge(edges, pick(companies), pick(accounts), "shares_account");
    }
  }

  if (config.decoys) {
    for (let i = 0; i < Math.min(4, Math.floor(target / 10)); i += 1) {
      const f = pick(first);
      const l = pick(last);
      person(nodes, { name: `${f} ${l}`, decoy: true });
      person(nodes, { name: `${f[0]}. ${l}`, decoy: true });
    }
    if (nodes.length > target) nodes.splice(target);
  }

  nodes.forEach((node) => {
    if (node.type === "company") {
      if (node.revenue === 0) node.notes?.push("revenus déclarés nuls");
      if (offshore.includes(node.country)) node.notes?.push("juridiction à opacité élevée");
    }
  });

  return {
    nodes,
    edges,
    patterns,
    caseId: `CASE-${new Date().getFullYear()}-${rand(1000, 9999)}`,
  };
}

export function elementById(gameCase: FraudCase, id: string) {
  return gameCase.nodes.find((node) => node.id === id) || gameCase.edges.find((edgeValue) => edgeValue.id === id);
}

export function computeRiskScore(node: FraudNode, gameCase: FraudCase, nowYear = 2026) {
  const directEdges = gameCase.edges.filter(
    (edgeValue) => nodeIdOf(edgeValue.source) === node.id || nodeIdOf(edgeValue.target) === node.id,
  );
  const directNodeIds = directEdges.map((edgeValue) =>
    nodeIdOf(edgeValue.source) === node.id ? nodeIdOf(edgeValue.target) : nodeIdOf(edgeValue.source),
  );
  const directNodes = directNodeIds
    .map((id) => gameCase.nodes.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is FraudNode => Boolean(candidate));
  const connectedCountries = new Set([node.country, ...directNodes.map((candidate) => candidate.country)]);

  let score = Math.min(32, directEdges.length * 8);
  if (connectedCountries.size >= 3) score += 22;
  else if (connectedCountries.size === 2) score += 14;

  if (node.type === "company") {
    const ownsOperatingCompanies = directEdges.some(
      (edgeValue) =>
        edgeValue.type === "owns" &&
        nodeIdOf(edgeValue.source) === node.id &&
        (gameCase.nodes.find((candidate) => candidate.id === nodeIdOf(edgeValue.target))?.revenue || 0) > 1_000_000,
    );
    const sameDirectorSameDate = gameCase.edges.some((edgeValue) => {
      if (edgeValue.type !== "directs" || nodeIdOf(edgeValue.target) !== node.id) return false;
      const directorId = nodeIdOf(edgeValue.source);
      const peerCount = gameCase.edges.filter((candidate) => {
        const peer = gameCase.nodes.find((item) => item.id === nodeIdOf(candidate.target));
        return (
          candidate.type === "directs" &&
          nodeIdOf(candidate.source) === directorId &&
          peer?.type === "company" &&
          peer.incorp === node.incorp
        );
      }).length;
      return peerCount >= 3;
    });
    if (node.revenue === 0 && ownsOperatingCompanies) score += 35;
    if ((node.revenue || 0) > 1_000_000_000) score += 18;
    if (offshore.includes(node.country)) score += 18;
    if ((node.incorp || 0) >= nowYear - 2) score += 18;
    if (sameDirectorSameDate) score += 22;
  }

  if (node.type === "person") {
    const nomineeOwnership = directEdges.some((edgeValue) => {
      if (edgeValue.type !== "owns" || nodeIdOf(edgeValue.source) !== node.id || edgeValue.percent !== 100) return false;
      const target = gameCase.nodes.find((candidate) => candidate.id === nodeIdOf(edgeValue.target));
      return target?.type === "company" && (target.revenue || 0) > 1_000_000 && (node.declaredRevenue || 0) < 5_000;
    });
    const directedCompanies = directEdges.filter(
      (edgeValue) => edgeValue.type === "directs" && nodeIdOf(edgeValue.source) === node.id,
    );
    const creationDates = new Map<number, number>();
    directedCompanies.forEach((edgeValue) => {
      const target = gameCase.nodes.find((candidate) => candidate.id === nodeIdOf(edgeValue.target));
      if (target?.incorp) creationDates.set(target.incorp, (creationDates.get(target.incorp) || 0) + 1);
    });
    if (nomineeOwnership) score += 50;
    if ([...creationDates.values()].some((count) => count >= 3)) score += 34;
    if (node.aliasOf) score += 25;
  }

  return clamp(score, 0, 100);
}

export function riskTone(score: number) {
  if (score < 30) return "green";
  if (score <= 60) return "yellow";
  return "red";
}

export function canInspectNode(difficulty: DifficultyKey, used: number) {
  const capacity = difficulties[difficulty].capacity;
  return capacity === undefined || used < capacity;
}

export function evaluateVerdict(
  gameCase: FraudCase,
  flaggedIds: Iterable<string>,
  difficulty: DifficultyKey,
  timeLeft: number,
  timeout = false,
) {
  let correct = 0;
  let wrong = 0;
  const solved = new Set<string>();
  const correctIds = new Set<string>();
  const wrongIds = new Set<string>();

  for (const id of flaggedIds) {
    const item = elementById(gameCase, id);
    if (item && item.fraudPatterns.length) {
      correct += 1;
      correctIds.add(id);
      item.fraudPatterns.forEach((patternId) => solved.add(patternId));
    } else {
      wrong += 1;
      wrongIds.add(id);
    }
  }

  const base = correct * 1000;
  const speed = timeLeft * 10;
  const penalty = wrong * 200;
  const combo = solved.size === gameCase.patterns.length && wrong === 0 ? Math.round((base + speed) * 0.5) : 0;
  const score = Math.max(0, base + speed + combo - penalty);
  const victory = solved.size === gameCase.patterns.length && !timeout;
  const verdict: VerdictKind = victory ? "validé" : timeout ? "temps écoulé" : "incomplet";

  void difficulty;

  return {
    correct,
    wrong,
    solved,
    correctIds,
    wrongIds,
    score,
    victory,
    verdict,
    breakdown: { base, speed, penalty, combo },
  } satisfies VerdictResult;
}

export function createFraudReport({
  gameCase,
  difficulty,
  score,
  flaggedIds,
  verdict,
  totalTime,
  timeLeft,
  timestamp = new Date().toISOString(),
}: {
  gameCase: FraudCase;
  difficulty: DifficultyKey;
  score: number;
  flaggedIds: Iterable<string>;
  verdict: VerdictKind;
  totalTime: number;
  timeLeft: number;
  timestamp?: string;
}) {
  const flags = [...flaggedIds];
  return {
    case_id: gameCase.caseId,
    timestamp,
    difficulty,
    score,
    flagged_nodes: flags.map((id) => {
      const item = elementById(gameCase, id);
      const correct = Boolean(item?.fraudPatterns.length);
      const patternLabels =
        item?.fraudPatterns
          .map((patternId) => gameCase.patterns.find((pattern) => pattern.id === patternId)?.label)
          .filter(Boolean)
          .join(", ") || "Signalement non corroboré";
      return {
        id,
        name: item && "source" in item ? `Lien ${id} · ${edgeLabel(item)}` : item?.name || id,
        reason: patternLabels,
        correct,
      };
    }),
    verdict,
    time_elapsed: Math.max(0, totalTime - timeLeft),
  } satisfies FraudReport;
}
