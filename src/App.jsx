import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
// AI ENGINE
// ─────────────────────────────────────────────────────────────
function stateKey(s) {
  return `${s.room}|${[...s.inv].sort().join(",")}|${[...s.solved].sort().join(",")}`;
}
function getNeighbors(s) {
  const out = [];
  const add = (action, room, inv, solved, cost = 1) =>
    out.push({ action, cost, state: { room, inv: new Set(inv), solved: new Set(solved) } });
  const { room, inv, solved } = s;
  if (room === "foyer") {
    if (!inv.has("torch")) add("Pick up torch", "foyer", [...inv, "torch"], solved);
    if (inv.has("torch"))  add("Go to corridor", "corridor", inv, solved, 2);
  }
  if (room === "corridor") {
    add("Return to foyer", "foyer", inv, solved);
    if (inv.has("torch"))  add("Enter cipher room", "cipher", inv, solved, 2);
    if (inv.has("redKey")) add("Enter vault room", "vault", inv, solved, 2);
  }
  if (room === "cipher") {
    add("Return to corridor", "corridor", inv, solved);
    if (!solved.has("codeLock"))    add("Solve code lock (CSP)", "cipher", inv, [...solved, "codeLock"], 3);
    if (solved.has("codeLock") && !inv.has("redKey"))   add("Collect red key", "cipher", [...inv, "redKey"], solved);
    if (!solved.has("logicPuzzle")) add("Solve logic puzzle (CSP)", "cipher", inv, [...solved, "logicPuzzle"], 3);
    if (solved.has("logicPuzzle") && !inv.has("notebook")) add("Collect notebook", "cipher", [...inv, "notebook"], solved);
  }
  if (room === "vault") {
    add("Return to corridor", "corridor", inv, solved);
    if (!solved.has("keyMatch")) add("Solve key matching", "vault", inv, [...solved, "keyMatch"], 2);
    if (solved.has("keyMatch") && !inv.has("blueKey"))  add("Collect blue key",  "vault", [...inv, "blueKey"],  solved);
    if (solved.has("keyMatch") && !inv.has("greenKey")) add("Collect green key", "vault", [...inv, "greenKey"], solved);
  }
  if (room === "corridor" && inv.has("blueKey") && inv.has("greenKey") && inv.has("notebook") && solved.size >= 3)
    add("UNLOCK EXIT — ESCAPE!", "exit", inv, solved, 1);
  return out;
}
function isGoal(s) { return s.room === "exit"; }
function heuristic(s) {
  let h = 0;
  if (!s.solved.has("codeLock"))    h += 3; if (!s.solved.has("logicPuzzle")) h += 3;
  if (!s.solved.has("keyMatch"))    h += 2; if (!s.inv.has("torch"))  h += 2;
  if (!s.inv.has("redKey"))   h += 2; if (!s.inv.has("blueKey"))  h += 2;
  if (!s.inv.has("greenKey")) h += 2; if (!s.inv.has("notebook")) h += 2;
  if (s.room !== "exit") h += 1; return h;
}
function bfs(start) {
  // BFS: FIFO queue, visits nodes level-by-level → guaranteed shortest path
  const q = [{ s: start, acts: [] }], vis = new Set([stateKey(start)]), exp = [];
  while (q.length) {
    const { s, acts } = q.shift();
    exp.push({ state: s, action: acts.at(-1) || "Start" });
    if (isGoal(s)) return { path: acts, explored: exp, cost: acts.length };
    for (const { action, state: n } of getNeighbors(s)) {
      const k = stateKey(n);
      if (!vis.has(k)) { vis.add(k); q.push({ s: n, acts: [...acts, action] }); }
    }
  }
  return { path: [], explored: exp, cost: 0 };
}
function dfs(start) {
  // DFS: LIFO stack, marks visited on POP → explores deep paths fully before backtracking
  // This means it can revisit states via different routes before finding the goal,
  // leading to more nodes explored and a potentially non-optimal path.
  const stack = [{ s: start, acts: [], d: 0 }];
  const vis = new Set(), exp = [];
  const MAX_DEPTH = 22;
  while (stack.length) {
    const { s, acts, d } = stack.pop();
    const k = stateKey(s);
    if (vis.has(k)) continue; // skip if already fully processed
    vis.add(k); // mark visited on pop, not on push
    exp.push({ state: s, action: acts.at(-1) || "Start" });
    if (isGoal(s)) return { path: acts, explored: exp, cost: acts.length };
    if (d < MAX_DEPTH) {
      // Push in forward order so first neighbor is processed first (LIFO reversal)
      for (const { action, state: n } of getNeighbors(s)) {
        const nk = stateKey(n);
        if (!vis.has(nk)) {
          stack.push({ s: n, acts: [...acts, action], d: d + 1 });
        }
      }
    }
  }
  return { path: [], explored: exp, cost: 0 };
}
function astar(start) {
  // A*: priority queue sorted by f = g + h(n), heuristic guides toward goal
  // Explores far fewer nodes than BFS/DFS by skipping unpromising states
  const open = [{ s: start, acts: [], g: 0, f: heuristic(start) }];
  const closed = new Set(), exp = [];
  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const { s, acts, g } = open.shift();
    const k = stateKey(s);
    if (closed.has(k)) continue;
    closed.add(k);
    exp.push({ state: s, action: acts.at(-1) || "Start", g, h: heuristic(s) });
    if (isGoal(s)) return { path: acts, explored: exp, cost: g };
    for (const { action, state: n, cost } of getNeighbors(s)) {
      const nk = stateKey(n);
      if (!closed.has(nk)) {
        open.push({ s: n, acts: [...acts, action], g: g + cost, f: g + cost + heuristic(n) });
      }
    }
  }
  return { path: [], explored: exp, cost: 0 };
}
function runAlgo(algo, start) {
  const t0 = performance.now();
  const r = algo === "bfs" ? bfs(start) : algo === "dfs" ? dfs(start) : astar(start);
  return { ...r, time: (performance.now() - t0).toFixed(2), algorithm: algo };
}
function solveCode() {
  for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) for (let c = 1; c <= 9; c++)
    if (a !== b && b !== c && a !== c && a + b + c === 15 && a % 2 === 1) return [a, b, c];
  return [1, 5, 9];
}
const CODE_SOLUTION = solveCode();

// ─────────────────────────────────────────────────────────────
// ROOM CONFIG
// ─────────────────────────────────────────────────────────────
const ROOM_CONFIG = {
  foyer:    { name: "Foyer",       accent: "#7c3aed", clue: "A dusty torch sits on the table. The corridor ahead is sealed in darkness." },
  corridor: { name: "Corridor",    accent: "#16a34a", clue: "Three doors. One back, two forward. The exit needs all three keys + the notebook." },
  cipher:   { name: "Cipher Room", accent: "#d97706", clue: "Two puzzle stations glow. Solve both to earn the red key and notebook." },
  vault:    { name: "Vault Room",  accent: "#0891b2", clue: "Match each coloured key to its lock. Both blue and green keys await." },
  exit:     { name: "ESCAPED!",    accent: "#10b981", clue: "You solved every puzzle and escaped! Congratulations!" },
};

const ITEM_META = {
  torch:    { icon: "🔦", color: "#f59e0b" },
  redKey:   { icon: "🔑", color: "#ef4444" },
  blueKey:  { icon: "🔵", color: "#3b82f6" },
  greenKey: { icon: "🟢", color: "#10b981" },
  notebook: { icon: "📓", color: "#8b5cf6" },
};

// ─────────────────────────────────────────────────────────────
// ROOM SVG SCENES
// ─────────────────────────────────────────────────────────────
function RoomScene({ roomId, gs, onAction, aiProgress }) {
  const [hov, setHov] = useState(null);
  const [charX, setCharX] = useState(280);
  const [walking, setWalking] = useState(false);
  const prevRoom = useRef(roomId);

  useEffect(() => {
    if (roomId !== prevRoom.current) {
      prevRoom.current = roomId;
      setCharX(60); setWalking(true);
      const t = setTimeout(() => { setCharX(260); setWalking(false); }, 700);
      return () => clearTimeout(t);
    }
  }, [roomId]);

  const rc = ROOM_CONFIG[roomId] || ROOM_CONFIG.foyer;
  const acc = rc.accent;

  // Define interactive objects per room
  const objects = {
    foyer: [
      { id: "torch",     x: 150, y: 185, label: "Pick up torch", icon: "🔦",  type: "item",  available: !gs.inv.has("torch"), done: gs.inv.has("torch") },
      { id: "toCorridor", x: 500, y: 155, label: gs.inv.has("torch") ? "Enter corridor →" : "Need torch first", icon: "🚪", type: "door", available: gs.inv.has("torch"), dest: "corridor" },
    ],
    corridor: [
      { id: "toFoyer",   x: 60,  y: 155, label: "← Foyer",      icon: "🚪", type: "door", available: true,  dest: "foyer" },
      { id: "toCipher",  x: 280, y: 115, label: gs.inv.has("torch") ? "Cipher Room" : "Need torch",  icon: "🧩", type: "door", available: gs.inv.has("torch"),  dest: "cipher" },
      { id: "toVault",   x: 500, y: 155, label: gs.inv.has("redKey") ? "Vault Room" : "Need red key", icon: "🗝️",  type: "door", available: gs.inv.has("redKey"),  dest: "vault" },
      { id: "exit",      x: 280, y: 210, label: gs.inv.has("blueKey") && gs.inv.has("greenKey") && gs.inv.has("notebook") && gs.solved.size >= 3 ? "🏆 ESCAPE!" : "Need all items", icon: "🏆", type: "door", isExit: true, available: gs.inv.has("blueKey") && gs.inv.has("greenKey") && gs.inv.has("notebook") && gs.solved.size >= 3, dest: "exit" },
    ],
    cipher: [
      { id: "toCorr",       x: 60,  y: 155, label: "← Corridor",    icon: "🚪", type: "door",   available: true,  dest: "corridor" },
      { id: "codeLock",     x: 190, y: 168, label: gs.solved.has("codeLock") ? "✓ Solved" : "Code Lock",   icon: "🔐", type: "puzzle", available: !gs.solved.has("codeLock"), done: gs.solved.has("codeLock") },
      { id: "logicPuzzle",  x: 400, y: 168, label: gs.solved.has("logicPuzzle") ? "✓ Solved" : "Logic Box", icon: "🧠", type: "puzzle", available: !gs.solved.has("logicPuzzle"), done: gs.solved.has("logicPuzzle") },
    ],
    vault: [
      { id: "toCorr",   x: 60,  y: 155, label: "← Corridor",  icon: "🚪", type: "door",   available: true,  dest: "corridor" },
      { id: "keyMatch", x: 310, y: 160, label: gs.solved.has("keyMatch") ? "✓ Solved" : "Key Panel", icon: "🗝️",  type: "puzzle", available: !gs.solved.has("keyMatch"), done: gs.solved.has("keyMatch") },
    ],
    exit: [],
  };

  const roomObjs = objects[roomId] || [];

  // Room-specific artwork
  const Artwork = () => {
    if (roomId === "foyer") return (
      <>
        {/* Wallpaper pattern */}
        {Array.from({ length: 6 }, (_, i) => Array.from({ length: 4 }, (_, j) => (
          <circle key={`${i}-${j}`} cx={40 + i * 110} cy={30 + j * 55} r="2" fill={acc} opacity="0.12" />
        )))}
        {/* Painting on wall */}
        <rect x="60" y="40" width="90" height="110" rx="4" fill="#1a1025" stroke={acc + "44"} strokeWidth="1.5" />
        <rect x="68" y="48" width="74" height="94" rx="2" fill="#0d0820" />
        <text x="105" y="94" textAnchor="middle" fill={acc + "66"} fontSize="11" fontFamily="monospace">AI</text>
        <text x="105" y="108" textAnchor="middle" fill={acc + "44"} fontSize="9" fontFamily="monospace">ESCAPE</text>
        <circle cx="105" cy="70" r="4" fill={acc} opacity="0.4" />
        {/* Bookshelf */}
        <rect x="420" y="50" width="130" height="150" rx="3" fill="#1a1025" stroke="#33334455" strokeWidth="1" />
        {[0,1,2].map(row => [0,1,2,3].map(col => (
          <rect key={`${row}-${col}`} x={430 + col * 30} y={62 + row * 44} width="24" height="38" rx="2"
            fill={["#2d1b4e","#1a2e1a","#2e2000","#001a1a"][col % 4]} stroke="#ffffff11" strokeWidth="0.5" />
        )))}
        {/* Table with torch */}
        <rect x="115" y="207" width="80" height="14" rx="3" fill="#2a2040" />
        <rect x="125" y="221" width="8" height="22" fill="#1a1030" />
        <rect x="155" y="221" width="8" height="22" fill="#1a1030" />
      </>
    );
    if (roomId === "corridor") return (
      <>
        {/* Perspective lines on floor */}
        {[100,200,300,400,500].map(x => <line key={x} x1={x} y1="230" x2="300" y2="100" stroke="#ffffff05" strokeWidth="0.5" />)}
        {/* Wall sconces */}
        {[100, 500].map(x => (
          <g key={x}>
            <rect x={x - 8} y="40" width="16" height="30" rx="2" fill="#1a2e1a" stroke={acc + "44"} strokeWidth="1" />
            <ellipse cx={x} cy="70" rx="14" ry="8" fill={acc} opacity="0.25" />
            <line x1={x} y1="78" x2={x} y2="105" stroke={acc} strokeWidth="0.5" opacity="0.3" />
          </g>
        ))}
        {/* Floor tiles */}
        {[0,1,2,3].map(row => [0,1,2,3,4,5].map(col => (
          <rect key={`${row}-${col}`} x={col * 100} y={230 + row * 28} width="98" height="26"
            fill={((row + col) % 2 === 0) ? "#0a120a" : "#080f08"} />
        )))}
        {/* Ceiling beam */}
        <rect x="0" y="30" width="600" height="12" fill="#0a140a" />
        {[60, 180, 300, 420, 540].map(x => (
          <rect key={x} x={x - 4} y="30" width="8" height="72" fill="#0a0f0a" />
        ))}
      </>
    );
    if (roomId === "cipher") return (
      <>
        {/* Grid pattern */}
        {Array.from({ length: 7 }, (_, i) => (
          <line key={`v${i}`} x1={i * 100} y1="0" x2={i * 100} y2="230" stroke={acc} opacity="0.05" strokeWidth="0.5" />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 55} x2="600" y2={i * 55} stroke={acc} opacity="0.05" strokeWidth="0.5" />
        ))}
        {/* Circuit patterns */}
        <circle cx="530" cy="80" r="40" fill="none" stroke={acc} opacity="0.1" strokeWidth="0.8" />
        <circle cx="530" cy="80" r="25" fill="none" stroke={acc} opacity="0.12" strokeWidth="0.8" />
        <circle cx="530" cy="80" r="10" fill={acc} opacity="0.12" />
        <text x="530" y="85" textAnchor="middle" fill={acc} fontSize="10" fontFamily="monospace" opacity="0.5">CSP</text>
        {/* Wires */}
        {[[190, 120, 190, 148],[400, 120, 400, 148]].map(([x1,y1,x2,y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={acc} strokeWidth="1.5" opacity="0.3" />
        ))}
        {/* Indicator lights */}
        {[150, 230, 310, 370, 450].map((x, i) => (
          <circle key={i} cx={x} cy="22" r="4" fill={acc} opacity="0.3">
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur={`${1.2 + i * 0.3}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </>
    );
    if (roomId === "vault") return (
      <>
        {/* Vault walls with lockers */}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <g key={i}>
            <rect x={20 + i * 95} y="40" width="80" height="185" rx="4" fill="#001820" stroke={acc + "33"} strokeWidth="1" />
            <rect x={28 + i * 95} y="50" width="64" height="120" rx="2" fill="#000d14" />
            <circle cx={60 + i * 95} cy="132" r="5" fill={acc} opacity="0.25" />
            <rect x={48 + i * 95} y="175" width="25" height="6" rx="3" fill={acc} opacity="0.15" />
          </g>
        ))}
        {/* Ceiling pipes */}
        <rect x="0" y="28" width="600" height="14" fill="#000d14" />
        {[50, 200, 350, 500].map(x => (
          <rect key={x} x={x - 2} y="28" width="4" height="100" fill={acc} opacity="0.08" />
        ))}
      </>
    );
    if (roomId === "exit") return (
      <>
        {/* Celebration particles */}
        {Array.from({ length: 18 }, (_, i) => (
          <circle key={i} cx={30 + i * 32} cy={80 + (i % 5) * 30} r={3 + (i % 3)}
            fill={["#10b981","#f59e0b","#7c3aed","#ef4444","#3b82f6"][i % 5]} opacity="0.7">
            <animate attributeName="cy" values={`${80 + (i % 5) * 30};${50 + (i % 5) * 20};${80 + (i % 5) * 30}`} dur={`${1 + (i % 4) * 0.5}s`} repeatCount="indefinite" />
          </circle>
        ))}
        <text x="300" y="130" textAnchor="middle" fill="#10b981" fontSize="52" opacity="0.15" fontFamily="monospace">✓</text>
      </>
    );
    return null;
  };

  return (
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: `1px solid ${acc}44`, background: "#0a0a0f" }}>
      <svg viewBox="0 0 600 290" width="100%" style={{ display: "block" }}>
        {/* Background */}
        <rect width="600" height="290" fill={{ foyer: "#12091e", corridor: "#070f07", cipher: "#100e00", vault: "#00090d", exit: "#030f06" }[roomId] || "#0a0a0f"} />
        <Artwork />

        {/* Floor */}
        <polygon points="0,230 600,230 620,290 -20,290"
          fill={{ foyer: "#0a0615", corridor: "#040a04", cipher: "#080600", vault: "#000608", exit: "#021008" }[roomId] || "#0a0a0f"}
          opacity="0.85" />

        {/* Room label */}
        <rect x="14" y="10" width={rc.name.length * 8 + 20} height="22" rx="11" fill={acc} opacity="0.18" />
        <text x="24" y="25" fill={acc} fontSize="11" fontFamily="monospace">{rc.name}</text>

        {/* Objects */}
        {roomObjs.map(obj => {
          const isHov = hov === obj.id;
          const alpha = obj.done ? 0.25 : obj.available ? 1 : 0.35;
          const glowColor = obj.type === "puzzle" ? acc : obj.type === "item" ? "#f59e0b" : acc;
          return (
            <g key={obj.id} opacity={alpha}
              style={{ cursor: obj.available ? "pointer" : "not-allowed" }}
              onMouseEnter={() => setHov(obj.id)}
              onMouseLeave={() => setHov(null)}
              onClick={() => obj.available && onAction(obj)}>

              {/* Ground shadow */}
              <ellipse cx={obj.x} cy={230} rx={obj.type === "puzzle" ? 28 : 18} ry="5" fill="#000" opacity="0.3" />

              {/* Hover glow */}
              {isHov && obj.available && (
                <circle cx={obj.x} cy={obj.y} r="36" fill={glowColor} opacity="0.12" />
              )}

              {/* PUZZLE STATION */}
              {obj.type === "puzzle" && (
                <>
                  <rect x={obj.x - 32} y={obj.y - 18} width="64" height="72" rx="6"
                    fill="#0d0d0d" stroke={isHov ? glowColor : glowColor + "66"} strokeWidth={isHov ? 2 : 1} />
                  <rect x={obj.x - 24} y={obj.y - 10} width="48" height="36" rx="4"
                    fill={glowColor} opacity="0.12" />
                  {/* Screen lines */}
                  {[0,1,2].map(i => <line key={i} x1={obj.x - 18} y1={obj.y - 2 + i * 9} x2={obj.x + 18} y2={obj.y - 2 + i * 9} stroke={glowColor} strokeWidth="0.8" opacity="0.3" />)}
                  <text x={obj.x} y={obj.y + 18} textAnchor="middle" fontSize="20">{obj.icon}</text>
                  {/* Base */}
                  <rect x={obj.x - 18} y={obj.y + 54} width="36" height="8" rx="2" fill="#111" />
                  <rect x={obj.x - 8} y={obj.y + 62} width="16" height="14" fill="#0a0a0a" />
                  {obj.done && (
                    <g>
                      <circle cx={obj.x} cy={obj.y - 28} r="10" fill="#10b981" opacity="0.9" />
                      <text x={obj.x} y={obj.y - 23} textAnchor="middle" fill="#fff" fontSize="10">✓</text>
                    </g>
                  )}
                  {!obj.available && !obj.done && (
                    <circle cx={obj.x} cy={obj.y - 28} r="6" fill={glowColor} opacity="0.5">
                      <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  )}
                </>
              )}

              {/* DOOR */}
              {obj.type === "door" && (
                <>
                  <rect x={obj.x - 26} y={obj.y - 54} width="52" height="84" rx="4"
                    fill="#0a0a0a" stroke={obj.available ? glowColor + "88" : "#22222288"} strokeWidth={isHov ? 2 : 1} />
                  <rect x={obj.x - 19} y={obj.y - 47} width="38" height="70" rx="2" fill="#050505" opacity="0.8" />
                  <circle cx={obj.x + 12} cy={obj.y + 8} r="4"
                    fill={obj.available ? (obj.isExit ? "#10b981" : "#f59e0b") : "#333"} />
                  {obj.isExit && obj.available && (
                    <circle cx={obj.x + 12} cy={obj.y + 8} r="8" fill="#10b981" opacity="0.2">
                      <animate attributeName="r" values="6;12;6" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <text x={obj.x} y={obj.y - 12} textAnchor="middle" fontSize="18">{obj.icon}</text>
                </>
              )}

              {/* ITEM (torch) */}
              {obj.type === "item" && (
                <>
                  <text x={obj.x} y={obj.y + 8} textAnchor="middle" fontSize="26">{obj.icon}</text>
                  {!obj.done && (
                    <circle cx={obj.x} cy={obj.y - 14} r="16" fill={glowColor} opacity="0.08">
                      <animate attributeName="r" values="14;20;14" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}
                </>
              )}

              {/* Hover tooltip */}
              {isHov && (
                <g>
                  <rect x={obj.x - 50} y={obj.y - 84} width="100" height="20" rx="10" fill={obj.available ? glowColor : "#333"} opacity={obj.available ? 0.9 : 0.7} />
                  <text x={obj.x} y={obj.y - 70} textAnchor="middle" fill="#fff" fontSize="9" fontFamily="monospace">
                    {obj.label.length > 18 ? obj.label.slice(0, 18) + "…" : obj.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Collectible rewards floating above solved puzzles */}
        {roomId === "cipher" && gs.solved.has("codeLock") && !gs.inv.has("redKey") && (
          <g style={{ cursor: "pointer" }} onClick={() => onAction({ id: "collectRed", type: "collect", item: "redKey" })}>
            <circle cx="190" cy="118" r="16" fill="#ef444422" stroke="#ef444466" strokeWidth="1.5" />
            <text x="190" y="124" textAnchor="middle" fontSize="16">🔑</text>
            <animate attributeName="opacity" values="0.7;1;0.7" dur="1.2s" repeatCount="indefinite" />
          </g>
        )}
        {roomId === "cipher" && gs.solved.has("logicPuzzle") && !gs.inv.has("notebook") && (
          <g style={{ cursor: "pointer" }} onClick={() => onAction({ id: "collectNotebook", type: "collect", item: "notebook" })}>
            <circle cx="400" cy="118" r="16" fill="#8b5cf622" stroke="#8b5cf666" strokeWidth="1.5" />
            <text x="400" y="124" textAnchor="middle" fontSize="16">📓</text>
          </g>
        )}
        {roomId === "vault" && gs.solved.has("keyMatch") && !gs.inv.has("blueKey") && (
          <g style={{ cursor: "pointer" }} onClick={() => onAction({ id: "collectBlue", type: "collect", item: "blueKey" })}>
            <circle cx="260" cy="108" r="16" fill="#3b82f622" stroke="#3b82f666" strokeWidth="1.5" />
            <text x="260" y="114" textAnchor="middle" fontSize="16">🔵</text>
          </g>
        )}
        {roomId === "vault" && gs.solved.has("keyMatch") && !gs.inv.has("greenKey") && (
          <g style={{ cursor: "pointer" }} onClick={() => onAction({ id: "collectGreen", type: "collect", item: "greenKey" })}>
            <circle cx="360" cy="108" r="16" fill="#10b98122" stroke="#10b98166" strokeWidth="1.5" />
            <text x="360" y="114" textAnchor="middle" fontSize="16">🟢</text>
          </g>
        )}

        {/* Character */}
        {roomId !== "exit" && (
          <g transform={`translate(${charX}, 0)`} style={{ transition: "transform 0.7s cubic-bezier(0.25,0.46,0.45,0.94)" }}>
            <ellipse cx="0" cy="228" rx="13" ry="4" fill="#000" opacity="0.5" />
            {/* Legs */}
            <line x1="-5" y1="200" x2={walking ? -14 : -8} y2="226" stroke="#4c1d95" strokeWidth="7" strokeLinecap="round" />
            <line x1="5" y1="200" x2={walking ? 14 : 8} y2="226" stroke="#4c1d95" strokeWidth="7" strokeLinecap="round" />
            {/* Body */}
            <rect x="-12" y="172" width="24" height="30" rx="4" fill={walking ? "#5b21b6" : "#7c3aed"} />
            {/* Arms */}
            <line x1="-12" y1="178" x2={walking ? -24 : -20} y2="196" stroke="#6d28d9" strokeWidth="6" strokeLinecap="round" />
            <line x1="12" y1="178" x2={walking ? 24 : 20} y2="196" stroke="#6d28d9" strokeWidth="6" strokeLinecap="round" />
            {/* Neck */}
            <rect x="-4" y="162" width="8" height="12" rx="2" fill="#f9c784" />
            {/* Head */}
            <circle cx="0" cy="155" r="13" fill="#f9c784" />
            {/* Hair */}
            <ellipse cx="0" cy="143" rx="12" ry="6" fill="#2d1b4e" />
            {/* Eyes */}
            <circle cx="-4" cy="153" r="2.5" fill="#1a1025" />
            <circle cx="4" cy="153" r="2.5" fill="#1a1025" />
            <circle cx="-3" cy="152" r="1" fill="#fff" />
            <circle cx="5" cy="152" r="1" fill="#fff" />
            {/* Mouth */}
            <path d="M-3 159 Q0 162 3 159" stroke="#6b4226" strokeWidth="1.2" fill="none" />
            {/* Inventory badge */}
            {gs.inv.size > 0 && (
              <>
                <circle cx="16" cy="162" r="9" fill="#7c3aed" />
                <text x="16" y="166" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">{gs.inv.size}</text>
              </>
            )}
          </g>
        )}

        {/* AI progress bar */}
        {aiProgress > 0 && (
          <g>
            <rect x="14" y="275" width="572" height="6" rx="3" fill="#ffffff08" />
            <rect x="14" y="275" width={572 * aiProgress} height="6" rx="3" fill={acc} opacity="0.7" />
          </g>
        )}
      </svg>

      {/* Clue strip */}
      <div style={{ background: acc + "14", borderTop: `1px solid ${acc}33`, padding: "8px 14px", fontSize: 11, color: "#888", fontStyle: "italic", fontFamily: "monospace" }}>
        💬 {rc.clue}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PUZZLES
// ─────────────────────────────────────────────────────────────
const ov = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
const md = (borderColor) => ({ background: "#0d0d1a", border: `2px solid ${borderColor}`, borderRadius: 16, padding: 24, maxWidth: 380, width: "100%", fontFamily: "monospace", maxHeight: "90vh", overflowY: "auto" });
const Btn = ({ color, children, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled}
    style={{ display: "block", width: "100%", background: color + "22", color, border: `1px solid ${color}66`, borderRadius: 8, padding: "10px 16px", cursor: disabled ? "not-allowed" : "pointer", fontSize: 13, fontFamily: "monospace", letterSpacing: 1, opacity: disabled ? 0.4 : 1 }}>
    {children}
  </button>
);

function PuzzleCode({ onSolve, onClose }) {
  const [digits, setDigits] = useState([1, 1, 1]);
  const [status, setStatus] = useState("idle"); // idle | wrong | solved
  const [attempts, setAttempts] = useState(0);
  const [spinning, setSpinning] = useState([false, false, false]);
  const [showHint, setShowHint] = useState(false);

  const spin = (i, dir) => {
    if (status === "solved") return;
    setSpinning(s => { const n=[...s]; n[i]=true; return n; });
    setTimeout(() => setSpinning(s => { const n=[...s]; n[i]=false; return n; }), 180);
    setDigits(d => {
      const n = [...d];
      n[i] = ((n[i] - 1 + dir + 9) % 9) + 1;
      return n;
    });
    setStatus("idle");
  };

  const check = () => {
    if (digits[0]===CODE_SOLUTION[0] && digits[1]===CODE_SOLUTION[1] && digits[2]===CODE_SOLUTION[2]) {
      setStatus("solved");
      setTimeout(onSolve, 1200);
    } else {
      setStatus("wrong");
      setAttempts(a => a + 1);
      setTimeout(() => setStatus("idle"), 700);
      if (attempts >= 1) setShowHint(true);
    }
  };

  const W = 360, H = 300;
  const DRUM_W = 80, DRUM_H = 100, GAP = 20;
  const totalW = 3 * DRUM_W + 2 * GAP;
  const startX = (W - totalW) / 2;

  const drumX = i => startX + i * (DRUM_W + GAP) + DRUM_W / 2;

  // Constraint feedback per digit
  const sumOk = digits.reduce((a,b)=>a+b,0) === 15;
  const allDiff = new Set(digits).size === 3;
  const firstOdd = digits[0] % 2 === 1;
  const allOk = sumOk && allDiff && firstOdd;

  return (
    <div style={ov}>
      <div style={{ ...md("#d97706"), maxWidth: 420, padding: "20px 20px 16px" }}>

        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#d97706", letterSpacing: 2 }}>🔐 TUMBLER LOCK</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>CSP — spin the dials to satisfy all constraints</div>
        </div>

        {/* SVG lock face */}
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
          {/* Lock body */}
          <rect x="10" y="30" width={W-20} height={H-50} rx="16"
            fill="#120b00" stroke={status==="solved"?"#10b981":status==="wrong"?"#ef4444":"#d9770655"}
            strokeWidth={status!=="idle"?"2.5":"1.5"} />

          {/* Shackle */}
          <path d={`M ${W/2-30} 30 Q ${W/2-30} 8 ${W/2} 8 Q ${W/2+30} 8 ${W/2+30} 30`}
            fill="none" stroke={status==="solved"?"#10b981":"#d97706"} strokeWidth="8" strokeLinecap="round" />

          {/* Brand plate */}
          <rect x={W/2-45} y="44" width="90" height="18" rx="4" fill="#1a1000" stroke="#d9770633" strokeWidth="1"/>
          <text x={W/2} y="57" textAnchor="middle" fill="#d97706" fontSize="9" fontFamily="monospace" opacity="0.7">CSP-3000</text>

          {/* Drums */}
          {digits.map((val, i) => {
            const cx = drumX(i);
            const cy = 170;
            const isSpinning = spinning[i];
            const isWrong = status==="wrong";
            const isSolved = status==="solved";
            const drumColor = isSolved ? "#10b981" : isWrong ? "#ef4444" : "#d97706";

            // Show prev and next digits faded above/below
            const prev = ((val - 2 + 9) % 9) + 1;
            const next = (val % 9) + 1;

            return (
              <g key={i}>
                {/* Drum shadow */}
                <rect x={cx - DRUM_W/2 + 4} y={cy - DRUM_H/2 + 4} width={DRUM_W} height={DRUM_H} rx="8" fill="#000" opacity="0.5" />

                {/* Drum body */}
                <rect x={cx - DRUM_W/2} y={cy - DRUM_H/2} width={DRUM_W} height={DRUM_H} rx="8"
                  fill={isSolved?"#002010":isWrong?"#1a0000":"#1a1000"}
                  stroke={drumColor} strokeWidth={isWrong||isSolved?"2":"1.5"} />

                {/* Ridges on drum */}
                {[-3,-1,1,3].map(r => (
                  <line key={r} x1={cx - DRUM_W/2 + 6} y1={cy + r*12} x2={cx + DRUM_W/2 - 6} y2={cy + r*12}
                    stroke={drumColor} strokeWidth="0.5" opacity="0.2" />
                ))}

                {/* Ghost digits above/below */}
                <text x={cx} y={cy - 28} textAnchor="middle" fill={drumColor} fontSize="20" fontFamily="monospace"
                  opacity={isSpinning ? 0.1 : 0.2}>{prev}</text>
                <text x={cx} y={cy + 44} textAnchor="middle" fill={drumColor} fontSize="20" fontFamily="monospace"
                  opacity={isSpinning ? 0.1 : 0.2}>{next}</text>

                {/* Selection window */}
                <rect x={cx - 26} y={cy - 22} width="52" height="44" rx="6"
                  fill={drumColor} opacity={isSolved?0.2:isWrong?0.15:0.1}
                  stroke={drumColor} strokeWidth="1.5" />

                {/* Main digit */}
                <text x={cx} y={cy + 13} textAnchor="middle"
                  fill={isSolved?"#10b981":isWrong?"#ef4444":"#fff"}
                  fontSize="38" fontFamily="monospace" fontWeight="bold"
                  style={{ transition: isSpinning ? "none" : "all 0.15s" }}>
                  {val}
                </text>

                {/* Up/down buttons */}
                <g style={{ cursor: "pointer" }} onClick={() => spin(i, 1)}>
                  <rect x={cx-24} y={cy-DRUM_H/2-24} width="48" height="22" rx="6"
                    fill="#d97706" opacity="0.15" stroke="#d97706" strokeWidth="0.8" />
                  <text x={cx} y={cy-DRUM_H/2-8} textAnchor="middle" fill="#d97706" fontSize="14">▲</text>
                </g>
                <g style={{ cursor: "pointer" }} onClick={() => spin(i, -1)}>
                  <rect x={cx-24} y={cy+DRUM_H/2+2} width="48" height="22" rx="6"
                    fill="#d97706" opacity="0.15" stroke="#d97706" strokeWidth="0.8" />
                  <text x={cx} y={cy+DRUM_H/2+16} textAnchor="middle" fill="#d97706" fontSize="14">▼</text>
                </g>
              </g>
            );
          })}

          {/* Constraint status bar */}
          {[
            { ok: firstOdd, label: "D1 odd" },
            { ok: allDiff,  label: "All ≠"  },
            { ok: sumOk,    label: `Sum=${digits.reduce((a,b)=>a+b,0)}/15` },
          ].map(({ ok, label }, i) => (
            <g key={i} transform={`translate(${startX + i * 110 + 18}, ${H-30})`}>
              <rect x="-2" y="-12" width="84" height="20" rx="4"
                fill={ok?"#10b98120":"#ef444410"} stroke={ok?"#10b98166":"#ef444433"} strokeWidth="1" />
              <circle r="5" cx="8" cy="-2" fill={ok?"#10b981":"#ef4444"} opacity="0.9" />
              <text x="18" y="2" fill={ok?"#10b981":"#ef4444"} fontSize="10" fontFamily="monospace">{label}</text>
            </g>
          ))}

          {/* Wrong flash overlay */}
          {status==="wrong" && (
            <rect x="10" y="30" width={W-20} height={H-50} rx="16" fill="#ef4444" opacity="0.06" />
          )}
          {/* Solved flash */}
          {status==="solved" && (
            <g>
              <rect x="10" y="30" width={W-20} height={H-50} rx="16" fill="#10b981" opacity="0.08" />
              <text x={W/2} y={H/2+10} textAnchor="middle" fill="#10b981" fontSize="22" fontFamily="monospace">✓ UNLOCKED</text>
            </g>
          )}
        </svg>

        {/* Check button */}
        {status !== "solved" && (
          <Btn color={allOk?"#10b981":"#d97706"} onClick={check}>
            {allOk ? "✓ CONSTRAINTS MET — UNLOCK" : "TRY COMBINATION"}
          </Btn>
        )}

        {/* Hint panel */}
        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => setShowHint(h=>!h)}
            style={{ background:"transparent",border:"1px solid #d9770644",borderRadius:6,padding:"4px 10px",color:"#d97706",fontSize:10,cursor:"pointer",fontFamily:"monospace" }}>
            {showHint?"hide hint":"💡 hint"}
          </button>
          <button onClick={onClose}
            style={{ background:"transparent",border:"1px solid #333",borderRadius:6,padding:"4px 10px",color:"#444",fontSize:10,cursor:"pointer",fontFamily:"monospace" }}>
            ✕ close
          </button>
        </div>
        {showHint && (
          <div style={{ marginTop: 8, background:"#0a0a0f",borderRadius:8,padding:10,fontSize:11,color:"#555",lineHeight:1.9 }}>
            <div style={{ color:"#7c3aed",marginBottom:3 }}>🤖 CSP backtracking trace:</div>
            d1 must be odd → try 1,3,5,7,9<br/>
            d1=1: need d2+d3=14, both ≠ 1 and ≠ each other<br/>
            d1=1, d2=5: d3=9 → 1≠5≠9 ✓ sum=15 ✓<br/>
            <span style={{ color:"#d97706" }}>Solution: {CODE_SOLUTION.join(" – ")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PuzzleLogic({ onSolve, onClose }) {
  // Tokens are dragged from a tray into box slots
  // Constraints shown as glowing clue cables between boxes and rules
  const COLORS = {
    red:   { hex: "#ef4444", dark: "#7f1d1d", label: "Red"   },
    blue:  { hex: "#3b82f6", dark: "#1e3a5f", label: "Blue"  },
    green: { hex: "#10b981", dark: "#064e3b", label: "Green" },
  };
  const BOXES = ["A", "B", "C"];

  const [slots, setSlots]       = useState({ A: null, B: null, C: null });
  const [dragging, setDragging] = useState(null); // color key being dragged
  const [dragPos, setDragPos]   = useState({ x: 0, y: 0 });
  const [violated, setViolated] = useState([]); // constraint ids that flash
  const [solved, setSolved]     = useState(false);
  const [shake, setShake]       = useState(false);
  const svgRef = useRef(null);

  const W = 400, H = 340;

  const getSVGXY = (e) => {
    const svg = svgRef.current; if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (cx - r.left) * W / r.width, y: (cy - r.top) * H / r.height };
  };

  const onMouseMove = (e) => { if (dragging) setDragPos(getSVGXY(e)); };

  const onMouseUp = (e) => {
    if (!dragging) return;
    const { x, y } = getSVGXY(e);
    // Check if over a box slot
    const hitBox = BOXES.find(b => {
      const bx = boxX(b), by = BOX_Y;
      return x > bx - 32 && x < bx + 32 && y > by - 32 && y < by + 32;
    });
    if (hitBox) {
      setSlots(s => {
        const n = { ...s };
        // Remove this color from wherever it was
        Object.keys(n).forEach(k => { if (n[k] === dragging) n[k] = null; });
        // If slot occupied, swap: put its token back to tray (null)
        n[hitBox] = dragging;
        return n;
      });
    }
    setDragging(null);
    setViolated([]);
  };

  const BOX_Y = 185;
  const boxX = b => ({ A: 90, B: 200, C: 310 }[b]);

  // Tray positions (bottom)
  const trayColors = Object.keys(COLORS);
  const trayX = (i) => 100 + i * 100;
  const TRAY_Y = 295;

  // Which colors are still in the tray (not placed)
  const placed = new Set(Object.values(slots).filter(Boolean));
  const inTray = trayColors.filter(c => !placed.has(c));

  const checkConstraints = () => {
    const { A, B, C } = slots;
    if (!A || !B || !C) {
      setShake(true); setTimeout(() => setShake(false), 500); return;
    }
    const v = [];
    if (A === "red") v.push("c1");
    if (C === "blue") v.push("c2");
    if (new Set([A,B,C]).size < 3) v.push("allDiff");
    if (v.length === 0) { setSolved(true); setTimeout(onSolve, 1100); }
    else {
      setViolated(v);
      setShake(true);
      setTimeout(() => { setShake(false); setViolated([]); }, 900);
    }
  };

  const allFilled = slots.A && slots.B && slots.C;

  // Constraint positions for drawing wires
  const constraints = [
    { id: "c1", label: "Red ≠ A", x: 40, y: 120, targets: ["A"], color: COLORS.red.hex },
    { id: "c2", label: "Blue ≠ C", x: 360, y: 120, targets: ["C"], color: COLORS.blue.hex },
  ];

  return (
    <div style={ov}>
      <div style={{ ...md("#7c3aed"), maxWidth: 440, padding: "18px 18px 14px" }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#7c3aed", letterSpacing: 2 }}>🧠 LOGIC BOARD</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>CSP — drag colour tokens into boxes, satisfy all constraints</div>
        </div>

        <div style={{ transform: shake ? "translateX(6px)" : "none", transition: "transform 0.08s" }}>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%"
            style={{ display: "block", touchAction: "none", cursor: dragging ? "grabbing" : "default" }}
            onMouseMove={onMouseMove} onMouseUp={onMouseUp}
            onTouchMove={onMouseMove} onTouchEnd={onMouseUp}>

            {/* Background */}
            <rect width={W} height={H} fill="#080814" rx="12" />

            {/* Grid faint */}
            {[1,2,3].map(i=><line key={i} x1={i*100} y1="0" x2={i*100} y2={H} stroke="#7c3aed0a" strokeWidth="0.5"/>)}
            {[1,2,3].map(i=><line key={i} x1="0" y1={i*85} x2={W} y2={i*85} stroke="#7c3aed0a" strokeWidth="0.5"/>)}

            {/* Constraint rule cards */}
            {constraints.map(c => {
              const isViolated = violated.includes(c.id);
              return (
                <g key={c.id}>
                  <rect x={c.x - 44} y={c.y - 18} width="88" height="36" rx="8"
                    fill={isViolated ? c.color+"22" : "#0d0d1a"}
                    stroke={isViolated ? c.color : c.color+"55"}
                    strokeWidth={isViolated ? "2" : "1"} />
                  <text x={c.x} y={c.y - 4} textAnchor="middle" fill={c.color} fontSize="10" fontFamily="monospace" fontWeight="bold">RULE</text>
                  <text x={c.x} y={c.y + 10} textAnchor="middle" fill={isViolated ? c.color : "#888"} fontSize="11" fontFamily="monospace">{c.label}</text>
                  {/* Wire from constraint to target box */}
                  {c.targets.map(t => {
                    const tx = boxX(t), ty = BOX_Y;
                    const mx = (c.x + tx) / 2;
                    return (
                      <path key={t}
                        d={`M ${c.x} ${c.y + 18} C ${c.x} ${ty - 30}, ${tx} ${c.y + 18}, ${tx} ${ty - 38}`}
                        fill="none" stroke={isViolated ? c.color : c.color + "44"}
                        strokeWidth={isViolated ? "2" : "1"}
                        strokeDasharray={isViolated ? "none" : "5 4"}
                        strokeLinecap="round" />
                    );
                  })}
                  {/* AllDiff label */}
                  {c.id === "c1" && (
                    <text x={W/2} y="38" textAnchor="middle" fill={violated.includes("allDiff")?"#f59e0b":"#444"} fontSize="10" fontFamily="monospace">
                      {violated.includes("allDiff") ? "✗ all boxes must differ!" : "all boxes must differ"}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Box slots */}
            {BOXES.map(b => {
              const bx = boxX(b), by = BOX_Y;
              const token = slots[b];
              const col = token ? COLORS[token] : null;
              const isVio = (violated.includes("c1") && b==="A" && token==="red") ||
                            (violated.includes("c2") && b==="C" && token==="blue") ||
                            (violated.includes("allDiff") && token);
              return (
                <g key={b}>
                  {/* Platform */}
                  <rect x={bx-40} y={by+36} width="80" height="8" rx="4" fill="#1a1a2e" />
                  {/* Slot housing */}
                  <rect x={bx-36} y={by-38} width="72" height="72" rx="10"
                    fill={token ? col.dark + "88" : "#0d0d1a"}
                    stroke={isVio?"#ef4444":token?"#7c3aed66":"#2a2a44"}
                    strokeWidth={isVio?"2":"1.5"}
                    strokeDasharray={!token?"6 4":"none"} />
                  {/* Box label */}
                  <text x={bx} y={by - 46} textAnchor="middle" fill="#7c3aed" fontSize="22" fontFamily="monospace" fontWeight="bold">{b}</text>
                  {/* Token in slot */}
                  {token && (
                    <g>
                      <circle cx={bx} cy={by} r="22"
                        fill={col.hex} opacity={solved ? 1 : 0.85} />
                      <circle cx={bx} cy={by} r="14" fill={col.dark} opacity="0.6" />
                      <text x={bx} y={by+4} textAnchor="middle" fill="#fff" fontSize="10" fontFamily="monospace">{col.label}</text>
                      {/* Remove button */}
                      {!solved && (
                        <g style={{ cursor: "pointer" }} onClick={() => setSlots(s=>({...s,[b]:null}))}>
                          <circle cx={bx+18} cy={by-18} r="8" fill="#ef4444" opacity="0.9" />
                          <text x={bx+18} y={by-14} textAnchor="middle" fill="#fff" fontSize="10">×</text>
                        </g>
                      )}
                    </g>
                  )}
                  {/* Empty slot hint */}
                  {!token && (
                    <text x={bx} y={by+5} textAnchor="middle" fill="#2a2a44" fontSize="11" fontFamily="monospace">drop here</text>
                  )}
                  {/* Solved checkmark */}
                  {solved && token && (
                    <g>
                      <circle cx={bx} cy={by} r="26" fill="#10b981" opacity="0.15" />
                      <text x={bx} y={by+4} textAnchor="middle" fill="#10b981" fontSize="14">✓</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Tray label */}
            <text x={W/2} y="258" textAnchor="middle" fill="#333" fontSize="10" fontFamily="monospace" letterSpacing="2">COLOUR TOKENS</text>
            <line x1="60" y1="262" x2="160" y2="262" stroke="#333" strokeWidth="0.5" />
            <line x1="240" y1="262" x2="340" y2="262" stroke="#333" strokeWidth="0.5" />

            {/* Token tray */}
            {trayColors.map((c, i) => {
              const col = COLORS[c];
              const tx = trayX(i), ty = TRAY_Y;
              const isInTray = inTray.includes(c);
              const isDraggingThis = dragging === c;
              return (
                <g key={c} opacity={isInTray ? 1 : 0.2}>
                  {isInTray && (
                    <g style={{ cursor: "grab" }}
                      onMouseDown={e => { e.preventDefault(); setDragging(c); setDragPos(getSVGXY(e)); }}
                      onTouchStart={e => { e.preventDefault(); setDragging(c); setDragPos(getSVGXY(e)); }}>
                      {/* Tray pedestal */}
                      <rect x={tx-24} y={ty+20} width="48" height="6" rx="3" fill="#1a1a2e" />
                      {/* Token */}
                      <circle cx={tx} cy={ty} r="20" fill={col.hex} opacity={isDraggingThis?0.4:0.9} />
                      <circle cx={tx} cy={ty} r="13" fill={col.dark} opacity="0.7" />
                      <text x={tx} y={ty+4} textAnchor="middle" fill="#fff" fontSize="10" fontFamily="monospace">{col.label}</text>
                      {/* Grab hint pulse */}
                      {!isDraggingThis && (
                        <circle cx={tx} cy={ty} r="22" fill="none" stroke={col.hex} strokeWidth="1" opacity="0.4">
                          <animate attributeName="r" values="22;28;22" dur="2s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                        </circle>
                      )}
                    </g>
                  )}
                  {!isInTray && (
                    <g>
                      <circle cx={tx} cy={ty} r="20" fill="#111" stroke="#222" strokeWidth="1" strokeDasharray="4 3" />
                      <text x={tx} y={ty+4} textAnchor="middle" fill="#333" fontSize="10" fontFamily="monospace">placed</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Dragging ghost token */}
            {dragging && (() => {
              const col = COLORS[dragging];
              return (
                <g transform={`translate(${dragPos.x},${dragPos.y})`} style={{ pointerEvents: "none" }}>
                  <circle r="22" fill={col.hex} opacity="0.9" />
                  <circle r="14" fill={col.dark} opacity="0.7" />
                  <text y="4" textAnchor="middle" fill="#fff" fontSize="10" fontFamily="monospace">{col.label}</text>
                </g>
              );
            })()}

            {/* Solved overlay */}
            {solved && (
              <g>
                <rect width={W} height={H} fill="#10b981" opacity="0.06" rx="12" />
                <text x={W/2} y={H/2} textAnchor="middle" fill="#10b981" fontSize="18" fontFamily="monospace">✓ CONSTRAINTS SATISFIED</text>
              </g>
            )}
          </svg>
        </div>

        {!solved && (
          <Btn color={allFilled ? "#10b981" : "#7c3aed"} onClick={checkConstraints}>
            {!allFilled ? `Place ${Object.values(slots).filter(Boolean).length}/3 tokens first` : "✓ VERIFY SOLUTION"}
          </Btn>
        )}

        <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontSize: 10, color: "#333" }}>Drag tokens · click × to remove · satisfy both rules</div>
          <button onClick={onClose} style={{ background:"transparent",border:"1px solid #222",borderRadius:6,padding:"4px 10px",color:"#444",fontSize:10,cursor:"pointer",fontFamily:"monospace" }}>✕ close</button>
        </div>
      </div>
    </div>
  );
}

function PuzzleKeys({ onSolve, onClose }) {
  // Keys are shown in shuffled order; locks are always in fixed order 1-2-3
  // Player must figure out which key shape fits which lock shape
  // Each key/lock has a unique SHAPE CODE as the real matching cue
  const KEYS = [
    { id: "redKey",   color: "#ef4444", label: "Red",   shape: "diamond", lockId: 0 },
    { id: "blueKey",  color: "#3b82f6", label: "Blue",  shape: "circle",  lockId: 1 },
    { id: "greenKey", color: "#10b981", label: "Green", shape: "hex",     lockId: 2 },
  ];
  // Locks shown in scrambled order so it's not trivially positional
  const LOCK_ORDER = [1, 2, 0]; // blue-lock, green-lock, red-lock
  const LOCKS = LOCK_ORDER.map(i => KEYS[i]);

  // Key order is also shuffled
  const KEY_ORDER = [2, 0, 1]; // green, red, blue
  const KEYS_SHOWN = KEY_ORDER.map(i => KEYS[i]);

  const [connections, setConnections] = useState({}); // keyId → lockIndex
  const [dragging, setDragging] = useState(null);     // keyId being dragged
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [errors, setErrors]     = useState({});       // lockIndex → flash timer
  const [sparks, setSparks]     = useState([]);        // wrong-match spark positions
  const [verified, setVerified] = useState(false);
  const [shake, setShake]       = useState(false);
  const svgRef = useRef(null);

  // Layout constants
  const W = 400, H = 320;
  const KEY_X = 80,  LOCK_X = 320;
  const ROWS  = [80, 160, 240];

  const keyPos  = (ki) => ({ x: KEY_X,  y: ROWS[ki] });
  const lockPos = (li) => ({ x: LOCK_X, y: ROWS[li] });

  const getSVGCoords = (e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    setMousePos(getSVGCoords(e));
  };

  const handleMouseUp = (e) => {
    if (!dragging) return;
    const { x, y } = getSVGCoords(e);
    // Check if dropped near a lock
    let hit = -1;
    LOCKS.forEach((_, li) => {
      const lp = lockPos(li);
      if (Math.abs(x - lp.x) < 38 && Math.abs(y - lp.y) < 38) hit = li;
    });
    if (hit >= 0) {
      const targetLock = LOCKS[hit];
      const dragKey = KEYS.find(k => k.id === dragging);
      // Remove any existing connection to this lock
      const newConns = { ...connections };
      // Remove dragging key's old connection
      delete newConns[dragging];
      // Check if lock already has a key connected — disconnect it
      Object.keys(newConns).forEach(kid => { if (newConns[kid] === hit) delete newConns[kid]; });
      newConns[dragging] = hit;
      setConnections(newConns);
      // Check correctness of this individual connection
      if (dragKey.lockId !== LOCK_ORDER[hit]) {
        // Wrong! — flash error spark
        const lp = lockPos(hit);
        const spark = { id: Date.now(), x: lp.x, y: lp.y };
        setSparks(s => [...s, spark]);
        setTimeout(() => setSparks(s => s.filter(sp => sp.id !== spark.id)), 700);
        setErrors(er => ({ ...er, [hit]: true }));
        setTimeout(() => setErrors(er => { const n = { ...er }; delete n[hit]; return n; }), 600);
      }
    }
    setDragging(null);
  };

  const verify = () => {
    // All 3 must be connected AND correct
    const allConnected = KEYS.every(k => connections[k.id] !== undefined);
    if (!allConnected) { setShake(true); setTimeout(() => setShake(false), 500); return; }
    const allCorrect = KEYS.every(k => LOCK_ORDER[connections[k.id]] === k.lockId);
    if (allCorrect) { setVerified(true); setTimeout(onSolve, 1100); }
    else {
      setShake(true); setTimeout(() => setShake(false), 500);
      // Flash all wrong connections
      KEYS.forEach(k => {
        if (connections[k.id] !== undefined && LOCK_ORDER[connections[k.id]] !== k.lockId) {
          const lp = lockPos(connections[k.id]);
          const spark = { id: Date.now() + k.id, x: lp.x, y: lp.y };
          setSparks(s => [...s, spark]);
          setTimeout(() => setSparks(s => s.filter(sp => sp.id !== spark.id)), 700);
        }
      });
    }
  };

  // Draw key shape SVG path centred at 0,0
  const KeyShape = ({ shape, color, size = 18, filled = false }) => {
    const s = size;
    if (shape === "diamond") return (
      <polygon points={`0,${-s} ${s*0.7},0 0,${s} ${-s*0.7},0`}
        fill={filled ? color : "none"} stroke={color} strokeWidth="2.5" />
    );
    if (shape === "circle") return (
      <circle r={s * 0.8} fill={filled ? color : "none"} stroke={color} strokeWidth="2.5" />
    );
    if (shape === "hex") {
      const pts = Array.from({length:6},(_,i)=>{
        const a = Math.PI/180*(60*i - 30);
        return `${s*Math.cos(a)},${s*Math.sin(a)}`;
      }).join(" ");
      return <polygon points={pts} fill={filled ? color : "none"} stroke={color} strokeWidth="2.5" />;
    }
    return null;
  };

  const connectedCount = Object.keys(connections).length;
  const allCorrect = connectedCount === 3 && KEYS.every(k => connections[k.id] !== undefined && LOCK_ORDER[connections[k.id]] === k.lockId);

  return (
    <div style={ov}>
      <div style={{ ...md("#0891b2"), maxWidth: 460, padding: "20px 20px 16px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0891b2", letterSpacing: 2 }}>🔌 WIRE THE VAULT</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>Drag each key shape to its matching lock — shapes must match</div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 10 }}>
          {[{shape:"diamond",label:"◆ Diamond"},{shape:"circle",label:"● Circle"},{shape:"hex",label:"⬡ Hex"}].map(({shape,label})=>(
            <div key={shape} style={{ display:"flex",alignItems:"center",gap:5,fontSize:10,color:"#444" }}>
              <svg width="14" height="14" viewBox="-9 -9 18 18">
                <KeyShape shape={shape} color="#666" size={7} />
              </svg>
              {label}
            </div>
          ))}
        </div>

        {/* Main SVG puzzle board */}
        <div style={{ transform: shake ? "translateX(7px)" : "none", transition: "transform 0.08s" }}>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display:"block", cursor: dragging ? "grabbing" : "default", touchAction: "none" }}
            onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
            onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}>

            {/* Background panel */}
            <rect width={W} height={H} fill="#020c14" rx="10" />
            {/* Grid lines */}
            {[0,1,2,3].map(i=><line key={i} x1="0" y1={i*H/3} x2={W} y2={i*H/3} stroke="#0891b211" strokeWidth="0.5"/>)}
            <line x1={W/2} y1="0" x2={W/2} y2={H} stroke="#0891b211" strokeWidth="0.5" />

            {/* Column labels */}
            <text x={KEY_X} y="22" textAnchor="middle" fill="#0891b288" fontSize="10" fontFamily="monospace">KEYS</text>
            <text x={LOCK_X} y="22" textAnchor="middle" fill="#0891b288" fontSize="10" fontFamily="monospace">LOCKS</text>

            {/* Draw confirmed wires first (below everything) */}
            {KEYS.map(k => {
              const li = connections[k.id];
              if (li === undefined) return null;
              const kp = keyPos(KEY_ORDER.indexOf(KEY_ORDER.find(i => KEYS[i].id === k.id)));
              const ki = KEY_ORDER.findIndex(i => KEYS[i].id === k.id);
              const kpos = keyPos(ki);
              const lpos = lockPos(li);
              const isCorrect = LOCK_ORDER[li] === k.lockId;
              const wireColor = verified ? "#10b981" : isCorrect ? k.color : "#ef4444";
              const mx = (kpos.x + lpos.x) / 2;
              return (
                <path key={k.id}
                  d={`M ${kpos.x + 28} ${kpos.y} C ${mx} ${kpos.y}, ${mx} ${lpos.y}, ${lpos.x - 28} ${lpos.y}`}
                  fill="none" stroke={wireColor} strokeWidth="3" strokeLinecap="round"
                  opacity={verified ? 1 : isCorrect ? 0.9 : 0.5}
                  strokeDasharray={verified ? "none" : isCorrect ? "none" : "6 4"}
                />
              );
            })}

            {/* Active drag wire */}
            {dragging && (() => {
              const ki = KEY_ORDER.findIndex(i => KEYS[i].id === dragging);
              const kpos = keyPos(ki);
              const dragKey = KEYS.find(k => k.id === dragging);
              return (
                <path
                  d={`M ${kpos.x + 28} ${kpos.y} C ${(kpos.x+mousePos.x)/2} ${kpos.y}, ${(kpos.x+mousePos.x)/2} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`}
                  fill="none" stroke={dragKey?.color || "#fff"} strokeWidth="2.5" strokeLinecap="round" opacity="0.8"
                  strokeDasharray="8 4"
                />
              );
            })()}

            {/* LOCK slots (right side) */}
            {LOCKS.map((lockKey, li) => {
              const lp = lockPos(li);
              const isError = errors[li];
              const connectedKeyId = Object.keys(connections).find(kid => connections[kid] === li);
              const connectedKey = connectedKeyId ? KEYS.find(k => k.id === connectedKeyId) : null;
              const isMatched = connectedKey && LOCK_ORDER[li] === connectedKey.lockId;
              return (
                <g key={li} transform={`translate(${lp.x}, ${lp.y})`}>
                  {/* Lock housing */}
                  <rect x="-30" y="-38" width="60" height="60" rx="8"
                    fill={isError?"#ef444411":isMatched&&verified?"#10b98111":"#0d1a20"}
                    stroke={isError?"#ef4444":isMatched?"#10b981":"#0891b244"}
                    strokeWidth={isError||isMatched?"2":"1"} />
                  {/* Shackle */}
                  <path d="M -10 -20 Q -10 -38 0 -38 Q 10 -38 10 -20" fill="none"
                    stroke={isMatched?"#10b981":"#0891b266"} strokeWidth="3" strokeLinecap="round" />
                  {/* Keyhole shape */}
                  <circle cy="4" r="7" fill={isError?"#ef444433":isMatched?"#10b98133":"#0891b222"}
                    stroke={isError?"#ef4444":isMatched?"#10b981":"#0891b266"} strokeWidth="1.5" />
                  <rect x="-3" y="6" width="6" height="8" rx="1"
                    fill={isError?"#ef444433":isMatched?"#10b98133":"#0891b222"} />
                  {/* Shape indicator inside lock — this is the puzzle clue */}
                  <g transform="translate(0, 4)" opacity="0.9">
                    <KeyShape shape={lockKey.shape} color={isMatched?"#10b981":isError?"#ef4444":lockKey.color} size={5} filled={isMatched} />
                  </g>
                  {/* Lock number label */}
                  <text x="0" y="36" textAnchor="middle" fill={isMatched?"#10b981":"#444"} fontSize="9" fontFamily="monospace">LOCK {li+1}</text>
                  {/* Wire connector port */}
                  <circle cx="-34" cy="4" r="5" fill="#020c14" stroke={isMatched?"#10b981":"#0891b266"} strokeWidth="1.5" />
                  {isMatched && !verified && (
                    <circle cx="-34" cy="4" r="9" fill="#10b981" opacity="0.15" />
                  )}
                  {/* Verified checkmark */}
                  {verified && isMatched && (
                    <g>
                      <circle cx="18" cy="-30" r="9" fill="#10b981" />
                      <text x="18" y="-26" textAnchor="middle" fill="#fff" fontSize="10">✓</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* KEY pegs (left side) */}
            {KEYS_SHOWN.map((k, ki) => {
              const kp = keyPos(ki);
              const isDragging = dragging === k.id;
              const isConnected = connections[k.id] !== undefined;
              const li = connections[k.id];
              const isCorrectConn = li !== undefined && LOCK_ORDER[li] === k.lockId;
              return (
                <g key={k.id} transform={`translate(${kp.x}, ${kp.y})`}
                  style={{ cursor: verified ? "default" : "grab" }}
                  onMouseDown={e => { if (verified) return; e.preventDefault(); setDragging(k.id); setMousePos(getSVGCoords(e)); }}
                  onTouchStart={e => { if (verified) return; e.preventDefault(); setDragging(k.id); setMousePos(getSVGCoords(e)); }}>
                  {/* Key body */}
                  <rect x="-30" y="-38" width="60" height="60" rx="8"
                    fill={isDragging?"#111":isConnected?"#0d1a0d":"#0d1420"}
                    stroke={isDragging?k.color:isCorrectConn?"#10b981":k.color+"66"}
                    strokeWidth={isDragging?"2.5":isCorrectConn?"2":"1"} />
                  {/* Key bow (top circle) */}
                  <circle cy="-18" r="10" fill="none" stroke={k.color} strokeWidth="2.5" opacity={isDragging?1:0.8} />
                  <circle cy="-18" r="5" fill={k.color} opacity={isDragging?0.7:0.3} />
                  {/* Key blade (bottom) */}
                  <rect x="-3" y="-8" width="6" height="20" rx="1" fill={k.color} opacity={isDragging?0.8:0.5} />
                  {[6,13].map(y=><rect key={y} x="3" y={y-8} width="6" height="4" rx="1" fill={k.color} opacity={isDragging?0.8:0.5}/>)}
                  {/* Shape symbol — this is the MATCHING CUE */}
                  <g transform="translate(16, -2)">
                    <KeyShape shape={k.shape} color={k.color} size={7} filled={isDragging} />
                  </g>
                  {/* Color label */}
                  <text x="0" y="34" textAnchor="middle" fill={k.color} fontSize="9" fontFamily="monospace" opacity="0.8">{k.label}</text>
                  {/* Wire port */}
                  <circle cx="34" cy="4" r="5" fill="#020c14" stroke={isCorrectConn?"#10b981":k.color+"88"} strokeWidth="1.5" />
                  {/* Drag hint glow */}
                  {!isDragging && !isConnected && (
                    <circle cx="34" cy="4" r="9" fill={k.color} opacity="0.07">
                      <animate attributeName="r" values="7;12;7" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}
                </g>
              );
            })}

            {/* Sparks on wrong match */}
            {sparks.map(sp => (
              <g key={sp.id} transform={`translate(${sp.x}, ${sp.y})`}>
                {[0,45,90,135,180,225,270,315].map((angle,i)=>(
                  <line key={i}
                    x1="0" y1="0"
                    x2={Math.cos(angle*Math.PI/180)*18} y2={Math.sin(angle*Math.PI/180)*18}
                    stroke="#ef4444" strokeWidth="2" strokeLinecap="round" opacity="0.9">
                    <animate attributeName="opacity" values="0.9;0" dur="0.6s" fill="freeze" />
                    <animate attributeName="x2" values={`${Math.cos(angle*Math.PI/180)*18};${Math.cos(angle*Math.PI/180)*28}`} dur="0.6s" fill="freeze" />
                    <animate attributeName="y2" values={`${Math.sin(angle*Math.PI/180)*18};${Math.sin(angle*Math.PI/180)*28}`} dur="0.6s" fill="freeze" />
                  </line>
                ))}
              </g>
            ))}

            {/* Success flash */}
            {verified && (
              <rect width={W} height={H} fill="#10b981" opacity="0" rx="10">
                <animate attributeName="opacity" values="0;0.15;0" dur="1s" fill="freeze" />
              </rect>
            )}

            {/* Status bar */}
            <rect x="10" y={H-28} width={W-20} height="18" rx="4" fill="#ffffff06" />
            <rect x="10" y={H-28} width={(W-20)*(connectedCount/3)} height="18" rx="4" fill={allCorrect?"#10b981":"#0891b2"} opacity="0.4" />
            <text x={W/2} y={H-16} textAnchor="middle" fill={allCorrect?"#10b981":"#0891b2"} fontSize="9" fontFamily="monospace">
              {verified ? "✓ ALL MATCHED — UNLOCKED!" : `${connectedCount}/3 wired — ${allCorrect?"ready to verify!":"check the shapes"}`}
            </text>
          </svg>
        </div>

        {/* Verify button */}
        {!verified && (
          <div style={{ marginTop: 10 }}>
            <Btn color={connectedCount === 3 ? "#10b981" : "#0891b2"} onClick={verify}>
              {connectedCount < 3 ? `Wire all ${3 - connectedCount} remaining key(s) first` : "✓ VERIFY ALL CONNECTIONS"}
            </Btn>
          </div>
        )}

        <div style={{ marginTop: 8, display:"flex", gap:8, alignItems:"center", fontSize:10, color:"#333" }}>
          <div style={{ flex:1 }}>Match the shape on each key to the same shape on a lock, then hit verify.</div>
          <button onClick={onClose} style={{ background:"transparent",border:"1px solid #222",borderRadius:6,padding:"5px 10px",color:"#444",cursor:"pointer",fontSize:10,fontFamily:"monospace",whiteSpace:"nowrap" }}>✕ Close</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
const mkState = () => ({ room: "foyer", inv: new Set(), solved: new Set() });

export default function App() {
  const [gs, setGs] = useState(mkState());
  const [mode, setMode] = useState("menu");
  const [tab, setTab] = useState("game");
  const [puzzle, setPuzzle] = useState(null);
  const [log, setLog] = useState([]);
  const [aiAlgo, setAiAlgo] = useState("bfs");
  const [aiRes, setAiRes] = useState(null);
  const [aiStep, setAiStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [compareRes, setCompareRes] = useState(null);
  const [toast, setToast] = useState(null);
  const logRef = useRef(null); const autoRef = useRef(null);
  const audioRef = useRef(null);

    useEffect(() => {
    const startMusic = () => {
      if (audioRef.current) {
        audioRef.current.volume = 0.4;
        audioRef.current.play().catch(() => {});
      }
      window.removeEventListener("click", startMusic);
    };

    window.addEventListener("click", startMusic);
  }, []);

  const addLog = useCallback((msg, type = "info") => {
    setLog(p => [...p.slice(-80), { msg, type, id: Date.now() + Math.random() }]);
    setTimeout(() => logRef.current && (logRef.current.scrollTop = 99999), 30);
  }, []);

  const showToast = useCallback((msg, color = "#7c3aed") => {
    setToast({ msg, color }); setTimeout(() => setToast(null), 2000);
  }, []);

  const reset = useCallback(() => {
    setGs(mkState()); setLog([]); setAiRes(null); setAiStep(0);
    setAutoPlay(false); setPuzzle(null); setCompareRes(null);
  }, []);

  // Human action handler
  const handleAction = useCallback((obj) => {
    if (obj.type === "item") {
      setGs(s => ({ ...s, inv: new Set([...s.inv, obj.id]) }));
      addLog(`Picked up ${obj.id}`, "pickup");
      showToast(`+${ITEM_META[obj.id]?.icon} ${obj.id}`, ITEM_META[obj.id]?.color || "#f59e0b");
    } else if (obj.type === "collect") {
      setGs(s => ({ ...s, inv: new Set([...s.inv, obj.item]) }));
      addLog(`Collected ${obj.item}`, "pickup");
      showToast(`+${ITEM_META[obj.item]?.icon} ${obj.item}!`, ITEM_META[obj.item]?.color || "#10b981");
    } else if (obj.type === "door") {
      setGs(s => ({ ...s, room: obj.dest }));
      addLog(`Moved to ${ROOM_CONFIG[obj.dest]?.name}`, "move");
    } else if (obj.type === "puzzle") {
      setPuzzle(obj.id);
    }
  }, [addLog, showToast]);

  const solvePuzzle = useCallback((id) => {
    setGs(s => ({ ...s, solved: new Set([...s.solved, id]) }));
    addLog(`✓ Solved ${id}!`, "success");
    showToast(`✓ ${id} solved!`, "#10b981");
    setPuzzle(null);
  }, [addLog, showToast]);

  // AI controls
  const loadAI = useCallback(() => {
    if (audioRef.current) {
    audioRef.current.volume = 0.4;
    audioRef.current.play().catch(() => {});
  }
    const r = runAlgo(aiAlgo, mkState());
    setAiRes(r); setAiStep(0); setGs(mkState());
    addLog(`🤖 ${aiAlgo.toUpperCase()} → ${r.path.length} steps, ${r.explored.length} nodes, ${r.time}ms`, "ai");
    showToast(`${aiAlgo.toUpperCase()} ready!`, "#7c3aed");
  }, [aiAlgo, addLog, showToast]);

  const stepAI = useCallback(() => {
    if (!aiRes || aiStep >= aiRes.explored.length) return;
    const { state } = aiRes.explored[aiStep];
    setGs({ room: state.room, inv: new Set(state.inv), solved: new Set(state.solved) });
    addLog(`#${aiStep + 1} ${aiRes.explored[aiStep].action}`, "ai");
    setAiStep(s => s + 1);
  }, [aiRes, aiStep, addLog]);

  useEffect(() => {
    if (autoPlay && aiRes) {
      if (aiStep < aiRes.explored.length) { autoRef.current = setTimeout(stepAI, 550); }
      else { setAutoPlay(false); showToast("AI escaped! 🎉", "#10b981"); }
    }
    return () => clearTimeout(autoRef.current);
  }, [autoPlay, aiStep, aiRes, stepAI, showToast]);

  const runCompare = useCallback(() => {
    setCompareRes(["bfs","dfs","astar"].map(a => runAlgo(a, mkState())));
    addLog("📊 Comparison complete", "info");
  }, [addLog]);

  const acc = ROOM_CONFIG[gs.room]?.accent || "#7c3aed";

  // ── MENU ────────────────────────────────────────────────
  if (mode === "menu") return (
    <div style={{ background: "#080810", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", padding: 20 }}>
      <div style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
        {/* Hero art */}
        <svg viewBox="0 0 460 160" width="100%" style={{ marginBottom: 4 }}>
          <defs>
            <linearGradient id="tg" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7c3aed" /><stop offset="100%" stopColor="#0891b2" />
            </linearGradient>
          </defs>
          {/* Bg particles */}
          {Array.from({length:20},(_,i)=>(
            <circle key={i} cx={20+i*23} cy={20+(i%5)*24} r={1+(i%3)} fill={["#7c3aed","#0891b2","#d97706","#10b981"][i%4]} opacity="0.35">
              <animate attributeName="opacity" values="0.2;0.7;0.2" dur={`${1.5+i*0.2}s`} repeatCount="indefinite"/>
            </circle>
          ))}
          <text x="230" y="70" textAnchor="middle" fill="url(#tg)" fontSize="44" fontWeight="900" fontFamily="monospace" letterSpacing="5">AI ESCAPE</text>
          <text x="230" y="92" textAnchor="middle" fill="#ffffff22" fontSize="16" fontFamily="monospace" letterSpacing="14">ROOM</text>
          <text x="230" y="140" textAnchor="middle" fill="#333" fontSize="10" letterSpacing="2">BFS · DFS · A* · CSP · RULE-BASED AGENT</text>
        </svg>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {[
            { label: "🎮  Play Manually",        sub: "Explore the room yourself",       color: "#7c3aed", m: "human" },
            { label: "🤖  Watch AI Solve",        sub: "BFS / DFS / A* animated",        color: "#0891b2", m: "ai"    },
            { label: "📊  Compare Algorithms",    sub: "Race all 3 algorithms",           color: "#d97706", m: "compare" },
          ].map(({ label, sub, color, m }) => (
            <button key={m} onClick={() => { reset(); setMode(m); }}
              style={{ background: color+"14", border: `1px solid ${color}44`, borderRadius: 12, padding: "14px 20px", color, cursor: "pointer", fontFamily: "monospace", textAlign: "left", transition: "all 0.2s" }}>
              <div style={{ fontSize: 15, letterSpacing: 1 }}>{label}</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>{sub}</div>
            </button>
          ))}
        </div>

        <div style={{ background: "#ffffff07", border: "1px solid #ffffff0f", borderRadius: 12, padding: 14, fontSize: 11, color: "#444", lineHeight: 2, textAlign: "left" }}>
          {[["🔍 Search","BFS/DFS/A* navigate the state space graph"],["🧩 CSP","Backtracking solves constraint puzzles"],["🤖 Agent","Rule-based goal decisions at each step"]].map(([k,v])=>(
            <div key={k} style={{ display: "flex", gap: 12 }}><span style={{ color: "#7c3aed", minWidth: 90 }}>{k}</span><span>{v}</span></div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── COMPARE ─────────────────────────────────────────────
  if (mode === "compare") return (
    <div style={{ background: "#080810", minHeight: "100vh", fontFamily: "monospace", padding: 16 }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={() => setMode("menu")} style={{ background:"transparent",border:"1px solid #333",borderRadius:6,color:"#666",cursor:"pointer",padding:"6px 12px",fontFamily:"monospace",fontSize:12 }}>← Menu</button>
          <span style={{ color: "#d97706", fontSize: 16, letterSpacing: 2 }}>ALGORITHM COMPARISON</span>
        </div>
        <Btn color="#d97706" onClick={runCompare}>▶ RUN BFS vs DFS vs A*</Btn>
        {compareRes && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginBottom: 16 }}>
              {compareRes.map((r,i) => {
                const [color,name] = [["#10b981","BFS"],["#3b82f6","DFS"],["#d97706","A*"]][i];
                return (
                  <div key={i} style={{ background:color+"0f",border:`1px solid ${color}33`,borderRadius:12,padding:16 }}>
                    <div style={{ color,fontSize:22,fontWeight:700,marginBottom:4 }}>{name}</div>
                    <div style={{ fontSize:11,color:"#555",marginBottom:12 }}>{{BFS:"Breadth-First Search",DFS:"Depth-First Search","A*":"A* + heuristic h(n)"}[name]}</div>
                    {[["Nodes explored",r.explored.length],["Path length",r.path.length+" steps"],["Time",r.time+"ms"],["Cost",r.cost]].map(([l,v])=>(
                      <div key={l} style={{ display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4 }}>
                        <span style={{ color:"#444" }}>{l}</span><span style={{ color:"#ccc",fontWeight:700 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <div style={{ background:"#ffffff07",border:"1px solid #ffffff0f",borderRadius:12,padding:16,marginBottom:16 }}>
              <div style={{ color:"#444",fontSize:10,letterSpacing:2,marginBottom:12 }}>NODES EXPLORED (lower = more efficient)</div>
              {compareRes.map((r,i) => {
                const [color,name]=[["#10b981","BFS"],["#3b82f6","DFS"],["#d97706","A*"]][i];
                const mx=Math.max(...compareRes.map(x=>x.explored.length));
                return (
                  <div key={i} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3 }}>
                      <span style={{ color }}>{name}</span><span style={{ color:"#888" }}>{r.explored.length}</span>
                    </div>
                    <div style={{ background:"#ffffff08",borderRadius:4,height:18,overflow:"hidden" }}>
                      <div style={{ background:color,height:"100%",width:`${r.explored.length/mx*100}%`,borderRadius:4,transition:"width 1.2s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ background:"#ffffff07",border:"1px solid #ffffff0f",borderRadius:12,padding:16,fontSize:12,color:"#888",lineHeight:2 }}>
              <p>• <span style={{ color:"#10b981" }}>BFS</span> — guaranteed shortest path. Explores level by level.</p>
              <p>• <span style={{ color:"#3b82f6" }}>DFS</span> — uses less memory, but path may be suboptimal.</p>
              <p>• <span style={{ color:"#d97706" }}>A*</span> — heuristic h(n) = missing items + unsolved puzzles guides it directly to the goal.</p>
              <p>A* explored <b style={{ color:"#d97706" }}>{compareRes[2]?.explored.length}</b> nodes vs BFS's <b style={{ color:"#10b981" }}>{compareRes[0]?.explored.length}</b> — a <b>{Math.round((1-compareRes[2]?.explored.length/compareRes[0]?.explored.length)*100)}% reduction</b>.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── GAME / AI ────────────────────────────────────────────
  return (
    <div style={{ background: "#080810", height: "100vh", width: "100vw", overflow: "hidden", fontFamily: "monospace", color: "#ccc" }}>
          <audio ref={audioRef} loop>
      <source src="/audio/music.mp3" type="audio/mpeg" />
    </audio>
      {toast && (
        <div style={{ position:"fixed",top:14,left:"50%",transform:"translateX(-50%)",background:toast.color+"22",border:`1px solid ${toast.color}88`,borderRadius:30,padding:"7px 18px",fontSize:13,color:toast.color,zIndex:400,pointerEvents:"none",letterSpacing:1,whiteSpace:"nowrap" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 14px",borderBottom:`1px solid ${acc}22`,background:"#0d0d18" }}>
        <div style={{ color:acc,fontSize:13,letterSpacing:3 }}>🔐 AI ESCAPE ROOM</div>
        <div style={{ display:"flex",gap:6 }}>
          <button onClick={()=>setTab(t=>t==="game"?"viz":"game")} style={{ background:"#ffffff09",border:"1px solid #ffffff13",borderRadius:6,padding:"5px 10px",color:"#666",cursor:"pointer",fontSize:11,fontFamily:"monospace" }}>
            {tab==="game"?"📊 Viz":"🎮 Game"}
          </button>
          <button onClick={()=>{reset();setMode("menu");}} style={{ background:"transparent",border:"1px solid #222",borderRadius:6,color:"#444",cursor:"pointer",padding:"5px 10px",fontFamily:"monospace",fontSize:11 }}>← Menu</button>
        </div>
      </div>

      <div style={{ maxWidth:1100,margin:"0 auto",padding:12 }}>
        <div style={{ display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,370px)",gap:12 }}>

          {/* GAME PANEL */}
          <div className="panel-game" style={{ display: tab==="game" ? "block" : "none" }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
              <span style={{ background:acc+"20",color:acc,border:`1px solid ${acc}44`,borderRadius:20,padding:"3px 12px",fontSize:11,letterSpacing:1 }}>
                {mode==="human"?"👤 HUMAN PLAYER":`🤖 AI — ${aiAlgo.toUpperCase()}`}
              </span>
              <span style={{ color:"#444",fontSize:11 }}>Room: {ROOM_CONFIG[gs.room]?.name}</span>
            </div>

            <RoomScene roomId={gs.room} gs={gs} onAction={mode==="human"?handleAction:()=>{}}
              aiProgress={aiRes ? aiStep/Math.max(aiRes.explored.length,1) : 0} />

            {/* Inventory */}
            <div style={{ display:"flex",gap:6,marginTop:8,flexWrap:"wrap",alignItems:"center" }}>
              <span style={{ color:"#333",fontSize:10 }}>BAG:</span>
              {gs.inv.size===0 && <span style={{ color:"#2a2a2a",fontSize:11 }}>empty</span>}
              {[...gs.inv].map(item=>(
                <span key={item} style={{ background:(ITEM_META[item]?.color||"#7c3aed")+"22",color:ITEM_META[item]?.color||"#7c3aed",border:`1px solid ${(ITEM_META[item]?.color||"#7c3aed")}44`,borderRadius:20,padding:"3px 10px",fontSize:11 }}>
                  {ITEM_META[item]?.icon} {item}
                </span>
              ))}
              {[...gs.solved].map(p=>(
                <span key={p} style={{ background:"#10b98118",color:"#10b981",border:"1px solid #10b98133",borderRadius:20,padding:"3px 10px",fontSize:11 }}>
                  ✓ {p}
                </span>
              ))}
            </div>

            {/* AI Controls */}
            {mode==="ai" && (
              <div style={{ background:"#0d0d18",border:"1px solid #ffffff0a",borderRadius:12,padding:12,marginTop:10 }}>
                <div style={{ color:"#333",fontSize:10,letterSpacing:2,marginBottom:8 }}>AI ALGORITHM</div>
                <div style={{ display:"flex",gap:6,marginBottom:8,flexWrap:"wrap" }}>
                  {["bfs","dfs","astar"].map(a=>(
                    <button key={a} onClick={()=>setAiAlgo(a)}
                      style={{ background:aiAlgo===a?acc+"28":"transparent",color:aiAlgo===a?acc:"#444",border:`1px solid ${aiAlgo===a?acc+"66":"#222"}`,borderRadius:6,padding:"5px 12px",cursor:"pointer",fontSize:11,fontFamily:"monospace",letterSpacing:1 }}>
                      {a.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap",alignItems:"center" }}>
                  <button onClick={loadAI} style={{ background:"#10b98118",color:"#10b981",border:"1px solid #10b98133",borderRadius:6,padding:"6px 12px",cursor:"pointer",fontSize:11,fontFamily:"monospace" }}>▶ LOAD</button>
                  {aiRes && <>
                    <button onClick={stepAI} disabled={aiStep>=aiRes.explored.length} style={{ background:"#3b82f618",color:"#3b82f6",border:"1px solid #3b82f633",borderRadius:6,padding:"6px 12px",cursor:"pointer",fontSize:11,fontFamily:"monospace" }}>⏭ STEP</button>
                    <button onClick={()=>setAutoPlay(a=>!a)} style={{ background:"#d9770618",color:"#d97706",border:"1px solid #d9770633",borderRadius:6,padding:"6px 12px",cursor:"pointer",fontSize:11,fontFamily:"monospace" }}>{autoPlay?"⏸ PAUSE":"▶▶ AUTO"}</button>
                    <span style={{ color:"#333",fontSize:11 }}>{aiStep}/{aiRes.explored.length}</span>
                    {aiRes && <div style={{ flex:1,minWidth:80,background:"#ffffff08",borderRadius:3,height:5 }}><div style={{ background:acc,height:"100%",borderRadius:3,width:`${aiStep/aiRes.explored.length*100}%`,transition:"width 0.3s" }} /></div>}
                  </>}
                </div>
              </div>
            )}

            {/* Escaped */}
            {gs.room==="exit" && (
              <div style={{ background:"#10b98118",border:"1px solid #10b98144",borderRadius:12,padding:20,marginTop:12,textAlign:"center" }}>
                <div style={{ fontSize:48,marginBottom:8 }}>🎉</div>
                <div style={{ color:"#10b981",fontSize:20,letterSpacing:3 }}>YOU ESCAPED!</div>
                <div style={{ color:"#555",fontSize:12,marginTop:6 }}>Solved all 3 puzzles · Collected all items</div>
                <button onClick={reset} style={{ background:"#10b98122",color:"#10b981",border:"1px solid #10b98166",borderRadius:8,padding:"10px 28px",cursor:"pointer",fontSize:13,fontFamily:"monospace",marginTop:14,letterSpacing:1 }}>PLAY AGAIN</button>
              </div>
            )}
          </div>

          {/* VIZ PANEL */}
          <div className="panel-viz" style={{ display: tab==="viz" ? "block" : "none" }}>

            {/* Log */}
            <div style={{ background:"#0d0d18",border:"1px solid #ffffff0a",borderRadius:12,padding:12,marginBottom:10 }}>
              <div style={{ color:"#333",fontSize:10,letterSpacing:2,marginBottom:8 }}>ACTIVITY LOG</div>
              <div ref={logRef} style={{ height:120,overflowY:"auto",fontSize:11 }}>
                {log.length===0 && <div style={{ color:"#222" }}>Waiting for actions…</div>}
                {log.map(e=>(
                  <div key={e.id} style={{ color:{success:"#10b981",ai:"#7c3aed",move:"#0891b2",pickup:"#d97706",error:"#ef4444"}[e.type]||"#444",marginBottom:2 }}>{e.msg}</div>
                ))}
              </div>
            </div>

            {/* Search tree */}
            {aiRes && (
              <div style={{ background:"#0d0d18",border:"1px solid #ffffff0a",borderRadius:12,padding:12,marginBottom:10 }}>
                <div style={{ color:"#333",fontSize:10,letterSpacing:2,marginBottom:8 }}>SEARCH TREE · {aiRes.algorithm?.toUpperCase()} · {aiRes.explored.length} nodes</div>
                <div style={{ maxHeight:170,overflowY:"auto" }}>
                  {aiRes.explored.slice(0,35).map((node,i)=>(
                    <div key={i} style={{ display:"flex",gap:6,fontSize:10,padding:"2px 5px",borderRadius:4,marginBottom:1,background:i<aiStep?"#7c3aed10":"transparent",color:i<aiStep?"#9f7aea":"#333" }}>
                      <span style={{ minWidth:22,color:"#2a2a2a" }}>#{i+1}</span>
                      <span style={{ flex:1 }}>{node.action}</span>
                      {node.g!==undefined && <span style={{ color:"#d9770677" }}>g={node.g}</span>}
                      {node.h!==undefined && <span style={{ color:"#3b82f677" }}>h={node.h}</span>}
                    </div>
                  ))}
                  {aiRes.explored.length>35 && <div style={{ color:"#2a2a2a",fontSize:10,padding:"2px 5px" }}>+{aiRes.explored.length-35} more…</div>}
                </div>
              </div>
            )}

            {/* Path */}
            {aiRes && (
              <div style={{ background:"#0d0d18",border:"1px solid #ffffff0a",borderRadius:12,padding:12,marginBottom:10 }}>
                <div style={{ color:"#333",fontSize:10,letterSpacing:2,marginBottom:8 }}>SOLUTION PATH · {aiRes.path.length} steps</div>
                <div style={{ maxHeight:140,overflowY:"auto" }}>
                  {aiRes.path.map((step,i)=>(
                    <div key={i} style={{ display:"flex",gap:6,fontSize:10,padding:"2px 5px",borderRadius:4,marginBottom:1,background:i<aiStep?"#10b98110":"transparent",color:i<aiStep?"#10b981":"#2a2a2a" }}>
                      <span style={{ minWidth:22 }}>{i+1}.</span><span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CSP */}
            <div style={{ background:"#0d0d18",border:"1px solid #ffffff0a",borderRadius:12,padding:12 }}>
              <div style={{ color:"#333",fontSize:10,letterSpacing:2,marginBottom:10 }}>CSP SOLVER INFO</div>
              <div style={{ fontSize:11,lineHeight:1.9 }}>
                <div style={{ color:"#d97706",marginBottom:3 }}>Code Lock constraints:</div>
                <div style={{ color:"#333" }}>AllDiff(d1,d2,d3) · sum=15 · d1 odd</div>
                <div style={{ color:"#10b981" }}>→ solution: {CODE_SOLUTION.join("")}</div>
                <div style={{ color:"#7c3aed",marginTop:8,marginBottom:3 }}>Logic Puzzle constraints:</div>
                <div style={{ color:"#333" }}>red≠A · blue≠C · AllDiff(A,B,C)</div>
                <div style={{ color:"#10b981" }}>→ A=blue, B=red, C=green</div>
                <div style={{ color:"#0891b2",marginTop:8,marginBottom:3 }}>Key Matching (rule-based):</div>
                <div style={{ color:"#333" }}>Goal: match(red→lock1, blue→lock2, green→lock3)</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Puzzle modals */}
      {puzzle==="codeLock"    && <PuzzleCode  onSolve={()=>solvePuzzle("codeLock")}    onClose={()=>setPuzzle(null)} />}
      {puzzle==="logicPuzzle" && <PuzzleLogic onSolve={()=>solvePuzzle("logicPuzzle")} onClose={()=>setPuzzle(null)} />}
      {puzzle==="keyMatch"    && <PuzzleKeys  onSolve={()=>solvePuzzle("keyMatch")}    onClose={()=>setPuzzle(null)} />}

      <style>{`
        @media (min-width:768px){.panel-game,.panel-viz{display:block!important}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1a1a2a;border-radius:2px}
        button:hover{filter:brightness(1.15)}
        input[type=number]::-webkit-inner-spin-button{opacity:1}
      `}</style>
    </div>
  );
}
