const STORAGE_KEY = "phase10-scorekeeper-v2";
const OLD_STORAGE_KEY = "phase10-scorekeeper-v1";
const THEME_KEY = "phase10-theme";

const phaseRules = [
  "2 τριάδες: 2 x 3 κάρτες του ίδιου αριθμού",
  "1 τριάδα και 1 σειρά από 4 διαδοχικούς αριθμούς",
  "1 τετράδα και 1 σειρά από 4 διαδοχικούς αριθμούς",
  "1 σειρά από 7 διαδοχικούς αριθμούς",
  "1 σειρά από 8 διαδοχικούς αριθμούς",
  "1 σειρά από 9 διαδοχικούς αριθμούς",
  "2 τετράδες",
  "7 κάρτες του ίδιου χρώματος",
  "1 πεντάδα και 1 ζευγάρι",
  "1 πεντάδα και 1 τριάδα"
];

let state = loadState();

const els = {
  form: document.querySelector("#playerForm"),
  name: document.querySelector("#playerName"),
  players: document.querySelector("#players"),
  template: document.querySelector("#playerCardTemplate"),
  reset: document.querySelector("#resetBtn"),
  addRound: document.querySelector("#addRoundBtn"),
  export: document.querySelector("#exportBtn"),
  winner: document.querySelector("#winnerText"),
  phaseRules: document.querySelector("#phaseRules"),
  themeToggle: document.querySelector("#themeToggle")
};

phaseRules.forEach((rule, index) => {
  const li = document.createElement("li");
  li.textContent = `${index + 1}η φάση: ${rule}`;
  els.phaseRules.appendChild(li);
});

applyTheme(localStorage.getItem(THEME_KEY) || "light");
render();

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.name.value.trim();
  if (!name) return;
  state.players.push(createPlayer(name));
  els.name.value = "";
  saveAndRender();
});

els.reset.addEventListener("click", () => {
  if (!confirm("Να διαγραφεί όλο το παιχνίδι;")) return;
  state = { players: [] };
  localStorage.removeItem(OLD_STORAGE_KEY);
  saveAndRender();
});

els.addRound.addEventListener("click", () => {
  state.players.forEach(player => {
    ensurePlayerShape(player);
    player.rounds.push({
      round: player.rounds.length + 1,
      phase: Math.min(nextPhase(player), 10),
      passed: false,
      score: 0
    });
  });
  saveAndRender();
});

els.export.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `phase10-score-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

els.themeToggle.addEventListener("click", () => {
  const next = document.body.classList.contains("dark") ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

function createPlayer(name) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    name,
    phases: Array(10).fill(false),
    rounds: []
  };
}

function render() {
  els.players.innerHTML = "";
  els.players.classList.toggle("empty", state.players.length === 0);

  if (state.players.length === 0) {
    els.players.innerHTML = "<p>Δεν υπάρχουν παίκτες ακόμα. Πρόσθεσε τον πρώτο παίκτη για να ξεκινήσεις.</p>";
    els.winner.textContent = "";
    return;
  }

  state.players.forEach(player => {
    ensurePlayerShape(player);
    els.players.appendChild(renderPlayer(player));
  });
  renderWinner();
}

function renderPlayer(player) {
  const node = els.template.content.cloneNode(true);
  const card = node.querySelector(".player-card");
  const nameInput = node.querySelector(".name-input");
  const currentPhase = node.querySelector(".current-phase");
  const totalScore = node.querySelector(".total-score");
  const totalScoreTop = node.querySelector(".total-score-top");
  const phaseGrid = node.querySelector(".phase-grid");
  const scoreInput = node.querySelector(".round-score");
  const passedInput = node.querySelector(".phase-passed");
  const history = node.querySelector(".history");

  const total = totalScoreFor(player);
  const phase = nextPhase(player);

  card.dataset.playerId = player.id;
  nameInput.value = player.name;
  currentPhase.textContent = phase > 10 ? "Ολοκληρώθηκε" : phase;
  totalScore.textContent = total;
  totalScoreTop.textContent = `Σύνολο: ${total}`;

  nameInput.addEventListener("change", () => {
    const nextName = nameInput.value.trim();
    if (nextName) player.name = nextName;
    saveAndRender();
  });

  node.querySelector(".remove-player").addEventListener("click", () => {
    if (!confirm(`Διαγραφή παίκτη ${player.name};`)) return;
    state.players = state.players.filter(p => p.id !== player.id);
    saveAndRender();
  });

  player.phases.forEach((done, index) => {
    const wrap = document.createElement("div");
    wrap.className = "phase-cell";

    const button = document.createElement("button");
    button.type = "button";
    button.className = `phase-btn ${done ? "done" : ""}`;
    button.textContent = index + 1;
    button.title = `${index + 1}η φάση: ${phaseRules[index]}`;
    button.setAttribute("aria-pressed", done ? "true" : "false");
    button.addEventListener("click", () => {
      player.phases[index] = !player.phases[index];
      saveAndRender();
    });

    const text = document.createElement("small");
    text.className = "phase-description";
    text.textContent = phaseRules[index];

    wrap.append(button, text);
    phaseGrid.appendChild(wrap);
  });

  node.querySelector(".save-round").addEventListener("click", () => {
    const score = Math.max(0, Number.parseInt(scoreInput.value || "0", 10) || 0);
    const current = Math.min(nextPhase(player), 10);
    const passed = passedInput.checked;

    player.rounds.push({
      round: player.rounds.length + 1,
      phase: current,
      passed,
      score
    });

    if (passed && current <= 10) {
      player.phases[current - 1] = true;
    }

    saveAndRender();
  });

  player.rounds.forEach((entry, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${entry.round}</td><td>${entry.phase}</td><td>${entry.passed ? "Ναι" : "Όχι"}</td><td>${entry.score}</td>`;
    const td = document.createElement("td");
    const del = document.createElement("button");
    del.type = "button";
    del.className = "danger small delete-round";
    del.textContent = "Χ";
    del.title = "Διαγραφή γύρου";
    del.addEventListener("click", () => {
      player.rounds.splice(index, 1);
      rebuildPhasesFromHistory(player);
      renumberRounds(player);
      saveAndRender();
    });
    td.appendChild(del);
    tr.appendChild(td);
    history.appendChild(tr);
  });

  return card;
}

function nextPhase(player) {
  const index = player.phases.findIndex(done => !done);
  return index === -1 ? 11 : index + 1;
}

function totalScoreFor(player) {
  return player.rounds.reduce((sum, r) => sum + Number(r.score || 0), 0);
}

function renderWinner() {
  const completed = state.players.filter(p => p.phases.every(Boolean));
  if (completed.length === 0) {
    els.winner.textContent = "";
    return;
  }
  completed.sort((a, b) => totalScoreFor(a) - totalScoreFor(b));
  els.winner.textContent = `Πιθανός νικητής: ${completed[0].name} (${totalScoreFor(completed[0])} πόντοι)`;
}

function renumberRounds(player) {
  player.rounds.forEach((round, index) => round.round = index + 1);
}

function rebuildPhasesFromHistory(player) {
  player.phases = Array(10).fill(false);
  player.rounds.forEach(round => {
    if (round.passed && round.phase >= 1 && round.phase <= 10) {
      player.phases[round.phase - 1] = true;
    }
  });
}

function ensurePlayerShape(player) {
  player.id ||= crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  player.name ||= "Παίκτης";
  player.phases = Array.isArray(player.phases) ? player.phases.slice(0, 10) : Array(10).fill(false);
  while (player.phases.length < 10) player.phases.push(false);
  player.rounds = Array.isArray(player.rounds) ? player.rounds : [];
  renumberRounds(player);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : { players: [] };
    parsed.players = Array.isArray(parsed.players) ? parsed.players : [];
    parsed.players.forEach(ensurePlayerShape);
    return parsed;
  } catch {
    return { players: [] };
  }
}

function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  els.themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
}
