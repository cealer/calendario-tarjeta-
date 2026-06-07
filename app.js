// Mis Tarjetas — gestor de movimientos, cortes y pagos.
// Vanilla JS, sin dependencias. Estado persistido en localStorage.

const STORAGE_KEY = "mis-tarjetas-v1";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const CATEGORIES = [
  "Supermercado", "Comida", "Transporte", "Servicios", "Entretenimiento",
  "Salud", "Ropa", "Hogar", "Educación", "Viajes", "Tecnología", "Otros",
];

// ---------------- Estado ----------------
let state = loadState();
let viewDate = startOfMonth(new Date()); // mes del calendario
let stmtCorteISO = null;                 // período mostrado en estado de cuenta
let editingCardId = null;

// ---------------- Utilidades ----------------
const moneyFmt = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function money(n) { return "$" + moneyFmt.format(Number(n) || 0); }
function pad(n) { return String(n).padStart(2, "0"); }
function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseISO(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function sameDate(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function formatDate(d) { return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; }
function effectiveDay(day, year, month) { return Math.min(day, new Date(year, month + 1, 0).getDate()); }

// Primera fecha de corte (>= fromDate) según el día de corte.
function firstCorteOnOrAfter(corteDay, fromDate) {
  let y = fromDate.getFullYear(), m = fromDate.getMonth();
  const ref = startOfDay(fromDate);
  for (let i = 0; i < 14; i++) {
    const c = new Date(y, m, effectiveDay(corteDay, y, m));
    if (c >= ref) return c;
    m++; if (m > 11) { m = 0; y++; }
  }
  return new Date(y, m, effectiveDay(corteDay, y, m));
}

// Suma k meses a una fecha de corte base, respetando la duración del mes.
function addMonthsCorte(corteDay, base, k) {
  let total = base.getMonth() + k;
  let y = base.getFullYear() + Math.floor(total / 12);
  let m = ((total % 12) + 12) % 12;
  return new Date(y, m, effectiveDay(corteDay, y, m));
}

// Fecha de pago: primer día de pago estrictamente posterior al corte.
function pagoDateForCorte(pagoDay, corteDate) {
  let y = corteDate.getFullYear(), m = corteDate.getMonth();
  for (let i = 0; i < 4; i++) {
    const p = new Date(y, m, effectiveDay(pagoDay, y, m));
    if (p > corteDate) return p;
    m++; if (m > 11) { m = 0; y++; }
  }
  return corteDate;
}

function daysAwayLabel(from, to) {
  const days = Math.round((startOfDay(to) - startOfDay(from)) / 86400000);
  if (days < 0) return `(hace ${-days} d)`;
  if (days === 0) return "(¡hoy!)";
  if (days === 1) return "(mañana)";
  return `(en ${days} d)`;
}

// ---------------- Persistencia ----------------
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { cards: [], movements: [], paidPeriods: {}, activeCardId: null };
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

// ---------------- Modelo ----------------
function activeCard() {
  return state.cards.find((c) => c.id === state.activeCardId) || state.cards[0] || null;
}

// Cuotas de un movimiento: cada una con su período (corte) y pago.
function installmentsOf(card, mov) {
  const n = Math.max(1, parseInt(mov.installments, 10) || 1);
  const total = Number(mov.amount) || 0;
  const base = Math.round((total / n) * 100) / 100;
  const c0 = firstCorteOnOrAfter(card.corteDay, parseISO(mov.date));
  const list = [];
  let acc = 0;
  for (let k = 0; k < n; k++) {
    const amt = k === n - 1 ? Math.round((total - acc) * 100) / 100 : base;
    acc += amt;
    const corte = addMonthsCorte(card.corteDay, c0, k);
    list.push({
      movId: mov.id, desc: mov.description, category: mov.category, date: mov.date,
      corte, pago: pagoDateForCorte(card.pagoDay, corte), amount: amt, k, n,
    });
  }
  return list;
}

// Todas las cuotas de la tarjeta activa.
function allInstallments(card) {
  return state.movements
    .filter((m) => m.cardId === card.id)
    .flatMap((m) => installmentsOf(card, m));
}

function isPeriodPaid(cardId, corteISO) {
  return (state.paidPeriods[cardId] || []).includes(corteISO);
}

// Crédito utilizado = cuotas de períodos no pagados.
function usedCredit(card) {
  return allInstallments(card)
    .filter((i) => !isPeriodPaid(card.id, iso(i.corte)))
    .reduce((s, i) => s + i.amount, 0);
}

// ---------------- DOM ----------------
const $ = (id) => document.getElementById(id);

function init() {
  // Categorías en selector
  CATEGORIES.forEach((c) => {
    const o = document.createElement("option");
    o.value = c; o.textContent = c;
    $("mov-category").appendChild(o);
  });

  // Tabs
  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => switchTab(t.dataset.tab));
  });
  document.querySelectorAll("[data-goto]").forEach((b) => {
    b.addEventListener("click", () => switchTab(b.dataset.goto));
  });

  // Formularios
  $("card-form").addEventListener("submit", onSaveCard);
  $("card-cancel-btn").addEventListener("click", resetCardForm);
  $("mov-form").addEventListener("submit", onAddMovement);
  $("mov-filter").addEventListener("change", renderMovements);

  // Estado de cuenta
  $("period-prev").addEventListener("click", () => shiftPeriod(-1));
  $("period-next").addEventListener("click", () => shiftPeriod(1));
  $("mark-paid-btn").addEventListener("click", toggleMarkPaid);

  // Calendario
  $("prev-month").addEventListener("click", () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1); renderCalendar(); });
  $("next-month").addEventListener("click", () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1); renderCalendar(); });
  $("today-btn").addEventListener("click", () => { viewDate = startOfMonth(new Date()); renderCalendar(); });

  // Fecha por defecto del movimiento
  $("mov-date").value = iso(new Date());

  renderAll();
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${name}`));
}

// ---------------- Render principal ----------------
function renderAll() {
  renderPills();
  renderResumen();
  renderMovementsArea();
  renderCalendar();
  renderCardsList();
}

function renderPills() {
  const wrap = $("card-pills");
  wrap.innerHTML = "";
  const card = activeCard();
  if (card) state.activeCardId = card.id;
  state.cards.forEach((c) => {
    const pill = document.createElement("button");
    pill.className = "card-pill" + (card && c.id === card.id ? " active" : "");
    pill.innerHTML = `<span class="swatch" style="background:${c.color}"></span>${escapeHtml(c.name)}`;
    pill.addEventListener("click", () => {
      state.activeCardId = c.id;
      stmtCorteISO = null;
      saveState();
      renderAll();
    });
    wrap.appendChild(pill);
  });
  wrap.style.display = state.cards.length ? "flex" : "none";
}

// ---------------- Resumen ----------------
function renderResumen() {
  const card = activeCard();
  $("resumen-empty").hidden = !!card;
  $("resumen-content").hidden = !card;
  if (!card) return;

  // Saldo / límite
  const used = usedCredit(card);
  const limit = Number(card.limit) || 0;
  const available = limit - used;
  $("resumen-card-name").textContent = card.name;
  $("bal-used").textContent = money(used);
  $("bal-limit").textContent = limit ? money(limit) : "—";
  const availEl = $("bal-available");
  availEl.textContent = limit ? money(available) : "—";
  availEl.className = "balance-value " + (available < 0 ? "balance-danger" : "balance-ok");
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const fill = $("bal-progress");
  fill.style.width = pct + "%";
  fill.style.background = pct > 90 ? "var(--danger)" : pct > 70 ? "var(--warn)" : "var(--primary)";

  // Período por defecto: el período de corte actual.
  if (!stmtCorteISO) {
    stmtCorteISO = iso(firstCorteOnOrAfter(card.corteDay, new Date()));
  }
  renderStatement(card);
  renderCategoryTotals(card);
}

function renderStatement(card) {
  const corte = parseISO(stmtCorteISO);
  const pago = pagoDateForCorte(card.pagoDay, corte);
  $("period-label").textContent = `${MONTHS[corte.getMonth()]} ${corte.getFullYear()}`;
  $("stmt-corte").textContent = formatDate(corte);
  $("stmt-pago").textContent = formatDate(pago);
  $("stmt-pago-count").textContent = daysAwayLabel(new Date(), pago);

  const items = allInstallments(card).filter((i) => iso(i.corte) === stmtCorteISO);
  const total = items.reduce((s, i) => s + i.amount, 0);
  $("stmt-total").textContent = money(total);

  const list = $("stmt-list");
  list.innerHTML = "";
  if (!items.length) {
    list.innerHTML = `<li class="empty-row">Sin movimientos en este período.</li>`;
  } else {
    items.sort((a, b) => parseISO(a.date) - parseISO(b.date));
    items.forEach((i) => {
      const li = document.createElement("li");
      const msi = i.n > 1 ? `<span class="badge-msi">${i.k + 1}/${i.n}</span>` : "";
      li.innerHTML = `
        <div class="li-main">
          <span class="li-title">${escapeHtml(i.desc)} ${msi}</span>
          <span class="li-sub">${formatDate(parseISO(i.date))} · ${escapeHtml(i.category)}</span>
        </div>
        <span class="li-amount">${money(i.amount)}</span>`;
      list.appendChild(li);
    });
  }

  const paid = isPeriodPaid(card.id, stmtCorteISO);
  const btn = $("mark-paid-btn");
  btn.textContent = paid ? "✓ Pagado (deshacer)" : "Marcar como pagado";
  btn.classList.toggle("paid", paid);
}

function renderCategoryTotals(card) {
  const totals = {};
  state.movements.filter((m) => m.cardId === card.id).forEach((m) => {
    totals[m.category] = (totals[m.category] || 0) + (Number(m.amount) || 0);
  });
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const ul = $("category-totals");
  ul.innerHTML = "";
  if (!entries.length) {
    ul.innerHTML = `<li class="empty-row">Aún no hay gastos registrados.</li>`;
    return;
  }
  entries.forEach(([cat, amt]) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="chip">${escapeHtml(cat)}</span><span class="li-amount">${money(amt)}</span>`;
    ul.appendChild(li);
  });
}

function shiftPeriod(delta) {
  const card = activeCard();
  if (!card) return;
  const next = addMonthsCorte(card.corteDay, parseISO(stmtCorteISO), delta);
  stmtCorteISO = iso(next);
  renderStatement(card);
}

function toggleMarkPaid() {
  const card = activeCard();
  if (!card) return;
  const arr = state.paidPeriods[card.id] || (state.paidPeriods[card.id] = []);
  const idx = arr.indexOf(stmtCorteISO);
  if (idx >= 0) arr.splice(idx, 1); else arr.push(stmtCorteISO);
  saveState();
  renderResumen();
}

// ---------------- Movimientos ----------------
function renderMovementsArea() {
  const card = activeCard();
  $("mov-empty").hidden = !!card;
  $("mov-content").hidden = !card;
  if (!card) return;
  renderMovFilter(card);
  renderMovements();
}

function renderMovFilter(card) {
  const sel = $("mov-filter");
  const prev = sel.value;
  sel.innerHTML = `<option value="all">Todos</option>`;
  // Períodos con cuotas, ordenados desc.
  const periods = [...new Set(allInstallments(card).map((i) => iso(i.corte)))]
    .sort((a, b) => parseISO(b) - parseISO(a));
  periods.forEach((p) => {
    const d = parseISO(p);
    const o = document.createElement("option");
    o.value = p; o.textContent = `Corte ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    sel.appendChild(o);
  });
  if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
}

function renderMovements() {
  const card = activeCard();
  if (!card) return;
  const filter = $("mov-filter").value;
  const list = $("mov-list");
  list.innerHTML = "";

  let movs = state.movements.filter((m) => m.cardId === card.id);
  if (filter !== "all") {
    movs = movs.filter((m) => installmentsOf(card, m).some((i) => iso(i.corte) === filter));
  }
  movs.sort((a, b) => parseISO(b.date) - parseISO(a.date));

  if (!movs.length) {
    list.innerHTML = `<li class="empty-row">No hay movimientos.</li>`;
    return;
  }
  movs.forEach((m) => {
    const li = document.createElement("li");
    const n = parseInt(m.installments, 10) || 1;
    const msi = n > 1 ? `<span class="badge-msi">${n} cuotas</span>` : "";
    li.innerHTML = `
      <div class="li-main">
        <span class="li-title">${escapeHtml(m.description)} ${msi}</span>
        <span class="li-sub">${formatDate(parseISO(m.date))} · ${escapeHtml(m.category)}</span>
      </div>
      <span class="li-amount">${money(m.amount)}</span>
      <button class="icon-btn" title="Eliminar" aria-label="Eliminar">✕</button>`;
    li.querySelector(".icon-btn").addEventListener("click", () => deleteMovement(m.id));
    list.appendChild(li);
  });
}

function onAddMovement(e) {
  e.preventDefault();
  const card = activeCard();
  if (!card) return;
  const amount = parseFloat($("mov-amount").value);
  if (!(amount > 0)) { alert("Ingresa un monto válido."); return; }
  state.movements.push({
    id: uid(),
    cardId: card.id,
    date: $("mov-date").value || iso(new Date()),
    description: $("mov-desc").value.trim() || "Movimiento",
    amount,
    category: $("mov-category").value,
    installments: Math.max(1, parseInt($("mov-installments").value, 10) || 1),
  });
  saveState();
  e.target.reset();
  $("mov-date").value = iso(new Date());
  $("mov-installments").value = 1;
  renderAll();
}

function deleteMovement(id) {
  if (!confirm("¿Eliminar este movimiento?")) return;
  state.movements = state.movements.filter((m) => m.id !== id);
  saveState();
  renderAll();
}

// ---------------- Tarjetas ----------------
function onSaveCard(e) {
  e.preventDefault();
  const corteDay = clampDay(parseInt($("corte-day").value, 10));
  const pagoDay = clampDay(parseInt($("pago-day").value, 10));
  if (!corteDay || !pagoDay) { alert("Indica días de corte y pago válidos (1–31)."); return; }

  const data = {
    name: $("card-name").value.trim() || "Tarjeta",
    corteDay, pagoDay,
    limit: parseFloat($("card-limit").value) || 0,
    color: $("card-color").value,
  };

  if (editingCardId) {
    const c = state.cards.find((c) => c.id === editingCardId);
    if (c) Object.assign(c, data);
  } else {
    const card = { id: uid(), ...data };
    state.cards.push(card);
    state.activeCardId = card.id;
    stmtCorteISO = null;
  }
  saveState();
  resetCardForm();
  renderAll();
  switchTab("resumen");
}

function editCard(id) {
  const c = state.cards.find((c) => c.id === id);
  if (!c) return;
  editingCardId = id;
  $("card-form-title").textContent = "Editar tarjeta";
  $("card-save-btn").textContent = "Guardar cambios";
  $("card-cancel-btn").hidden = false;
  $("card-name").value = c.name;
  $("corte-day").value = c.corteDay;
  $("pago-day").value = c.pagoDay;
  $("card-limit").value = c.limit || "";
  $("card-color").value = c.color;
  switchTab("tarjetas");
  $("card-name").focus();
}

function resetCardForm() {
  editingCardId = null;
  $("card-form").reset();
  $("card-color").value = "#6366f1";
  $("card-form-title").textContent = "Nueva tarjeta";
  $("card-save-btn").textContent = "Guardar tarjeta";
  $("card-cancel-btn").hidden = true;
}

function deleteCard(id) {
  const c = state.cards.find((c) => c.id === id);
  if (!c) return;
  if (!confirm(`¿Eliminar "${c.name}" y todos sus movimientos?`)) return;
  state.cards = state.cards.filter((c) => c.id !== id);
  state.movements = state.movements.filter((m) => m.cardId !== id);
  delete state.paidPeriods[id];
  if (state.activeCardId === id) state.activeCardId = state.cards[0]?.id || null;
  stmtCorteISO = null;
  saveState();
  renderAll();
}

function renderCardsList() {
  const ul = $("cards-list");
  ul.innerHTML = "";
  if (!state.cards.length) {
    ul.innerHTML = `<li class="empty-row">No tienes tarjetas todavía.</li>`;
    return;
  }
  state.cards.forEach((c) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="card-row-info">
        <span class="swatch" style="background:${c.color}"></span>
        <div class="li-main">
          <span class="li-title">${escapeHtml(c.name)}</span>
          <span class="li-sub">Corte día ${c.corteDay} · Pago día ${c.pagoDay}${c.limit ? " · Límite " + money(c.limit) : ""}</span>
        </div>
      </div>
      <div class="card-row-actions">
        <button class="btn btn-ghost btn-edit">Editar</button>
        <button class="btn btn-danger btn-del">Eliminar</button>
      </div>`;
    li.querySelector(".btn-edit").addEventListener("click", () => editCard(c.id));
    li.querySelector(".btn-del").addEventListener("click", () => deleteCard(c.id));
    ul.appendChild(li);
  });
}

// ---------------- Calendario ----------------
function renderCalendar() {
  const card = activeCard();
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  $("month-label").textContent = `${MONTHS[month]} ${year}`;
  const grid = $("calendar-grid");
  grid.innerHTML = "";

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // lunes primero
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < startOffset; i++) {
    const cell = document.createElement("div");
    cell.className = "day empty";
    grid.appendChild(cell);
  }

  const today = startOfDay(new Date());
  const movDays = new Set(
    card ? state.movements
      .filter((m) => m.cardId === card.id)
      .map((m) => parseISO(m.date))
      .filter((d) => d.getFullYear() === year && d.getMonth() === month)
      .map((d) => d.getDate()) : []
  );

  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.className = "day";
    const cellDate = new Date(year, month, d);
    cell.innerHTML = `<span>${d}</span>`;
    if (sameDate(cellDate, today)) cell.classList.add("today");
    if (card) {
      if (d === effectiveDay(card.corteDay, year, month)) {
        cell.classList.add("corte");
        cell.innerHTML += `<span class="tag">Corte</span>`;
      } else if (d === effectiveDay(card.pagoDay, year, month)) {
        cell.classList.add("pago");
        cell.innerHTML += `<span class="tag">Pago</span>`;
      }
      if (movDays.has(d)) cell.innerHTML += `<span class="mov-dot"></span>`;
    }
    grid.appendChild(cell);
  }
}

// ---------------- Helpers ----------------
function clampDay(n) {
  if (Number.isNaN(n)) return null;
  return Math.min(31, Math.max(1, n));
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

init();
