// Calendario de Tarjeta — lógica de la app
// Sin dependencias. Estado persistido en localStorage.

const STORAGE_KEY = "calendario-tarjeta-config";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// --- Estado ---
let config = loadConfig(); // { name, corteDay, pagoDay } | null
let viewDate = startOfMonth(new Date()); // mes mostrado en el calendario

// --- Referencias al DOM ---
const els = {
  form: document.getElementById("config-form"),
  cardName: document.getElementById("card-name"),
  corteDay: document.getElementById("corte-day"),
  pagoDay: document.getElementById("pago-day"),
  summary: document.getElementById("summary"),
  summaryTitle: document.getElementById("summary-title"),
  nextCorte: document.getElementById("next-corte"),
  nextCorteCount: document.getElementById("next-corte-count"),
  nextPago: document.getElementById("next-pago"),
  nextPagoCount: document.getElementById("next-pago-count"),
  monthLabel: document.getElementById("month-label"),
  grid: document.getElementById("calendar-grid"),
  prevMonth: document.getElementById("prev-month"),
  nextMonth: document.getElementById("next-month"),
  todayBtn: document.getElementById("today-btn"),
};

// --- Inicialización ---
init();

function init() {
  if (config) {
    els.cardName.value = config.name || "";
    els.corteDay.value = config.corteDay;
    els.pagoDay.value = config.pagoDay;
  }

  els.form.addEventListener("submit", onSave);
  els.prevMonth.addEventListener("click", () => changeMonth(-1));
  els.nextMonth.addEventListener("click", () => changeMonth(1));
  els.todayBtn.addEventListener("click", () => {
    viewDate = startOfMonth(new Date());
    render();
  });

  render();
}

// --- Manejadores ---
function onSave(e) {
  e.preventDefault();
  const corteDay = clampDay(parseInt(els.corteDay.value, 10));
  const pagoDay = clampDay(parseInt(els.pagoDay.value, 10));

  if (!corteDay || !pagoDay) {
    alert("Indica un día de corte y de pago válidos (1–31).");
    return;
  }

  config = {
    name: els.cardName.value.trim(),
    corteDay,
    pagoDay,
  };
  saveConfig(config);
  render();
}

function changeMonth(delta) {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1);
  render();
}

// --- Render ---
function render() {
  renderSummary();
  renderCalendar();
}

function renderSummary() {
  if (!config) {
    els.summary.hidden = true;
    return;
  }
  els.summary.hidden = false;
  els.summaryTitle.textContent = config.name
    ? `Próximas fechas — ${config.name}`
    : "Próximas fechas";

  const today = startOfDay(new Date());
  const nextCorte = nextOccurrence(config.corteDay, today);
  const nextPago = nextOccurrence(config.pagoDay, today);

  els.nextCorte.textContent = formatDate(nextCorte);
  els.nextCorteCount.textContent = daysAwayLabel(today, nextCorte);
  els.nextPago.textContent = formatDate(nextPago);
  els.nextPagoCount.textContent = daysAwayLabel(today, nextPago);
}

function renderCalendar() {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  els.monthLabel.textContent = `${MONTHS[month]} ${year}`;
  els.grid.innerHTML = "";

  const firstDay = new Date(year, month, 1);
  // getDay(): 0=domingo … 6=sábado. Queremos empezar en lunes.
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Celdas vacías iniciales
  for (let i = 0; i < startOffset; i++) {
    const cell = document.createElement("div");
    cell.className = "day empty";
    els.grid.appendChild(cell);
  }

  const today = startOfDay(new Date());

  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.className = "day";

    const cellDate = new Date(year, month, d);
    const num = document.createElement("span");
    num.textContent = String(d);
    cell.appendChild(num);

    if (sameDate(cellDate, today)) cell.classList.add("today");

    if (config) {
      // El día efectivo se ajusta si el mes tiene menos días (ej. corte 31 en febrero)
      if (d === effectiveDay(config.corteDay, year, month)) {
        cell.classList.add("corte");
        cell.appendChild(makeTag("Corte"));
      } else if (d === effectiveDay(config.pagoDay, year, month)) {
        cell.classList.add("pago");
        cell.appendChild(makeTag("Pago"));
      }
    }

    els.grid.appendChild(cell);
  }
}

function makeTag(text) {
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = text;
  return tag;
}

// --- Lógica de fechas ---

// Devuelve la próxima fecha (hoy incluido) en la que cae `day`.
function nextOccurrence(day, fromDate) {
  let year = fromDate.getFullYear();
  let month = fromDate.getMonth();
  for (let i = 0; i < 13; i++) {
    const eff = effectiveDay(day, year, month);
    const candidate = new Date(year, month, eff);
    if (candidate >= fromDate) return candidate;
    month++;
    if (month > 11) { month = 0; year++; }
  }
  return new Date(year, month, effectiveDay(day, year, month));
}

// Ajusta el día al último día del mes si el mes es más corto.
function effectiveDay(day, year, month) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(day, lastDay);
}

function daysAwayLabel(from, to) {
  const ms = startOfDay(to) - startOfDay(from);
  const days = Math.round(ms / 86400000);
  if (days === 0) return "¡Hoy!";
  if (days === 1) return "Mañana";
  return `En ${days} días`;
}

// --- Utilidades ---
function clampDay(n) {
  if (Number.isNaN(n)) return null;
  return Math.min(31, Math.max(1, n));
}
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function sameDate(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}
function formatDate(d) {
  return `${d.getDate()} de ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// --- Persistencia ---
function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveConfig(cfg) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* almacenamiento no disponible; la app sigue funcionando en memoria */
  }
}
