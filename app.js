const STORAGE_KEY = "phase10-scorekeeper-v1";
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
  state.players.push({ id: crypto.randomUUID(), name, phases: Array(10).fill(false), rounds: [] });
  els.name.value = "";
  saveAndRender();
});

els.reset.addEventListener("click", () => {
  if (!confirm("Να διαγραφεί όλο το παιχνίδι;")) return;
  state = { players: [] };
  saveAndRender();
});

els.addRound.addEventListener("click", () => {
  state.players.forEach(player => {
    player.rounds.push({ round: player.rounds.length + 1, phase: nextPhase(player), passed: false, score: 0 });
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

function render() {
  els.players.innerHTML = "";
  els.players.classList.toggle("empty", state.players.length === 0);

  if (state.players.length === 0) {
    els.players.innerHTML = "<p>Δεν υπάρχουν παίκτες ακόμα. Πρόσθεσε τον πρώτο παίκτη για να ξεκινήσεις.</p>";
    els.winner.textContent = "";
    return;
  }

  state.players.forEach(player => els.players.appendChild(renderPlayer(player)));
  renderWinner();
}

function renderPlayer(player) {
  const node = els.template.content.cloneNode(true);
  const card = node.querySelector(".player-card");
  const nameInput = node.querySelector(".name-input");
  const currentPhase = node.querySelector(".current-phase");
  const totalScore = node.querySelector(".total-score");
  const phaseGrid = node.querySelector(".phase-grid");
  const scoreInput = node.querySelector(".round-score");
  const passedInput = node.querySelector(".phase-passed");
  const history = node.querySelector(".history");

  nameInput.value = player.name;
  nameInput.addEventListener("change", () => {
    player.name = nameInput.value.trim() || player.name;
    saveAndRender();
  });

  node.querySelector(".remove-player").addEventListener("click", () => {
    if (!confirm(`Διαγραφή παίκτη ${player.name};`)) return;
    state.players = state.players.filter(p => p.id !== player.id);
    saveAndRender();
  });

  currentPhase.textContent = nextPhase(player) > 10 ? "Ολοκληρώθηκε" : nextPhase(player);
  totalScore.textContent = totalScoreFor(player);

  player.phases.forEach((done, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `phase-btn ${done ? "done" : ""}`;
    button.textContent = index + 1;
    button.title = phaseRules[index];
    button.addEventListener("click", () => {
      player.phases[index] = !player.phases[index];
      saveAndRender();
    });
    phaseGrid.appendChild(button);
  });

  node.querySelector(".save-round").addEventListener("click", () => {
    const score = Number.parseInt(scoreInput.value || "0", 10);
    const phase = nextPhase(player) > 10 ? 10 : nextPhase(player);
    const passed = passedInput.checked;
    player.rounds.push({ round: player.rounds.length + 1, phase, passed, score: Number.isFinite(score) ? score : 0 });
    if (passed && phase <= 10) player.phases[phase - 1] = true;
    saveAndRender();
  });

  player.rounds.forEach((entry, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${entry.round}</td><td>${entry.phase}</td><td>${entry.passed ? "Ναι" : "Όχι"}</td><td>${entry.score}</td>`;
    const td = document.createElement("td");
    const del = document.createElement("button");
    del.type = "button";
    del.className = "danger small";
    del.textContent = "Χ";
    del.addEventListener("click", () => {
      player.rounds.splice(index, 1);
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

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { players: [] };
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
