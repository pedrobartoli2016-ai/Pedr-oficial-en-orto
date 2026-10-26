"use strict";

// CONFIGURACIÓN GENERAL

const APP_START = "2026-10-26";
const PILOT_DAYS = 7;
const STORAGE_KEY = "quien-es-piloto-v1";

const LABELS = [
  "Ocupación",
  "País / territorio histórico",
  "Año de nacimiento",
  "Logros",
  "Cómo se lo recuerda"
];

const app = document.getElementById("app");
const dialog = document.getElementById("dialog");

let people = [];
let candidates = [];
let state = { days: {}, active: null };
let today = "";
let chosen = null;
let query = "";
let notice = "";

// FECHAS Y UTILIDADES

function argentinaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function dayDiff(a, b) {
  return Math.round(
    (
      Date.parse(a + "T12:00:00Z") -
      Date.parse(b + "T12:00:00Z")
    ) / 86400000
  );
}

function previousDate(date) {
  return new Date(
    Date.parse(date + "T12:00:00Z") - 86400000
  ).toISOString().slice(0, 10);
}

function safe(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// BASE DE NOMBRES PARA EL BUSCADOR

function buildCandidates(extraNames) {
  const map = new Map();

  // Primero los personajes reales del juego.
  // Así, si también aparecen en nombres.json,
  // conservan su ID correcto.

  people.forEach(p => {
    const key = normalize(p.nombre);

    if (!key) return;

    map.set(key, {
      id: p.id,
      nombre: p.nombre,
      alias: Array.isArray(p.alias) ? p.alias : [],
      playable: true
    });
  });

  // Después los nombres adicionales.

  extraNames.forEach(item => {
    const nombre = typeof item === "string"
      ? item
      : item?.nombre;

    if (typeof nombre !== "string") return;

    const key = normalize(nombre);

    if (!key || map.has(key)) return;

    map.set(key, {
      id: null,
      nombre: nombre.trim(),
      alias: Array.isArray(item?.alias)
        ? item.alias
        : [],
      playable: false
    });
  });

  candidates = Array.from(map.values());

  candidates.forEach(p => {
    p.searchNames = [
      p.nombre,
      ...p.alias
    ].map(normalize);
  });
}

function extractExtraNames(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.nombres)) {
    return data.nombres;
  }

  if (data?.categorias) {
    return Object.values(data.categorias)
      .flatMap(group => Array.isArray(group) ? group : []);
  }

  return [];
}

async function loadExtraNames() {
  try {
    const response = await fetch("nombres.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("No se encontró nombres.json");
    }

    const data = await response.json();

    return extractExtraNames(data);
  } catch (error) {
    console.warn(
      "No se pudieron cargar los nombres adicionales:",
      error
    );

    return [];
  }
}

// GUARDADO LOCAL

function load() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY)
    );

    if (saved && saved.days) {
      state = saved;
    }
  } catch (error) {
    console.warn("Error al cargar progreso:", error);
  }
}

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch (error) {
    console.warn("Error al guardar progreso:", error);
  }
}

// SELECCIÓN DIARIA

function shuffleIds() {
  const ids = people.map(p => p.id);

  let seed = 20261026;

  for (let i = ids.length - 1; i > 0; i--) {
    seed = (
      Math.imul(seed, 1664525) + 1013904223
    ) >>> 0;

    const j = seed % (i + 1);

    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  return ids;
}

function idsForDate(date) {
  const day = dayDiff(date, APP_START);

  if (day < 0 || day >= PILOT_DAYS) {
    return null;
  }

  return shuffleIds().slice(
    day * 3,
    day * 3 + 3
  );
}

function ensureDay(date) {
  if (!state.days[date]) {
    state.days[date] = {
      ids: idsForDate(date),
      results: [null, null, null],
      started: [false, false, false]
    };
  }

  return state.days[date];
}

function person(id) {
  return people.find(p => p.id === id);
}

function scoreFor(attemptNumber) {
  return Math.max(0, 120 - 20 * attemptNumber);
}

// IMÁGENES

function portrait(p, reveal = false) {
  const filename = reveal
    ? p?.imagen_archivo_sugerido
    : "silueta.png";

  const src = filename
    ? "imagenes/" +
      filename.split("/").map(encodeURIComponent).join("/")
    : "";

  return `
    <div class="portrait ${reveal ? "real" : ""}">
      <span class="question">?</span>
      ${
        src
          ? `<img
               src="${safe(src)}"
               alt="${reveal ? safe(p.nombre) : "Silueta misteriosa"}"
               onerror="this.style.display='none'"
             >`
          : ""
      }
    </div>
  `;
}

// BARRA DE PROGRESO

function progress(index) {
  return `
    <div class="progress" aria-label="Desafío ${index + 1} de 3">
      ${[0, 1, 2].map(i => `
        <span class="${
          i < index
            ? "done"
            : i === index
              ? "active"
              : ""
        }"></span>
      `).join("")}
    </div>
  `;
}

function activeGame() {
  if (!state.active) return null;

  const a = state.active;
  const d = state.days[a.date];

  if (!d) return null;

  const p = person(d.ids?.[a.index]);

  return p ? { a, d, p } : null;
}

// PANTALLA PRINCIPAL

function render() {
  today = argentinaDate();

  const dateLabel = document.getElementById("date-label");

  if (dateLabel) {
    dateLabel.textContent = new Intl.DateTimeFormat(
      "es-AR",
      {
        dateStyle: "medium",
        timeZone: "America/Argentina/Buenos_Aires"
      }
    ).format(new Date());
  }

  const game = activeGame();

  if (game) {
    renderGame(game);
    return;
  }

  const ids = idsForDate(today);

  if (!ids) {
    app.innerHTML = `
      <section class="panel center">
        <div class="kicker">Semana piloto</div>
        <h2 class="big">La semana de prueba terminó</h2>
        <p class="muted">
          Los siete días iniciales ya pasaron.
          Para continuar tendremos que ampliar la base.
        </p>
      </section>
    `;
    return;
  }

  const day = ensureDay(today);
  save();

  const index = day.results.findIndex(
    result => result === null
  );

  if (index < 0) {
    renderSummary(today);
    return;
  }

  renderIntro(index);
}

// PRESENTACIÓN DEL DESAFÍO

function renderIntro(index) {
  const day = ensureDay(today);

  app.innerHTML = `
    <section class="panel center">
      ${progress(index)}

      <div class="kicker">
        Personaje ${index + 1} de 3
      </div>

      <h2 class="big">
        ¿Podés descubrir quién es?
      </h2>

      ${portrait(null)}

      <p class="muted">
        Cinco pistas. Cinco intentos.
        Hasta <strong>100 puntos</strong>.
      </p>

      <button class="button" id="start">
        Comenzar desafío
      </button>
    </section>
  `;

  document.getElementById("start").onclick = () => {
    const date = argentinaDate();

    if (date !== today) {
      render();
      return;
    }

    day.started[index] = true;

    state.active = {
      date: today,
      index,
      used: 0,
      history: [],
      finished: false,
      correct: false,
      score: 0
    };

    chosen = null;
    query = "";
    notice = "";

    save();
    render();
  };
}

// PANTALLA DEL JUEGO

function renderGame({ a, d, p }) {
  if (a.finished) {
    renderFact({ a, d, p });
    return;
  }

  const remaining = 5 - a.used;
  const unlocked = Math.min(5, a.used + 1);

  const cluesHTML = p.pistas.map((clue, i) => {
    const isUnlocked = i < unlocked;

    return `
      <div class="clue ${isUnlocked ? "" : "locked"}">
        <div class="num">${i + 1}</div>

        <div>
          <div class="type">
            ${LABELS[i]}
          </div>

          <div class="value">
            ${
              isUnlocked
                ? safe(clue.texto)
                : "🔒 Pista bloqueada"
            }
          </div>
        </div>
      </div>
    `;
  }).join("");

  app.innerHTML = `
    <section class="panel game-panel">

      ${progress(a.index)}

      <div class="scorebar">
        <span>
          Personaje <strong>${a.index + 1}/3</strong>
        </span>

        <span>
          Intentos restantes:
          <strong>${remaining}</strong>
        </span>

        <span>
          En juego:
          <strong>${scoreFor(a.used + 1)} pts</strong>
        </span>
      </div>

      <div class="game-grid">

        <div class="game-photo">
          ${portrait(p)}
        </div>

        <div class="game-clue-column">

<div class="game-title">
  <div class="kicker">DESAFÍO DIARIO</div>

  <div class="game-heading">
    <h2>¿QUIÉN ES?</h2>
    <span class="pistas-subtitle">| 5 PISTAS</span>
  </div>
</div>
          <div class="clues">
            ${cluesHTML}
          </div>

        </div>
      </div>

      <div class="answer-area">

        <label for="answer" class="sr-only">
          Buscar personaje
        </label>

        <div class="answer-controls">

          <div class="searchbox">
            <input
              id="answer"
              type="search"
              autocomplete="off"
              placeholder="Buscar personaje..."
              value="${safe(query)}"
              aria-autocomplete="list"
              aria-controls="suggestions"
            >

            <ul
              id="suggestions"
              class="suggestions"
              hidden
            ></ul>
          </div>

          <button
            class="button"
            id="submit"
            ${chosen ? "" : "disabled"}
          >
            Responder
          </button>

          <button
            class="button secondary"
            id="skip"
          >
            No lo sé
          </button>

          <button
            class="button danger"
            id="surrender"
          >
            Me rindo
          </button>

        </div>

        <div class="answer-status">

          <div class="selected" id="selected">
            ${
              chosen
                ? "Seleccionado: " + safe(chosen.nombre)
                : "Escribí al menos 2 letras y elegí un nombre"
            }
          </div>

          ${
            notice
              ? `<div class="feedback bad">${safe(notice)}</div>`
              : ""
          }

        </div>

      </div>

    </section>
  `;

  const input = document.getElementById("answer");

  input.addEventListener("input", () => {
    query = input.value;
    chosen = null;

    document.getElementById("selected").textContent =
      "Elegí un nombre de la lista";

    document.getElementById("submit").disabled = true;

    updateSuggestions();
  });

  document.getElementById("submit").onclick = () => {
    if (chosen) {
      attempt(chosen);
    }
  };

  document.getElementById("skip").onclick = () => {
    attempt(null);
  };

  document.getElementById("surrender").onclick = () => {
    if (
      confirm(
        "¿Seguro que querés rendirte? Vas a obtener 0 puntos."
      )
    ) {
      finish(false, 0, "Te rendiste.");
    }
  };

  updateSuggestions();
}

// BUSCADOR DE PERSONAJES

function matchScore(p, search) {
  const names = p.searchNames;

  let best = -1;

  names.forEach(name => {
    if (name === search) {
      best = Math.max(best, 1000);
    } else if (name.startsWith(search)) {
      best = Math.max(best, 700);
    } else {
      const words = name.split(" ");

      if (words.some(word => word.startsWith(search))) {
        best = Math.max(best, 500);
      } else if (name.includes(search)) {
        best = Math.max(best, 300);
      }
    }
  });

  return best;
}

function updateSuggestions() {
  const list = document.getElementById("suggestions");

  if (!list) return;

  const search = normalize(query);

  if (search.length < 2) {
    list.hidden = true;
    list.innerHTML = "";
    return;
  }

  const matches = candidates
    .map(p => ({
      person: p,
      score: matchScore(p, search)
    }))
    .filter(result => result.score >= 0)
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }

      return a.person.nombre.localeCompare(
        b.person.nombre,
        "es"
      );
    })
    .slice(0, 8);

  list.innerHTML = "";

  if (!matches.length) {
    list.hidden = true;
    return;
  }

  matches.forEach(result => {
    const p = result.person;

    const li = document.createElement("li");
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = p.nombre;

    button.onclick = () => {
      chosen = p;
      query = p.nombre;

      document.getElementById("answer").value = query;

      document.getElementById("selected").textContent =
        "Seleccionado: " + p.nombre;

      document.getElementById("submit").disabled = false;

      list.hidden = true;
    };

    li.append(button);
    list.append(li);
  });

  list.hidden = false;
}

// INTENTOS

function attempt(guess) {
  const game = activeGame();

  if (!game || game.a.finished) return;

  const { a, p } = game;

  if (
    guess &&
    a.history.some(
      entry => entry === guess.nombre + " — Incorrecto"
    )
  ) {
    notice = "Ya probaste ese nombre.";
    render();
    return;
  }

  a.used++;

  // Solamente puede ser correcto un personaje
  // que exista en personajes.json y tenga su ID.

  if (
    guess &&
    guess.playable === true &&
    guess.id === p.id
  ) {
    finish(true, scoreFor(a.used), "¡Correcto!");
    return;
  }

  a.history.push(
    guess
      ? guess.nombre + " — Incorrecto"
      : "No lo sé"
  );

  chosen = null;
  query = "";

  notice = guess
    ? "Incorrecto. Se desbloqueó otra pista."
    : "Se desbloqueó otra pista.";

  if (a.used >= 5) {
    finish(false, 0, "Se agotaron los intentos.");
    return;
  }

  save();
  render();
}

// FINALIZACIÓN DEL DESAFÍO

function finish(correct, score, message) {
  const game = activeGame();

  if (!game) return;

  const { a, d } = game;

  a.finished = true;
  a.correct = correct;
  a.score = score;
  a.message = message;

  d.results[a.index] = {
    correct,
    score,
    used: a.used,
    personId: d.ids[a.index],
    date: a.date,
    history: a.history
  };

  save();
  render();
}

// FICHA FINAL DEL PERSONAJE

function renderFact({ a, p }) {
  app.innerHTML = `
    <section class="panel center">

      ${progress(a.index)}

      <div class="kicker">
        ${safe(a.message || "Desafío terminado")}
      </div>

      <h2 class="big">
        ${safe(p.nombre)}
      </h2>

      ${portrait(p, true)}

      <div class="stat">
        <strong>${a.score} puntos</strong>
        <span>
          ${
            a.correct
              ? "Respuesta correcta"
              : "Desafío sin acertar"
          }
        </span>
      </div>

      <p class="fact">
        ${safe(p.biografia)}
      </p>

      <button class="button" id="continue">
        Continuar
      </button>

    </section>
  `;

  document.getElementById("continue").onclick = () => {
    state.active = null;

    chosen = null;
    query = "";
    notice = "";

    save();
    render();
  };
}

// RESUMEN DEL DÍA

function renderSummary(date) {
  const day = state.days[date];
  const results = day.results.filter(Boolean);

  const total = results.reduce(
    (sum, result) => sum + result.score,
    0
  );

  const wins = results.filter(
    result => result.correct
  ).length;

  const streak = calculateStreak(date);

  app.innerHTML = `
    <section class="panel center">

      <div class="kicker">
        Día completado
      </div>

      <h2 class="big">
        ¡Hasta mañana!
      </h2>

      <p class="muted">
        Completaste los tres personajes de hoy.
      </p>

      <div class="statsgrid">

        <div class="stat">
          <strong>${total}/300</strong>
          <span>Puntos</span>
        </div>

        <div class="stat">
          <strong>${wins}/3</strong>
          <span>Correctos</span>
        </div>

        <div class="stat">
          <strong>${streak}</strong>
          <span>Racha de días</span>
        </div>

        <div class="stat">
          <strong>3/3</strong>
          <span>Desafíos completados</span>
        </div>

      </div>

      <p class="muted">
        Podés volver a ver las fichas de hoy:
      </p>

      <div class="recap-links">
        ${results.map((result, i) => `
          <button
            class="button secondary"
            data-fact="${i}"
          >
            Ver ficha del personaje ${i + 1}
          </button>
        `).join("")}
      </div>

    </section>
  `;

  document.querySelectorAll("[data-fact]").forEach(button => {
    button.onclick = () => {
      showPastFact(date, Number(button.dataset.fact));
    };
  });
}

// REVISAR FICHAS

function showPastFact(date, index) {
  const day = state.days[date];
  const result = day?.results[index];
  const p = person(result?.personId);

  if (!p) return;

  openDialog(`
    <div class="center">

      <div class="kicker">
        Personaje ${index + 1} · ${result.score} puntos
      </div>

      <h2>${safe(p.nombre)}</h2>

      ${portrait(p, true)}

      <p class="fact">
        ${safe(p.biografia)}
      </p>

    </div>
  `);
}

// ESTADÍSTICAS

function participation(date) {
  const day = state.days[date];

  return !!day && (
    day.results.some(
      result => result && result.used > 0
    ) ||
    (
      state.active?.date === date &&
      state.active.used > 0
    )
  );
}

function calculateStreak(date) {
  let streak = 0;
  let current = date;

  for (let i = 0; i < 365; i++) {
    if (!participation(current)) break;

    streak++;
    current = previousDate(current);
  }

  return streak;
}

function stats() {
  const days = Object.entries(state.days);

  const played = days.filter(
    ([date]) => participation(date)
  ).length;

  const completed = days.filter(
    ([, day]) => day.results.every(Boolean)
  ).length;

  const results = days.flatMap(
    ([, day]) => day.results.filter(Boolean)
  );

  const correct = results.filter(
    result => result.correct
  ).length;

  const score = results.reduce(
    (sum, result) => sum + result.score,
    0
  );

  const date = argentinaDate();

  const streak =
    calculateStreak(date) ||
    calculateStreak(previousDate(date));

  const percentage = results.length
    ? Math.round(100 * correct / results.length)
    : 0;

  openDialog(`
    <h2>Mis estadísticas</h2>

    <div class="statsgrid">

      <div class="stat">
        <strong>${played}</strong>
        <span>Días participados</span>
      </div>

      <div class="stat">
        <strong>${completed}</strong>
        <span>Días completados</span>
      </div>

      <div class="stat">
        <strong>${correct}/${results.length}</strong>
        <span>Respuestas correctas</span>
      </div>

      <div class="stat">
        <strong>${score}</strong>
        <span>Puntos acumulados</span>
      </div>

      <div class="stat">
        <strong>${streak}</strong>
        <span>Racha actual</span>
      </div>

      <div class="stat">
        <strong>${percentage}%</strong>
        <span>Porcentaje de aciertos</span>
      </div>

    </div>
  `);
}

// VENTANAS

function openDialog(html) {
  document.getElementById("dialog-content").innerHTML = html;
  dialog.showModal();
}

document.getElementById("dialog-close").onclick = () => {
  dialog.close();
};

document.getElementById("stats-button").onclick = stats;

// MODO DE PRUEBAS

function setupDevMode() {
  const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

  if (!isLocal) return;

  if (document.querySelector(".dev-reset")) return;

  const button = document.createElement("button");

  button.className = "dev-reset";
  button.type = "button";
  button.textContent = "Reiniciar partida (pruebas)";

  button.onclick = () => {
    const confirmed = confirm(
      "¿Reiniciar las partidas de prueba? " +
      "Se borrarán los puntos y estadísticas guardados."
    );

    if (!confirmed) return;

    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  };

  const header = document.querySelector(".topright");

  if (header) {
    header.appendChild(button);
  }
}

// INICIAR JUEGO

async function init() {
  try {
    const response = await fetch("personajes.json");

    if (!response.ok) {
      throw new Error(
        "No se encontró el archivo personajes.json"
      );
    }

    const data = await response.json();

    people = data.personajes;

    if (!Array.isArray(people) || people.length < 21) {
      throw new Error(
        "La base necesita al menos 21 personajes."
      );
    }

    // Cargar nombres adicionales.
    // Si nombres.json está vacío o falla,
    // el juego puede seguir funcionando
    // con los personajes originales.

    const extraNames = await loadExtraNames();

    buildCandidates(extraNames);

    console.log(
      "Buscador listo:",
      candidates.length,
      "nombres disponibles."
    );

    load();
    setupDevMode();
    render();

    // Revisar cambio de día cada 15 segundos.

    setInterval(() => {
      const now = argentinaDate();

      if (now === today) return;

      if (state.active) {
        const game = activeGame();

        if (game && game.a.used === 0) {
          state.active = null;
          save();
          render();
        }
      } else {
        render();
      }
    }, 15000);

  } catch (error) {
    console.error(error);

    app.innerHTML = `
      <section class="panel center">

        <h2>No se pudo iniciar el juego</h2>

        <p class="muted">
          ${safe(error.message)}
        </p>

        <p>
          Comprobá que personajes.json
          esté en la misma carpeta que index.html.
        </p>

      </section>
    `;
  }
}

init();