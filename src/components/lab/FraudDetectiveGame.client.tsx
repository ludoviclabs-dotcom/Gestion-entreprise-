"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import {
  canInspectNode,
  computeRiskScore,
  createFraudReport,
  difficulties,
  edgeLabel,
  elementById,
  endpoints,
  evaluateVerdict,
  formatMoney,
  generateCase,
  riskTone,
  type DifficultyKey,
  type FraudCase,
  type FraudEdge,
  type FraudNode,
  type VerdictResult,
} from "@/lib/fraud-detective/game";
import styles from "./FraudDetectiveGame.module.css";

type RuntimeGame = FraudCase & {
  diff: DifficultyKey;
  totalTime: number;
  timeLeft: number;
  score: number;
  selected: string | null;
  flags: Set<string>;
  submitted: boolean;
  paused: boolean;
  startedAt: number;
  correctFlags: number;
  falseFlags: number;
  solved: Set<string>;
  inspectionsUsed: number;
  inspectedNodes: Set<string>;
  riskScores: Record<string, number>;
  correctIds: Set<string>;
  wrongIds: Set<string>;
  replayIds: Set<string>;
  replayHotId: string | null;
  replaying: boolean;
  result: VerdictResult | null;
};

type HighScore = {
  score: number;
  diff: string;
  victory: boolean;
  caseId: string;
  time: string;
};

type FlashTone = "good" | "bad" | null;

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

function snapshotGame(game: RuntimeGame): RuntimeGame {
  return {
    ...game,
    flags: new Set(game.flags),
    solved: new Set(game.solved),
    inspectedNodes: new Set(game.inspectedNodes),
    correctIds: new Set(game.correctIds),
    wrongIds: new Set(game.wrongIds),
    replayIds: new Set(game.replayIds),
    riskScores: { ...game.riskScores },
  };
}

function isEdge(item: FraudNode | FraudEdge | undefined): item is FraudEdge {
  return Boolean(item && "source" in item);
}

function shortName(value: string) {
  return value.length > 16 ? `${value.slice(0, 15)}…` : value;
}

function iconFor(node: FraudNode) {
  if (node.type === "company") return "▦";
  if (node.type === "person") return "●";
  return "▣";
}

function colorFor(node: FraudNode) {
  if (node.type === "company") return "#4f98a3";
  if (node.type === "person") return "#b38cff";
  return "#fdab43";
}

function edgeClass(type: FraudEdge["type"]) {
  if (type === "owns") return "owns";
  if (type === "directs") return "directs";
  if (type === "shares_account") return "account";
  return "address";
}

function bgGraph() {
  let seed = 42;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const nodes = Array.from({ length: 34 }, (_, index) => ({
    x: 30 + next() * 1140,
    y: 30 + next() * 740,
    r: 3 + next() * 5,
    t: index % 3,
  }));
  const edges = Array.from({ length: 54 }, () => [
    nodes[Math.floor(next() * nodes.length)]!,
    nodes[Math.floor(next() * nodes.length)]!,
  ]);
  return { nodes, edges };
}

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

export default function FraudDetectiveGame() {
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyKey>("junior");
  const [game, setGame] = useState<RuntimeGame | null>(null);
  const [toast, setToast] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [flash, setFlash] = useState<FlashTone>(null);
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const graphRef = useRef<SVGSVGElement | null>(null);
  const graphPaneRef = useRef<HTMLElement | null>(null);
  const gameRef = useRef<RuntimeGame | null>(null);
  const refreshGraphRef = useRef<() => void>(() => undefined);
  const replayTimersRef = useRef<number[]>([]);
  const audioRef = useRef<AudioContext | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const background = useMemo(() => bgGraph(), []);

  const pushToast = useCallback((message: string) => {
    setToast(message);
    setShowToast(true);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setShowToast(false), 1700);
  }, []);

  const triggerFlash = useCallback((tone: FlashTone) => {
    setFlash(tone);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 360);
  }, []);

  const commit = useCallback((next: RuntimeGame) => {
    gameRef.current = next;
    setGame(snapshotGame(next));
    window.requestAnimationFrame(() => refreshGraphRef.current());
  }, []);

  const mutateGame = useCallback(
    (updater: (current: RuntimeGame) => void) => {
      const current = gameRef.current;
      if (!current) return;
      updater(current);
      commit(current);
    },
    [commit],
  );

  const getAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const audioWindow = window as AudioWindow;
    const AudioCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioCtor) return null;
    audioRef.current = new AudioCtor();
    return audioRef.current;
  }, []);

  const playTone = useCallback(
    (frequency: number, durationMs: number, offsetMs = 0, type: OscillatorType = "sine", endFrequency?: number) => {
      const ctx = getAudio();
      if (!ctx) return;
      void ctx.resume();
      const start = ctx.currentTime + offsetMs / 1000;
      const end = start + durationMs / 1000;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, end);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    },
    [getAudio],
  );

  const sounds = useMemo(
    () => ({
      click: () => playTone(440, 5, 0, "square"),
      flag: () => playTone(600, 80, 0, "sine", 840),
      correct: () => {
        playTone(261.63, 60, 0, "triangle");
        playTone(329.63, 60, 70, "triangle");
        playTone(392, 60, 140, "triangle");
      },
      falsePositive: () => playTone(300, 150, 0, "sawtooth", 150),
      complete: () => {
        playTone(261.63, 75, 0, "triangle");
        playTone(329.63, 75, 90, "triangle");
        playTone(392, 75, 180, "triangle");
        playTone(523.25, 110, 270, "triangle");
      },
    }),
    [playTone],
  );

  const clearReplayTimers = useCallback(() => {
    replayTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    replayTimersRef.current = [];
  }, []);

  const startReplay = useCallback(() => {
    const current = gameRef.current;
    if (!current || !current.submitted) return;
    clearReplayTimers();
    const steps = current.patterns.flatMap((pattern) => pattern.replayPath);
    if (!steps.length) return;
    current.replayIds = new Set();
    current.replayHotId = null;
    current.replaying = true;
    commit(current);
    steps.forEach((id, index) => {
      const timer = window.setTimeout(() => {
        mutateGame((draft) => {
          draft.replayIds.add(id);
          draft.replayHotId = id;
          draft.replaying = true;
        });
      }, index * 400);
      replayTimersRef.current.push(timer);
    });
    const endTimer = window.setTimeout(() => {
      mutateGame((draft) => {
        draft.replayHotId = null;
        draft.replaying = false;
      });
    }, steps.length * 400 + 500);
    replayTimersRef.current.push(endTimer);
  }, [clearReplayTimers, commit, mutateGame]);

  const startGame = useCallback(() => {
    clearReplayTimers();
    const config = difficulties[selectedDifficulty];
    const generated = generateCase(selectedDifficulty);
    const runtime: RuntimeGame = {
      ...generated,
      diff: selectedDifficulty,
      totalTime: config.time,
      timeLeft: config.time,
      score: 0,
      selected: null,
      flags: new Set(),
      submitted: false,
      paused: false,
      startedAt: Date.now(),
      correctFlags: 0,
      falseFlags: 0,
      solved: new Set(),
      inspectionsUsed: 0,
      inspectedNodes: new Set(),
      riskScores: {},
      correctIds: new Set(),
      wrongIds: new Set(),
      replayIds: new Set(),
      replayHotId: null,
      replaying: false,
      result: null,
    };
    commit(runtime);
    pushToast("Dossier chargé — trouvez les anomalies.");
  }, [clearReplayTimers, commit, pushToast, selectedDifficulty]);

  const goHome = useCallback(() => {
    clearReplayTimers();
    gameRef.current = null;
    setGame(null);
  }, [clearReplayTimers]);

  const selectEdge = useCallback(
    (id: string) => {
      mutateGame((draft) => {
        if (draft.submitted) return;
        draft.selected = id;
      });
    },
    [mutateGame],
  );

  const selectNode = useCallback(
    (id: string) => {
      const current = gameRef.current;
      if (!current || current.submitted) return;
      if (!canInspectNode(current.diff, current.inspectionsUsed)) {
        sounds.falsePositive();
        pushToast("Capacité d'analyse épuisée — signalez ou soumettez votre verdict.");
        return;
      }
      sounds.click();
      mutateGame((draft) => {
        draft.selected = id;
        draft.inspectionsUsed += 1;
        draft.inspectedNodes.add(id);
        const node = draft.nodes.find((candidate) => candidate.id === id);
        if (node) draft.riskScores[id] = computeRiskScore(node, draft);
      });
    },
    [mutateGame, pushToast, sounds],
  );

  const clearSelection = useCallback(() => {
    mutateGame((draft) => {
      if (!draft.submitted) draft.selected = null;
    });
  }, [mutateGame]);

  const toggleFlag = useCallback(
    (id?: string | null) => {
      const current = gameRef.current;
      const target = id || current?.selected;
      if (!current || !target || current.submitted) return;
      sounds.flag();
      mutateGame((draft) => {
        if (draft.flags.has(target)) draft.flags.delete(target);
        else draft.flags.add(target);
      });
      pushToast(current.flags.has(target) ? "Signalement retiré" : "Élément signalé");
    },
    [mutateGame, pushToast, sounds],
  );

  const submitVerdict = useCallback(
    (timeout = false) => {
      const current = gameRef.current;
      if (!current || current.submitted) return;
      const result = evaluateVerdict(current, current.flags, current.diff, current.timeLeft, timeout);
      current.submitted = true;
      current.paused = false;
      current.score = result.score;
      current.solved = result.solved;
      current.correctFlags = result.correct;
      current.falseFlags = result.wrong;
      current.correctIds = result.correctIds;
      current.wrongIds = result.wrongIds;
      current.result = result;
      commit(current);
      setHighScores((previous) =>
        [
          {
            score: result.score,
            diff: difficulties[current.diff].label,
            victory: result.victory,
            caseId: current.caseId,
            time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          },
          ...previous,
        ]
          .sort((a, b) => b.score - a.score)
          .slice(0, 10),
      );
      triggerFlash(result.victory ? "good" : result.wrong ? "bad" : "good");
      if (result.victory) {
        sounds.correct();
        sounds.complete();
      } else if (result.wrong > 0 || result.solved.size < current.patterns.length) {
        sounds.falsePositive();
      } else {
        sounds.correct();
      }
      window.setTimeout(startReplay, 520);
    },
    [commit, sounds, startReplay, triggerFlash],
  );

  const pause = useCallback(() => {
    mutateGame((draft) => {
      if (!draft.submitted) draft.paused = true;
    });
  }, [mutateGame]);

  const resume = useCallback(() => {
    mutateGame((draft) => {
      draft.paused = false;
    });
  }, [mutateGame]);

  const downloadReport = useCallback(() => {
    const current = gameRef.current;
    if (!current?.result) return;
    const report = createFraudReport({
      gameCase: current,
      difficulty: current.diff,
      score: current.score,
      flaggedIds: current.flags,
      verdict: current.result.verdict,
      totalTime: current.totalTime,
      timeLeft: current.timeLeft,
    });
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fraud-detective-${current.caseId}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 250);
  }, []);

  useEffect(() => {
    if (!game || game.submitted || game.paused) return;
    const timer = window.setInterval(() => {
      const current = gameRef.current;
      if (!current || current.paused || current.submitted) return;
      current.timeLeft = Math.max(0, current.timeLeft - 1);
      if (current.timeLeft <= 0) submitVerdict(true);
      else commit(current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [commit, game, submitVerdict]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = gameRef.current;
      if (!current) return;
      if (event.key === " ") {
        event.preventDefault();
        if (current.paused) resume();
        else pause();
      }
      if (current.paused) return;
      if (event.key === "Enter") submitVerdict(false);
      if (event.key === "Escape") clearSelection();
      if (event.key.toLowerCase() === "f") toggleFlag();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSelection, pause, resume, submitVerdict, toggleFlag]);

  useEffect(() => {
    return () => {
      clearReplayTimers();
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, [clearReplayTimers]);

  useEffect(() => {
    const runtime = gameRef.current;
    const svgElement = graphRef.current;
    const pane = graphPaneRef.current;
    if (!runtime || !svgElement || !pane) return;

    const draw = () => {
      const current = gameRef.current;
      if (!current || !graphRef.current || !graphPaneRef.current) return;
      const width = graphPaneRef.current.clientWidth;
      const height = graphPaneRef.current.clientHeight;
      const svg = d3.select(graphRef.current);
      svg.selectAll("*").remove();
      svg.attr("viewBox", `0 0 ${width} ${height}`);

      const defs = svg.append("defs");
      defs
        .append("marker")
        .attr("id", "fd-arrow")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 21)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#506176");
      defs
        .append("marker")
        .attr("id", "fd-arrow-replay")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 22)
        .attr("refY", 0)
        .attr("markerWidth", 7)
        .attr("markerHeight", 7)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#67d7b1");

      const root = svg.append("g");
      svg
        .call(
          d3
            .zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.28, 3.2])
            .on("zoom", (event) => root.attr("transform", event.transform.toString())),
        )
        .on("dblclick.zoom", null);

      const link = root
        .append("g")
        .selectAll<SVGLineElement, FraudEdge>("line")
        .data(current.edges, (datum) => datum.id)
        .join("line")
        .attr("data-testid", "fd-edge")
        .attr("class", (datum) => `fd-edge ${edgeClass(datum.type)}`)
        .attr("marker-end", "url(#fd-arrow)")
        .on("click", (event, datum) => {
          event.stopPropagation();
          selectEdge(datum.id);
        })
        .on("contextmenu", (event, datum) => {
          event.preventDefault();
          toggleFlag(datum.id);
        });

      const labels = root
        .append("g")
        .selectAll<SVGTextElement, FraudEdge>("text")
        .data(current.edges, (datum) => datum.id)
        .join("text")
        .attr("class", "fd-edge-label")
        .text((datum) => edgeLabel(datum));

      const node = root
        .append("g")
        .selectAll<SVGGElement, FraudNode>("g")
        .data(current.nodes, (datum) => datum.id)
        .join("g")
        .attr("data-testid", "fd-node")
        .attr("class", "fd-node")
        .on("click", (event, datum) => {
          event.stopPropagation();
          selectNode(datum.id);
        })
        .on("contextmenu", (event, datum) => {
          event.preventDefault();
          toggleFlag(datum.id);
        });

      node
        .append("circle")
        .attr("class", "fd-node-halo")
        .attr("r", (datum) => (datum.type === "company" ? 26 : datum.type === "person" ? 24 : 23));
      node
        .append("circle")
        .attr("class", "fd-node-core")
        .attr("r", (datum) => (datum.type === "company" ? 16 : datum.type === "person" ? 14 : 13))
        .attr("fill", (datum) => colorFor(datum));
      node.append("text").attr("class", "fd-node-icon").attr("y", 1).text(iconFor);
      node.append("text").attr("class", "fd-node-label").attr("y", 29).text((datum) => shortName(datum.name));

      let longPress: number | null = null;
      node
        .on("touchstart", (_event, datum) => {
          longPress = window.setTimeout(() => {
            toggleFlag(datum.id);
            if ("vibrate" in navigator) navigator.vibrate(30);
          }, 520);
        })
        .on("touchend touchmove", () => {
          if (longPress) window.clearTimeout(longPress);
        });

      svg.on("click", () => clearSelection());

      const simulation = d3
        .forceSimulation<FraudNode>(current.nodes)
        .force(
          "link",
          d3
            .forceLink<FraudNode, FraudEdge>(current.edges)
            .id((datum) => datum.id)
            .distance((datum) => (datum.type === "owns" ? 86 : 70))
            .strength(0.52),
        )
        .force("charge", d3.forceManyBody<FraudNode>().strength(-370))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide<FraudNode>().radius(42))
        .force("x", d3.forceX<FraudNode>(width / 2).strength(0.035))
        .force("y", d3.forceY<FraudNode>(height / 2).strength(0.035));

      node.call(
        d3
          .drag<SVGGElement, FraudNode>()
          .on("start", (event, datum) => {
            if (!event.active) simulation.alphaTarget(0.25).restart();
            datum.fx = datum.x;
            datum.fy = datum.y;
          })
          .on("drag", (event, datum) => {
            datum.fx = event.x;
            datum.fy = event.y;
          })
          .on("end", (event, datum) => {
            if (!event.active) simulation.alphaTarget(0);
            datum.fx = null;
            datum.fy = null;
          }),
      );

      simulation.on("tick", () => {
        link
          .attr("x1", (datum) => (datum.source as FraudNode).x || 0)
          .attr("y1", (datum) => (datum.source as FraudNode).y || 0)
          .attr("x2", (datum) => (datum.target as FraudNode).x || 0)
          .attr("y2", (datum) => (datum.target as FraudNode).y || 0);
        labels
          .attr("x", (datum) => (((datum.source as FraudNode).x || 0) + ((datum.target as FraudNode).x || 0)) / 2)
          .attr("y", (datum) => (((datum.source as FraudNode).y || 0) + ((datum.target as FraudNode).y || 0)) / 2);
        node.attr("transform", (datum) => `translate(${datum.x || 0},${datum.y || 0})`);
      });

      refreshGraphRef.current = () => {
        const active = gameRef.current;
        if (!active) return;
        node.attr("class", (datum) => {
          const score = active.riskScores[datum.id] || 0;
          return cx(
            "fd-node",
            active.selected === datum.id && "selected",
            active.flags.has(datum.id) && "flagged",
            active.correctIds.has(datum.id) && "correct",
            active.wrongIds.has(datum.id) && "wrong",
            active.inspectedNodes.has(datum.id) && "inspected",
            active.inspectedNodes.has(datum.id) && `risk-${riskTone(score)}`,
            active.replayIds.has(datum.id) && "replay",
            active.replayHotId === datum.id && "replay-hot",
          );
        });
        link
          .attr("class", (datum) =>
            cx(
              "fd-edge",
              edgeClass(datum.type),
              active.selected === datum.id && "selected",
              active.flags.has(datum.id) && "flagged",
              active.correctIds.has(datum.id) && "correct",
              active.wrongIds.has(datum.id) && "wrong",
              active.replayIds.has(datum.id) && "replay",
            ),
          )
          .attr("marker-end", (datum) => (active.replayIds.has(datum.id) ? "url(#fd-arrow-replay)" : "url(#fd-arrow)"));
      };
      refreshGraphRef.current();

      return () => simulation.stop();
    };

    let cleanup = draw();
    const onResize = () => {
      cleanup?.();
      cleanup = draw();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cleanup?.();
      refreshGraphRef.current = () => undefined;
    };
  }, [clearSelection, game?.caseId, selectEdge, selectNode, toggleFlag]);

  const selectedItem = game?.selected ? elementById(game, game.selected) : undefined;
  const remainingCapacity =
    game && difficulties[game.diff].capacity !== undefined
      ? Math.max(0, (difficulties[game.diff].capacity || 0) - game.inspectionsUsed)
      : null;

  return (
    <main className={styles.root}>
      <Link href="/lab" className={styles.returnLink}>
        ← Lab KYB
      </Link>

      {!game ? (
        <section className={cx(styles.screen, styles.startScreen)} data-testid="fd-start">
          <svg className={styles.bgGraph} viewBox="0 0 1200 800" aria-hidden>
            {background.edges.map(([a, b], index) => (
              <line
                key={`edge-${index}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#4f98a3"
                strokeOpacity="0.16"
              />
            ))}
            {background.nodes.map((node, index) => (
              <circle
                key={`node-${index}`}
                cx={node.x}
                cy={node.y}
                r={node.r}
                fill={node.t === 0 ? "#4f98a3" : node.t === 1 ? "#b38cff" : "#fdab43"}
                opacity="0.55"
              />
            ))}
          </svg>
          <div className={styles.startCard}>
            <div className={styles.startInner}>
              <div className={styles.eyebrow}>
                <span className={styles.dot} />
                Cellule Investigations AML/KYC
              </div>
              <h1 className={styles.title}>Fraud Detective</h1>
              <p className={styles.subtitle}>
                Analysez des structures d'actionnariat, repérez les signaux faibles et signalez les noeuds ou liens
                suspects avant la clôture du dossier.
              </p>
              <div className={styles.startGrid}>
                <div>
                  <div className={styles.difficulty} aria-label="Difficulté">
                    {(Object.entries(difficulties) as Array<[DifficultyKey, (typeof difficulties)[DifficultyKey]]>).map(
                      ([id, config]) => (
                        <button
                          key={id}
                          type="button"
                          className={cx(styles.diffOption, id === selectedDifficulty && styles.diffOptionSelected)}
                          onClick={() => setSelectedDifficulty(id)}
                          aria-pressed={id === selectedDifficulty}
                        >
                          <div>
                            <b>{config.label}</b>
                            <span>
                              {id === "junior"
                                ? "Formation analyste"
                                : id === "senior"
                                  ? "Dossier prioritaire"
                                  : "Cellule spéciale"}
                            </span>
                          </div>
                          <div className={styles.diffMeta}>{config.desc}</div>
                        </button>
                      ),
                    )}
                  </div>
                  <div className={styles.startActions}>
                    <button className={styles.primary} type="button" onClick={startGame}>
                      Démarrer l'investigation
                    </button>
                    <span className={cx(styles.mono)} style={{ color: "var(--fd-muted)", fontSize: 12 }}>
                      <span className={styles.kbd}>Espace</span> pause · <span className={styles.kbd}>F</span> signaler ·{" "}
                      <span className={styles.kbd}>Entrée</span> verdict
                    </span>
                  </div>
                </div>
                <div className={styles.brief}>
                  <h3>Ce que vous cherchez</h3>
                  <ul>
                    <li>Boucles d'actionnariat circulaire.</li>
                    <li>Administrateur commun à 3+ sociétés concurrentes.</li>
                    <li>Holding offshore sans revenus détenant des opérateurs.</li>
                    <li>Prête-nom et créations groupées.</li>
                    <li>Adresse enregistrée partagée entre pays différents.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className={cx(styles.screen, styles.gameScreen)} data-testid="fd-game">
          <div className={styles.topbar}>
            <div className={styles.brand}>
              <b>Fraud Detective</b>
              <span>
                {game.caseId} · {difficulties[game.diff].label}
              </span>
            </div>
            <div
              className={cx(
                styles.stat,
                game.timeLeft <= 10 ? styles.timerCritical : game.timeLeft <= 20 ? styles.timerWarning : null,
              )}
            >
              <label>Temps</label>
              <strong>{String(game.timeLeft).padStart(2, "0")}</strong>
            </div>
            <div className={styles.stat}>
              <label>Score</label>
              <strong>{game.score}</strong>
            </div>
            <div className={styles.stat}>
              <label>Flags</label>
              <strong>{game.flags.size}</strong>
            </div>
            <div className={styles.stat}>
              <label>Fraudes</label>
              <strong>
                {game.solved.size}/{game.patterns.length}
              </strong>
            </div>
            {remainingCapacity !== null ? (
              <div
                className={cx(
                  styles.stat,
                  remainingCapacity === 0
                    ? styles.capacityEmpty
                    : remainingCapacity <= 5
                      ? styles.capacityLow
                      : null,
                )}
              >
                <label>Capacité d'analyse</label>
                <strong data-testid="fd-capacity">{remainingCapacity}</strong>
              </div>
            ) : null}
            <div className={styles.topSpacer} />
            <button className={styles.secondary} type="button" onClick={pause}>
              Pause
            </button>
            <button className={cx(styles.secondary, styles.danger)} type="button" onClick={goHome}>
              Abandon
            </button>
          </div>

          <div className={styles.layout}>
            <main className={styles.graphPane} ref={graphPaneRef} id="graphPane">
              <div className={styles.gridBg} />
              <div className={styles.legend}>
                <span className={styles.pill}>
                  <span className={styles.sw} style={{ background: "var(--fd-teal)" }} />
                  Société
                </span>
                <span className={styles.pill}>
                  <span className={styles.sw} style={{ background: "var(--fd-violet)" }} />
                  Individu
                </span>
                <span className={styles.pill}>
                  <span className={styles.sw} style={{ background: "var(--fd-amber)" }} />
                  Compte
                </span>
              </div>
              <svg ref={graphRef} className={styles.graph} aria-label={`Graphe du dossier ${game.caseId}`} />
              <div className={styles.graphHint}>
                <span className={styles.pill}>Clic = inspecter</span>
                <span className={styles.pill}>Molette/pincement = zoom</span>
                <span className={styles.pill}>Clic droit / F / appui long = signaler</span>
                {game.replaying ? <span className={styles.pill}>Replay fraude en cours</span> : null}
              </div>
              <div
                className={cx(
                  styles.flash,
                  flash === "good" && styles.flashGood,
                  flash === "bad" && styles.flashBad,
                )}
              />
            </main>

            <aside className={styles.inspector}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Inspecteur</h2>
                  <div className={styles.case}>{selectedItem ? selectedLabel(selectedItem) : "Aucun élément sélectionné"}</div>
                </div>
                <button className={styles.secondary} type="button" onClick={clearSelection}>
                  Effacer
                </button>
              </div>
              <div className={styles.panelBody}>
                <InspectorPanel game={game} selectedItem={selectedItem} onToggleFlag={toggleFlag} />
              </div>
              <div className={styles.submission}>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${(game.solved.size / game.patterns.length) * 100}%` }}
                  />
                </div>
                <div className={styles.submitRow}>
                  <button
                    className={cx(styles.flagBtn, game.selected && game.flags.has(game.selected) && styles.flagged)}
                    type="button"
                    disabled={!game.selected || game.submitted}
                    onClick={() => toggleFlag()}
                  >
                    {game.selected && game.flags.has(game.selected)
                      ? "Retirer le signalement (F)"
                      : "Signaler la sélection (F)"}
                  </button>
                  <button className={styles.primary} type="button" onClick={() => submitVerdict(false)}>
                    Soumettre verdict ↵
                  </button>
                </div>
              </div>
            </aside>
          </div>

          <div className={cx(styles.overlay, game.paused && styles.overlayActive)}>
            <div className={styles.modal}>
              <div className={styles.verdictBadge}>⏸</div>
              <h2>Dossier en pause</h2>
              <p style={{ color: "var(--fd-muted)" }}>Le chronomètre est suspendu. Reprenez quand vous êtes prêt.</p>
              <div className={styles.startActions}>
                <button className={styles.primary} type="button" onClick={resume}>
                  Reprendre
                </button>
                <button className={cx(styles.secondary, styles.danger)} type="button" onClick={goHome}>
                  Abandonner
                </button>
              </div>
            </div>
          </div>

          <div className={cx(styles.overlay, game.submitted && styles.overlayActive)}>
            <div className={styles.modal}>
              {game.result ? (
                <ResultPanel
                  game={game}
                  highScores={highScores}
                  onStartGame={startGame}
                  onGoHome={goHome}
                  onStartReplay={startReplay}
                  onDownloadReport={downloadReport}
                />
              ) : null}
            </div>
          </div>
        </section>
      )}

      <div className={cx(styles.toast, showToast && styles.toastShow)} role="status">
        {toast}
      </div>
    </main>
  );
}

function selectedLabel(item: FraudNode | FraudEdge) {
  if (isEdge(item)) return `Lien ${item.id}`;
  if (item.type === "company") return `Société ${item.id}`;
  if (item.type === "person") return `Individu ${item.id}`;
  return `Compte bancaire ${item.id}`;
}

type InspectorPanelProps = {
  game: RuntimeGame;
  selectedItem?: FraudNode | FraudEdge;
  onToggleFlag: (id?: string | null) => void;
};

function InspectorPanel({ game, selectedItem, onToggleFlag }: InspectorPanelProps) {
  if (!selectedItem) {
    return (
      <>
        <div className={styles.empty}>
          Sélectionnez un noeud ou un lien pour lire les données KYC : pays, secteur, revenus, adresse, relations et
          identifiants.
        </div>
        <div className={styles.intel}>
          <b>Astuce analyste :</b> les fraudes sont des motifs structurels. Une seule donnée suspecte peut être un
          leurre ; cherchez les relations qui la rendent incohérente.
        </div>
      </>
    );
  }

  const flagged = game.flags.has(selectedItem.id);

  if (isEdge(selectedItem)) {
    const [source, target] = endpoints(selectedItem, game.nodes);
    return (
      <>
        <div className={styles.entityTitle}>
          <div className={styles.bigIcon}>⇄</div>
          <div>
            <h3>{edgeLabel(selectedItem)}</h3>
            <small>{selectedItem.id}</small>
          </div>
        </div>
        <div className={styles.tagRow}>
          <span className={styles.tag}>{selectedItem.type}</span>
          {flagged ? <span className={cx(styles.tag, styles.tagWarn)}>SIGNALÉ</span> : null}
        </div>
        <dl className={styles.kv}>
          <dt>Source</dt>
          <dd>
            {source?.name || "—"} <span className={styles.mono}>{source?.id}</span>
          </dd>
          <dt>Cible</dt>
          <dd>
            {target?.name || "—"} <span className={styles.mono}>{target?.id}</span>
          </dd>
          <dt>Type</dt>
          <dd>{edgeLabel(selectedItem)}</dd>
          <dt>Preuve</dt>
          <dd>
            {selectedItem.type === "same_address"
              ? source?.address
              : selectedItem.type === "owns"
                ? "Participation capitalistique déclarée"
                : selectedItem.type === "directs"
                  ? "Mandat administrateur"
                  : "Compte bancaire mutualisé"}
          </dd>
        </dl>
        <button
          className={cx(styles.flagBtn, flagged && styles.flagged)}
          type="button"
          onClick={() => onToggleFlag(selectedItem.id)}
        >
          {flagged ? "Retirer le signalement" : "Signaler ce lien"}
        </button>
        <div className={styles.intel}>
          <b>Note d'investigation :</b> Évaluez si ce lien contribue à un motif : boucle, contrôle, compte commun ou
          adresse partagée.
        </div>
      </>
    );
  }

  const risk = game.riskScores[selectedItem.id];
  const relations = game.edges.filter((edgeValue) => {
    const [source, target] = endpoints(edgeValue, game.nodes);
    return source?.id === selectedItem.id || target?.id === selectedItem.id;
  });

  return (
    <>
      <div className={styles.entityTitle}>
        <div className={styles.bigIcon}>{iconFor(selectedItem)}</div>
        <div>
          <h3>{selectedItem.name}</h3>
          <small>{selectedItem.id}</small>
        </div>
      </div>
      <div className={styles.tagRow}>
        <span className={styles.tag}>{selectedItem.type}</span>
        <span className={styles.tag}>{selectedItem.country}</span>
        {selectedItem.sector && selectedItem.sector !== "—" ? <span className={styles.tag}>{selectedItem.sector}</span> : null}
        {selectedItem.notes?.map((note) => (
          <span key={note} className={cx(styles.tag, styles.tagWarn)}>
            {note}
          </span>
        ))}
        {risk !== undefined ? (
          <span
            className={cx(
              styles.tag,
              riskTone(risk) === "red" ? styles.tagRed : riskTone(risk) === "green" ? styles.tagGreen : styles.tagWarn,
            )}
          >
            Risque {risk}/100
          </span>
        ) : null}
        {flagged ? <span className={cx(styles.tag, styles.tagWarn)}>SIGNALÉ</span> : null}
      </div>
      <dl className={styles.kv}>
        <dt>Pays</dt>
        <dd>{selectedItem.country}</dd>
        <dt>Adresse</dt>
        <dd>{selectedItem.address || "—"}</dd>
        <dt>Secteur</dt>
        <dd>{selectedItem.sector || "—"}</dd>
        {selectedItem.type === "company" ? (
          <>
            <dt>Revenus déclarés</dt>
            <dd>{formatMoney(selectedItem.revenue)}</dd>
            <dt>Création</dt>
            <dd>{selectedItem.incorp}</dd>
          </>
        ) : selectedItem.type === "person" ? (
          <>
            <dt>ID personne</dt>
            <dd className={styles.mono}>{selectedItem.personId}</dd>
            <dt>Naissance</dt>
            <dd>{selectedItem.birth}</dd>
            <dt>Revenus déclarés</dt>
            <dd>{formatMoney(selectedItem.declaredRevenue)}</dd>
          </>
        ) : (
          <>
            <dt>Banque</dt>
            <dd>{selectedItem.bank}</dd>
            <dt>IBAN</dt>
            <dd className={styles.mono}>{selectedItem.iban}</dd>
          </>
        )}
      </dl>
      <h3 style={{ fontSize: 14, margin: "16px 0 8px" }}>Relations directes</h3>
      <div className={styles.links}>
        {relations.length ? (
          relations.map((edgeValue) => {
            const [source, target] = endpoints(edgeValue, game.nodes);
            const other = source?.id === selectedItem.id ? target : source;
            return (
              <div key={edgeValue.id} className={styles.linkItem}>
                <span className={styles.mono}>{edgeValue.id}</span> · {edgeLabel(edgeValue)} · {other?.name}{" "}
                <span className={styles.mono}>{other?.id}</span>
              </div>
            );
          })
        ) : (
          <div className={styles.linkItem}>Aucun lien direct déclaré.</div>
        )}
      </div>
      <button
        className={cx(styles.flagBtn, flagged && styles.flagged)}
        type="button"
        onClick={() => onToggleFlag(selectedItem.id)}
      >
        {flagged ? "Retirer le signalement" : "Signaler ce noeud"}
      </button>
      <div className={styles.intel}>
        <b>Note d'investigation :</b>{" "}
        {selectedItem.type === "company"
          ? "Comparez revenus, pays, secteur et participations. Les holdings sans activité économique méritent une revue renforcée."
          : selectedItem.type === "person"
            ? "Vérifiez les mandats, participations et similarités de nom/identifiant avec d'autres personnes."
            : "Un compte partagé peut être légitime, mais il devient critique avec des entités non liées."}
      </div>
    </>
  );
}

type ResultPanelProps = {
  game: RuntimeGame;
  highScores: HighScore[];
  onStartGame: () => void;
  onGoHome: () => void;
  onStartReplay: () => void;
  onDownloadReport: () => void;
};

function ResultPanel({
  game,
  highScores,
  onStartGame,
  onGoHome,
  onStartReplay,
  onDownloadReport,
}: ResultPanelProps) {
  const result = game.result;
  if (!result) return null;
  return (
    <>
      <div className={styles.verdictBadge}>{result.victory ? "✓" : result.verdict === "temps écoulé" ? "⌛" : "!"}</div>
      <h2>{result.victory ? "Verdict validé" : "Investigation incomplète"}</h2>
      <p style={{ color: "var(--fd-muted)", lineHeight: 1.5 }}>
        {result.victory
          ? "Toutes les structures frauduleuses ont été repérées."
          : "Certains motifs restent non identifiés ou des faux positifs ont réduit votre score."}
      </p>
      <div className={styles.scoreBreak}>
        <div>
          <span className={styles.mono} style={{ color: "var(--fd-muted)" }}>
            Score final
          </span>
          <br />
          <b style={{ fontSize: 28 }}>{game.score}</b>
        </div>
        <div>
          <span className={styles.mono} style={{ color: "var(--fd-muted)" }}>
            Fraudes trouvées
          </span>
          <br />
          <b style={{ fontSize: 28 }}>
            {game.solved.size}/{game.patterns.length}
          </b>
        </div>
        <div>
          Base : <b>{result.breakdown.base}</b>
          <br />
          Vitesse : <b>+{result.breakdown.speed}</b>
        </div>
        <div>
          Pénalités : <b>-{result.breakdown.penalty}</b>
          <br />
          Combo : <b>+{result.breakdown.combo}</b>
        </div>
      </div>
      <h3>Débrief pédagogique</h3>
      <div className={styles.explanations}>
        {game.patterns.map((pattern) => (
          <div className={styles.explain} key={pattern.id}>
            <b>
              {game.solved.has(pattern.id) ? "✓" : "•"} {pattern.label}
            </b>
            <br />
            {pattern.explanation}
            <br />
            <span className={styles.mono} style={{ color: "var(--fd-muted)" }}>
              Éléments clés : {pattern.items.join(", ")}
            </span>
          </div>
        ))}
      </div>
      <div className={styles.highScores}>
        <h3>Top 10 session</h3>
        <table className={styles.scoreTable}>
          <thead>
            <tr>
              <th>#</th>
              <th>Score</th>
              <th>Niveau</th>
              <th>Verdict</th>
              <th>Heure</th>
            </tr>
          </thead>
          <tbody>
            {highScores.length ? (
              highScores.map((entry, index) => (
                <tr key={`${entry.caseId}-${entry.time}`}>
                  <td>{index + 1}</td>
                  <td>{entry.score}</td>
                  <td>{entry.diff}</td>
                  <td>{entry.victory ? "validé" : "partiel"}</td>
                  <td>{entry.time}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>Aucun score.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className={styles.startActions}>
        <button className={styles.primary} type="button" onClick={onStartGame}>
          {result.victory ? "Dossier suivant" : "Réessayer un dossier"}
        </button>
        <button className={styles.secondary} type="button" onClick={onStartReplay}>
          Revoir la fraude
        </button>
        <button className={styles.secondary} type="button" onClick={onDownloadReport}>
          Télécharger rapport
        </button>
        <button className={cx(styles.secondary, styles.danger)} type="button" onClick={onGoHome}>
          Accueil
        </button>
      </div>
    </>
  );
}
