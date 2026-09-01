import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  BookOpen,
  CalendarDays,
  Heart,
  Check,
  ChevronRight,
  Sparkles,
  ChevronLeft,
  Circle,
  CheckCircle2,
  Search,
  X,
  ChevronDown,
} from "lucide-react";

/* =========================================================================
   ARMAZENAMENTO — fora do Claude (site publicado), `window.storage` não
   existe, então criamos aqui uma versão equivalente usando localStorage do
   navegador. Isso faz o app funcionar igual, salvando localmente no
   aparelho de cada pessoa (não é compartilhado entre dispositivos).
   Se um dia `window.storage` real existir (ex.: rodando dentro do Claude),
   este polyfill não faz nada — ele só entra em ação quando falta.
   ========================================================================= */
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      const v = window.localStorage.getItem(key);
      return v === null ? null : { key, value: v, shared: false };
    },
    async set(key, value) {
      window.localStorage.setItem(key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      const existed = window.localStorage.getItem(key) !== null;
      window.localStorage.removeItem(key);
      return { key, deleted: existed, shared: false };
    },
    async list(prefix = "") {
      const keys = Object.keys(window.localStorage).filter((k) => k.startsWith(prefix));
      return { keys, prefix, shared: false };
    },
  };
}

/* =========================================================================
   DADOS — extraídos da planilha "Consagração a Nossa Senhora"
   Estrutura de leitura do Tratado é idêntica em todas as datas:
   4 semanas, sempre com os mesmos capítulos / nº de páginas.
   ========================================================================= */

const READING_PLAN = [
  { week: 1, title: "Introdução e Capítulo 1", pages: "30 páginas", pageRange: "p. 1–30" },
  { week: 2, title: "Capítulos 2, 3 e 4", pages: "38 páginas", pageRange: "p. 31–68" },
  { week: 3, title: "Capítulos 5 e 6", pages: "40 páginas", pageRange: "p. 69–108" },
  { week: 4, title: "Capítulos 7 e 8 + Adendo da Comunhão", pages: "31 páginas", pageRange: "p. 109–139" },
];

/* =========================================================================
   PDFs — onde colocar seus arquivos
   =========================================================================
   Basta salvar os PDFs dentro da pasta `public/pdfs/`, com o nome exato
   abaixo. O site checa sozinho se o arquivo já existe: se sim, mostra o
   PDF ali mesmo na tela; se ainda não existir, mostra o aviso de "em
   breve" no lugar dele. Não precisa mudar nada no código — só salvar o
   arquivo com o nome certo, na pasta certa.

     Tratado (uma semana = um PDF):
       public/pdfs/tratado/semana-1.pdf
       public/pdfs/tratado/semana-2.pdf
       public/pdfs/tratado/semana-3.pdf
       public/pdfs/tratado/semana-4.pdf

     Exercícios Espirituais (um dia = um PDF, sempre com 2 dígitos):
       public/pdfs/exercicios/dia-01.pdf
       public/pdfs/exercicios/dia-02.pdf
       ...
       public/pdfs/exercicios/dia-34.pdf
       (alguns ciclos têm 33 dias, outros 34 — prepare até o dia 34 pra
       cobrir qualquer data escolhida na aba "Escolher")

   Se quiser mudar esses nomes/pastas, é só editar as duas funções abaixo. */

function pdfUrl(path) {
  // import.meta.env.BASE_URL respeita o "base" do vite.config.js — importante
  // pro link funcionar certinho quando o site é publicado no GitHub Pages.
  // O "?? '/'" é só uma proteção caso isso rode fora de um projeto Vite.
  const base = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
  return `${base}pdfs/${path}`;
}
function treatisePdfUrl(week) {
  return pdfUrl(`tratado/semana-${week}.pdf`);
}
function exercisePdfUrl(dayNum) {
  return pdfUrl(`exercicios/dia-${String(dayNum).padStart(2, "0")}.pdf`);
}

/* Cada devoção tem uma REGRA de data, não uma data fixa gravada — assim o
   calendário funciona para qualquer ano, sem manutenção manual.
   type "fixed": dia/mês fixo todo ano.
   type "fixed-transfer-sunday": dia/mês fixo, mas se não cair num domingo,
      é transferido para o domingo seguinte (regra da Assunção no Brasil).
   type "easter-offset": nº de dias a partir do Domingo de Páscoa (positivo = depois). */

const CATEGORIES = {
  solenidade: "Solenidades",
  festa: "Festas",
  memoria: "Memórias",
  outra: "Outras devoções",
};

const DEVOTIONS = [
  // — Solenidades —
  { id: "maria-mae-de-deus", name: "Santa Maria, Mãe de Deus", category: "solenidade", rule: { type: "fixed", month: 1, day: 1 } },
  { id: "anunciacao", name: "Anunciação do Senhor", category: "solenidade", rule: { type: "fixed", month: 3, day: 25 } },
  { id: "assuncao", name: "Assunção de Nossa Senhora", category: "solenidade", rule: { type: "fixed-transfer-sunday", month: 8, day: 15 }, note: "No Brasil, transferida para o domingo seguinte quando 15/08 não cai num domingo." },
  { id: "aparecida", name: "Nossa Senhora da Conceição Aparecida", category: "solenidade", rule: { type: "fixed", month: 10, day: 12 } },
  { id: "imaculada", name: "Imaculada Conceição de Nossa Senhora", category: "solenidade", rule: { type: "fixed", month: 12, day: 8 } },

  // — Festas —
  { id: "candeias", name: "Apresentação do Senhor (N. Sra. das Candeias/Navegantes)", category: "festa", rule: { type: "fixed", month: 2, day: 2 } },
  { id: "visitacao", name: "Visitação de Nossa Senhora", category: "festa", rule: { type: "fixed", month: 5, day: 31 } },
  { id: "natividade", name: "Natividade de Nossa Senhora", category: "festa", rule: { type: "fixed", month: 9, day: 8 } },

  // — Memórias —
  { id: "lourdes", name: "Nossa Senhora de Lourdes", category: "memoria", rule: { type: "fixed", month: 2, day: 11 } },
  { id: "fatima", name: "Nossa Senhora de Fátima", category: "memoria", rule: { type: "fixed", month: 5, day: 13 } },
  { id: "mae-da-igreja", name: "Maria, Mãe da Igreja", category: "memoria", rule: { type: "easter-offset", offset: 50 }, note: "Segunda-feira depois de Pentecostes." },
  { id: "coracao-imaculado", name: "Imaculado Coração de Maria", category: "memoria", rule: { type: "easter-offset", offset: 69 }, note: "Sábado depois do Sagrado Coração de Jesus." },
  { id: "perpetuo-socorro", name: "Nossa Senhora do Perpétuo Socorro", category: "memoria", rule: { type: "fixed", month: 6, day: 27 } },
  { id: "carmo", name: "Nossa Senhora do Carmo", category: "memoria", rule: { type: "fixed", month: 7, day: 16 } },
  { id: "rainha", name: "Nossa Senhora Rainha", category: "memoria", rule: { type: "fixed", month: 8, day: 22 } },
  { id: "dores", name: "Nossa Senhora das Dores", category: "memoria", rule: { type: "fixed", month: 9, day: 15 } },
  { id: "rosario", name: "Nossa Senhora do Rosário", category: "memoria", rule: { type: "fixed", month: 10, day: 7 } },
  { id: "apresentacao-maria", name: "Apresentação de Nossa Senhora", category: "memoria", rule: { type: "fixed", month: 11, day: 21 } },
  { id: "guadalupe", name: "Nossa Senhora de Guadalupe", category: "memoria", rule: { type: "fixed", month: 12, day: 12 } },

  // — Outras devoções (mantidas da planilha original) —
  { id: "desatadora", name: "Nossa Senhora Desatadora dos Nós", category: "outra", rule: { type: "fixed", month: 8, day: 15 } },
];

/* ---- Motor de datas: Páscoa (Computus) e derivação da janela de consagração ---- */

function pad2(n) {
  return String(n).padStart(2, "0");
}
function fixedISO(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}
/* Algoritmo de Meeus/Jones/Butcher para a Páscoa gregoriana — válido para qualquer ano. */
function easterISO(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return fixedISO(year, month, day);
}
function nextSundayOnOrAfter(iso) {
  const dow = toDate(iso).getDay();
  return dow === 0 ? iso : addDaysISO(iso, 7 - dow);
}
function feastDateForYear(rule, year) {
  if (rule.type === "fixed") return fixedISO(year, rule.month, rule.day);
  if (rule.type === "fixed-transfer-sunday") return nextSundayOnOrAfter(fixedISO(year, rule.month, rule.day));
  if (rule.type === "easter-offset") return addDaysISO(easterISO(year), rule.offset);
  return fixedISO(year, 1, 1);
}
/* Regra padrão de planner (aprovada): exercícios = 33 dias terminando na véspera
   da festa; leitura = 4 semanas terminando no domingo anterior ao início dos exercícios. */
function computeWindow(feastDate) {
  const exercisesEnd = addDaysISO(feastDate, -1);
  const exercisesStart = addDaysISO(exercisesEnd, -32);
  let readingEnd = addDaysISO(exercisesStart, -1);
  while (toDate(readingEnd).getDay() !== 0) readingEnd = addDaysISO(readingEnd, -1);
  const readingStart = addDaysISO(readingEnd, -27);
  return { feastDate, exercisesStart, exercisesEnd, readingStart, readingEnd };
}
/* Escolhe, entre o ciclo do ano anterior/atual/seguinte, aquele mais relevante
   para "hoje": o que está em andamento, senão o próximo, senão o mais recente. */
function getOccurrence(dev, today) {
  const y = toDate(today).getFullYear();
  const candidates = [y - 1, y, y + 1].map((yr) => computeWindow(feastDateForYear(dev.rule, yr)));
  const inProgress = candidates.find(
    (c) => daysBetween(c.readingStart, today) >= 0 && daysBetween(today, c.feastDate) >= 0
  );
  if (inProgress) return inProgress;
  const future = candidates
    .filter((c) => daysBetween(today, c.feastDate) > 0)
    .sort((a, b) => daysBetween(today, a.feastDate) - daysBetween(today, b.feastDate))[0];
  if (future) return future;
  return [...candidates].sort((a, b) => daysBetween(b.feastDate, today) - daysBetween(a.feastDate, today))[0];
}

/* ========================================================================= */
/* Utilidades de data                                                        */
/* ========================================================================= */

function toDate(iso) {
  return new Date(iso + "T00:00:00");
}
function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((toDate(b) - toDate(a)) / 86400000);
}
function addDaysISO(iso, n) {
  const d = toDate(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function fmtLong(iso) {
  return toDate(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}
function fmtShort(iso) {
  return toDate(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
/* Remove acentos para a pesquisa não depender de o usuário digitar exatamente
   "Nossa Senhora do Perpétuo Socorro" com o acento certo, por exemplo. */
function normalize(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/* Calcula em que fase da consagração o usuário está, dada a janela (occ) já
   resolvida para o ciclo relevante e a data de "hoje". */
function computeStatus(occ, today) {
  const t = today;
  const { readingStart: rStart, exercisesStart: eStart, exercisesEnd: eEnd, feastDate: feast } = occ;

  if (daysBetween(t, rStart) > 0) {
    return { phase: "upcoming", daysUntil: daysBetween(t, rStart) };
  }
  if (daysBetween(t, eStart) > 0) {
    const since = daysBetween(rStart, t);
    if (since < 28) {
      const week = Math.min(4, Math.floor(since / 7) + 1);
      const weekStart = addDaysISO(rStart, (week - 1) * 7);
      const weekEnd = addDaysISO(rStart, week * 7 - 1);
      return { phase: "reading", week, weekStart, weekEnd };
    }
    return { phase: "gap", daysUntilExercises: daysBetween(t, eStart) };
  }
  if (daysBetween(t, eEnd) >= 0) {
    const dayNum = daysBetween(eStart, t) + 1;
    const total = daysBetween(eStart, eEnd) + 1;
    return { phase: "exercises", dayNum, total };
  }
  if (t === feast) return { phase: "feast" };
  return { phase: "done" };
}

function nextOccurrenceScore(occ, today) {
  const diff = daysBetween(today, occ.feastDate);
  return diff >= 0 ? diff : 10000 + Math.abs(diff);
}
/* Ordena devoções (objetos "crus", com `rule`) pela proximidade da próxima
   ocorrência — resolve a regra para o ano certo antes de comparar. */
function scoreDevotion(dev, today) {
  return nextOccurrenceScore(getOccurrence(dev, today), today);
}

/* ========================================================================= */
/* Armazenamento                                                             */
/* ========================================================================= */

async function loadSelected() {
  try {
    const r = await window.storage.get("selected-devotion");
    return r ? r.value : null;
  } catch {
    return null;
  }
}
async function saveSelected(id) {
  try {
    await window.storage.set("selected-devotion", id);
  } catch {
    /* silencioso: prototipagem */
  }
}
async function loadProgress(devId) {
  try {
    const r = await window.storage.get(`progress:${devId}`);
    return r ? JSON.parse(r.value) : [];
  } catch {
    return [];
  }
}
async function saveProgress(devId, arr) {
  try {
    await window.storage.set(`progress:${devId}`, JSON.stringify(arr));
  } catch {
    /* silencioso: prototipagem */
  }
}

/* ========================================================================= */
/* Componentes visuais                                                       */
/* ========================================================================= */

function Ornament({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5c.7 2.8 1.9 4.6 4.2 6.1-2.3 1.5-3.5 3.3-4.2 6.1-.7-2.8-1.9-4.6-4.2-6.1 2.3-1.5 3.5-3.3 4.2-6.1z"
        fill="var(--gold)"
      />
      <circle cx="12" cy="20.2" r="1.3" fill="var(--gold)" opacity="0.85" />
    </svg>
  );
}

function ReadingSheet({ open, onClose, title, subtitle, kind, url }) {
  // null = ainda verificando se o PDF existe; true = existe (mostra o PDF);
  // false = não existe ainda (mostra o aviso de "em breve").
  const [pdfOk, setPdfOk] = useState(null);

  useEffect(() => {
    if (!open || !url) return;
    setPdfOk(null);
    let cancelled = false;
    fetch(url, { method: "HEAD" })
      .then((res) => {
        if (!cancelled) setPdfOk(res.ok);
      })
      .catch(() => {
        if (!cancelled) setPdfOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  if (!open) return null;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={`sheet ${pdfOk ? "sheet-with-pdf" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <p className="sheet-eyebrow">{kind === "book" ? "Tratado da Verdadeira Devoção" : "Exercícios Espirituais"}</p>
        <h3 className="sheet-title">{title}</h3>
        {subtitle && <p className="sheet-subtitle">{subtitle}</p>}

        {pdfOk === true && (
          <>
            <iframe title={title} src={url} className="pdf-frame" />
            <a className="pdf-open-link" href={url} target="_blank" rel="noreferrer">
              Abrir em nova aba / baixar
            </a>
          </>
        )}

        {pdfOk === false && (
          <div className="placeholder-page">
            <BookOpen size={26} strokeWidth={1.4} />
            <p>
              Espaço reservado para o texto real.
              <br />
              Salve o PDF {kind === "book" ? "desta semana" : "deste dia"} na pasta
              <code> public/pdfs/{kind === "book" ? "tratado" : "exercicios"}/</code> (veja o README) e ele
              aparece aqui automaticamente, sem precisar mexer em mais nada.
            </p>
          </div>
        )}

        {pdfOk === null && (
          <div className="placeholder-page">
            <p>Verificando arquivo…</p>
          </div>
        )}

        <button className="btn-primary" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}

function PhaseCard({ dev, occ, status, onOpenReading, onOpenExercise, done, onToggleDone }) {
  const feastFull = toDate(occ.feastDate).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (status.phase === "upcoming") {
    return (
      <div className="hero-card">
        <p className="eyebrow">Consagração escolhida</p>
        <h2 className="hero-title">{dev.name}</h2>
        <p className="hero-sub">Consagração em {feastFull}</p>
        <div className="countdown">
          <span className="countdown-number">{status.daysUntil}</span>
          <span className="countdown-label">
            {status.daysUntil === 1 ? "dia até o início da leitura" : "dias até o início da leitura"}
          </span>
        </div>
        <p className="hint">
          A leitura do Tratado começa em {fmtLong(occ.readingStart)}. Volte aqui nesse dia — vamos te
          avisar o que ler.
        </p>
      </div>
    );
  }

  if (status.phase === "reading") {
    const plan = READING_PLAN[status.week - 1];
    return (
      <div className="hero-card">
        <p className="eyebrow">Leitura do Tratado · Semana {status.week} de 4</p>
        <h2 className="hero-title">{plan.title}</h2>
        <p className="hero-sub">
          {fmtLong(status.weekStart)} a {fmtLong(status.weekEnd)} · {plan.pages}
        </p>
        <button className="btn-primary" onClick={onOpenReading}>
          <BookOpen size={18} /> Abrir leitura da semana
        </button>
        <DoneToggle done={done} onToggle={onToggleDone} label="Concluí a leitura desta semana" />
        <WeekDots current={status.week} />
      </div>
    );
  }

  if (status.phase === "gap") {
    return (
      <div className="hero-card">
        <p className="eyebrow">Intervalo de preparação</p>
        <h2 className="hero-title">Leitura concluída ✦</h2>
        <p className="hero-sub">
          Os Exercícios Espirituais começam em {status.daysUntilExercises}{" "}
          {status.daysUntilExercises === 1 ? "dia" : "dias"}, em {fmtLong(occ.exercisesStart)}.
        </p>
        <p className="hint">Aproveite estes dias para rever o que leu e manter a oração diária.</p>
      </div>
    );
  }

  if (status.phase === "exercises") {
    const percent = Math.round((status.dayNum / status.total) * 100);
    return (
      <div className="hero-card">
        <p className="eyebrow">
          Exercícios Espirituais · Dia {status.dayNum} de {status.total}
        </p>
        <h2 className="hero-title">Preparação de hoje</h2>
        <p className="hero-sub">Consagração em {fmtLong(occ.feastDate)}</p>
        <button className="btn-primary" onClick={onOpenExercise}>
          <Sparkles size={18} /> Abrir exercício de hoje
        </button>
        <DoneToggle done={done} onToggle={onToggleDone} label="Concluí o exercício de hoje" />
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${Math.min(100, percent)}%` }} />
        </div>
        {/* Contador junto da barra — uma barra de progresso sozinha, sem
            número, não diz nada por si só (nem "quanto falta" nem "que dia
            é hoje"), então sempre mostramos os dois aqui embaixo dela. */}
        <p className="progress-caption">
          Dia {status.dayNum} de {status.total} · {percent}% concluído
        </p>
      </div>
    );
  }

  if (status.phase === "feast") {
    return (
      <div className="hero-card feast">
        <Ornament size={30} />
        <h2 className="hero-title">Hoje é o dia da Consagração!</h2>
        <p className="hero-sub">{dev.name}</p>
        <p className="hint">
          Renove hoje, diante de Nossa Senhora, a entrega total de si mesmo a Jesus por Maria.
        </p>
      </div>
    );
  }

  // done
  return (
    <div className="hero-card">
      <p className="eyebrow">Ciclo concluído</p>
      <h2 className="hero-title">{dev.name}</h2>
      <p className="hero-sub">A consagração deste ciclo já aconteceu, em {fmtLong(occ.feastDate)}.</p>
      <p className="hint">Escolha outra consagração na aba "Escolher" para começar uma nova preparação.</p>
    </div>
  );
}

function DoneToggle({ done, onToggle, label }) {
  return (
    <button className="done-toggle" onClick={onToggle} aria-pressed={done}>
      {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
      <span>{label}</span>
    </button>
  );
}

function WeekDots({ current }) {
  return (
    <div className="week-dots">
      {[1, 2, 3, 4].map((w) => (
        <span key={w} className={`dot ${w === current ? "active" : w < current ? "past" : ""}`} />
      ))}
    </div>
  );
}

const WEEKDAY_LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"];

function isoOf(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function dayType(occ, iso) {
  if (iso === occ.feastDate) return "feast";
  if (iso >= occ.readingStart && iso < occ.exercisesStart) {
    const since = daysBetween(occ.readingStart, iso);
    if (since < 28) return "reading-w" + (Math.floor(since / 7) + 1);
    return "gap";
  }
  if (iso >= occ.exercisesStart && iso <= occ.exercisesEnd) return "exercises";
  return null;
}

function monthsInRange(occ) {
  const start = toDate(occ.readingStart);
  const end = toDate(occ.feastDate);
  const months = [];
  let y = start.getFullYear();
  let m = start.getMonth();
  const endY = end.getFullYear();
  const endM = end.getMonth();
  while (y < endY || (y === endY && m <= endM)) {
    months.push({ year: y, month: m });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return months;
}

function CalendarScreen({ dev, occ }) {
  const t = todayISO();
  const months = useMemo(() => monthsInRange(occ), [occ]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const todayIdx = months.findIndex(
      (mo) => mo.year === toDate(t).getFullYear() && mo.month === toDate(t).getMonth()
    );
    setIdx(todayIdx >= 0 ? todayIdx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dev.id, occ.feastDate]);

  const current = months[idx] || months[0];
  const monthLabel = new Date(current.year, current.month, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const firstWeekday = new Date(current.year, current.month, 1).getDay();
  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="screen">
      <h2 className="screen-title">Calendário</h2>
      <p className="screen-sub">{dev.name}</p>

      <div className="cal-card">
        <div className="cal-nav">
          <button
            className="cal-nav-btn"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            aria-label="Mês anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="cal-month">{monthLabel}</span>
          <button
            className="cal-nav-btn"
            onClick={() => setIdx((i) => Math.min(months.length - 1, i + 1))}
            disabled={idx === months.length - 1}
            aria-label="Próximo mês"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="cal-grid cal-weekdays">
          {WEEKDAY_LETTERS.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>

        <div className="cal-grid">
          {cells.map((d, i) => {
            if (d === null) return <span key={i} className="cal-cell empty" />;
            const iso = isoOf(current.year, current.month, d);
            const type = dayType(occ, iso);
            const isToday = iso === t;
            return (
              <span key={i} className={`cal-cell ${type || ""} ${isToday ? "today" : ""}`}>
                {d}
              </span>
            );
          })}
        </div>
      </div>

      <div className="legend">
        {READING_PLAN.map((p) => (
          <span key={p.week} className="legend-item">
            <i className={`legend-dot reading-w${p.week}`} /> Semana {p.week}
          </span>
        ))}
        <span className="legend-item">
          <i className="legend-dot exercises" /> Exercícios Espirituais
        </span>
        <span className="legend-item">
          <i className="legend-dot feast" /> Consagração
        </span>
      </div>
    </div>
  );
}

/* Compara o mês/ano de uma data ISO com "este mês" ou "o mês seguinte" a
   partir de hoje — usado pelos filtros de "Quando" abaixo. */
function isInMonth(iso, which, today) {
  const target = toDate(iso);
  const t = toDate(today);
  const base = which === "proximo" ? new Date(t.getFullYear(), t.getMonth() + 1, 1) : t;
  return target.getFullYear() === base.getFullYear() && target.getMonth() === base.getMonth();
}

/* Filtro "Quando" — v2. Na primeira versão, "Fase" (leitura/exercícios/
   consagração) e "Período" (este mês/mês que vem) eram duas facetas
   independentes — e escolher só uma Fase sem Período não filtrava nada,
   silenciosamente, o que é um filtro quebrado, não só uma questão de
   layout: Fase sozinha não tem significado ("leitura" quando?).
   Correção: Fase deixa de ser uma faceta própria e vira sub-opção DENTRO de
   cada período — um único dropdown "Quando", com "Este mês" e "Próximo mês"
   como grupos, e as 3 fases como checkboxes dentro de cada grupo. Assim é
   estruturalmente impossível marcar uma fase sem um período: ela só existe
   dentro do grupo do mês. Cada opção marcada vira um "id composto"
   "periodo:fase" (ex: "este-mes:leitura"). */
const PHASES = [
  { id: "leitura", label: "Leitura", getDate: (occ) => occ.readingStart },
  { id: "exercicios", label: "Exercícios", getDate: (occ) => occ.exercisesStart },
  { id: "consagracao", label: "Consagração", getDate: (occ) => occ.feastDate },
];
const PERIODS = [
  { id: "este-mes", label: "Este mês" },
  { id: "proximo-mes", label: "Próximo mês" },
];
const WHEN_GROUPS = PERIODS.map((period) => ({
  id: period.id,
  label: period.label,
  options: PHASES.map((phase) => ({
    id: `${period.id}:${phase.id}`,
    label: phase.label,
  })),
}));
function matchesWhen(occ, selectedCombos, today) {
  if (selectedCombos.length === 0) return true; // nada marcado -> não filtra por tempo
  return selectedCombos.some((comboId) => {
    const [periodId, phaseId] = comboId.split(":");
    const date = PHASES.find((p) => p.id === phaseId).getDate(occ);
    return isInMonth(date, periodId === "este-mes" ? "este" : "proximo", today);
  });
}


/* Dropdown de múltipla escolha, usado pelos filtros "Categoria" e "Quando"
   na tela Escolher. Fecha ao tocar fora (backdrop transparente) ou ao
   selecionar de novo o gatilho. */
function FilterDropdown({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const count = selected.length;

  const toggleOption = (id) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <div className="filter-dropdown">
      <button
        type="button"
        className={`filter-trigger ${count > 0 ? "active" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>
          {label}
          {count > 0 ? ` · ${count}` : ""}
        </span>
        <ChevronDown size={15} className={`filter-chevron ${open ? "open" : ""}`} />
      </button>

      {open && (
        <>
          {/* backdrop invisível: qualquer toque fora do painel fecha o dropdown */}
          <div className="filter-backdrop" onClick={() => setOpen(false)} />
          <div className="filter-panel">
            {options.map((opt) => {
              const checked = selected.includes(opt.id);
              return (
                <label key={opt.id} className={`filter-option ${checked ? "checked" : ""}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleOption(opt.id)} />
                  <span className="filter-option-box">{checked && <Check size={12} strokeWidth={3} />}</span>
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* Dropdown agrupado — usado só pelo filtro "Quando": as opções (fases) ficam
   aninhadas dentro de um grupo (período), então marcar uma fase sem período
   é impossível por construção. Marcar o cabeçalho do grupo ("Este mês")
   marca/desmarca as 3 fases dele de uma vez — atalho comum em listas de
   filtro com hierarquia (o mesmo padrão de pastas/rótulos com "selecionar
   tudo"). */
function GroupedFilterDropdown({ label, groups, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const count = selected.length;

  const toggleOption = (id) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  const toggleGroup = (group) => {
    const groupIds = group.options.map((o) => o.id);
    const allSelected = groupIds.every((id) => selected.includes(id));
    onChange(
      allSelected
        ? selected.filter((id) => !groupIds.includes(id))
        : [...selected.filter((id) => !groupIds.includes(id)), ...groupIds]
    );
  };

  return (
    <div className="filter-dropdown">
      <button
        type="button"
        className={`filter-trigger ${count > 0 ? "active" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>
          {label}
          {count > 0 ? ` · ${count}` : ""}
        </span>
        <ChevronDown size={15} className={`filter-chevron ${open ? "open" : ""}`} />
      </button>

      {open && (
        <>
          <div className="filter-backdrop" onClick={() => setOpen(false)} />
          <div className="filter-panel">
            {groups.map((group, gi) => {
              const groupIds = group.options.map((o) => o.id);
              const allChecked = groupIds.every((id) => selected.includes(id));
              const someChecked = !allChecked && groupIds.some((id) => selected.includes(id));
              return (
                <div key={group.id} className={`filter-group ${gi > 0 ? "filter-group-divider" : ""}`}>
                  <label className={`filter-option filter-group-header ${allChecked ? "checked" : ""}`}>
                    <input type="checkbox" checked={allChecked} onChange={() => toggleGroup(group)} />
                    <span className={`filter-option-box ${someChecked ? "indeterminate" : ""}`}>
                      {allChecked && <Check size={12} strokeWidth={3} />}
                      {someChecked && <span className="indeterminate-dash" />}
                    </span>
                    <span>{group.label}</span>
                  </label>
                  {group.options.map((opt) => {
                    const checked = selected.includes(opt.id);
                    return (
                      <label key={opt.id} className={`filter-option filter-suboption ${checked ? "checked" : ""}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleOption(opt.id)} />
                        <span className="filter-option-box">{checked && <Check size={11} strokeWidth={3} />}</span>
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ChooseScreen({ selectedId, onSelect }) {
  const t = todayISO();
  const [query, setQuery] = useState("");
  const [categoryFilters, setCategoryFilters] = useState([]); // vazio = todas
  // Filtro "Quando" — um único array de ids compostos "periodo:fase" (ver
  // WHEN_GROUPS/matchesWhen acima). Não existe estado separado pra "fase":
  // ela só é selecionável de dentro de um grupo de período.
  const [whenFilters, setWhenFilters] = useState([]);

  const enriched = useMemo(
    () =>
      DEVOTIONS.map((d) => {
        const occ = getOccurrence(d, t);
        return { dev: d, occ, status: computeStatus(occ, t) };
      }).sort((a, b) => nextOccurrenceScore(a.occ, t) - nextOccurrenceScore(b.occ, t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  );

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return enriched.filter(({ dev: d, occ }) => {
      if (q && !normalize(d.name).includes(q)) return false;
      if (categoryFilters.length > 0 && !categoryFilters.includes(d.category)) return false;
      if (!matchesWhen(occ, whenFilters, t)) return false;
      return true;
    });
  }, [enriched, query, categoryFilters, whenFilters, t]);

  // Rótulo de uma tag de filtro ativo "Quando" (ex: "Este mês · Leitura")
  const whenTagLabel = (comboId) => {
    const [periodId, phaseId] = comboId.split(":");
    return `${PERIODS.find((p) => p.id === periodId)?.label} · ${PHASES.find((p) => p.id === phaseId)?.label}`;
  };

  return (
    <div className="screen">
      <h2 className="screen-title">Escolher consagração</h2>
      <p className="screen-sub">Toque numa data para acompanhar essa preparação.</p>

      <div className="search-box">
        <Search size={17} className="search-icon" />
        <input
          type="text"
          inputMode="search"
          placeholder="Pesquisar festa mariana..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button className="search-clear" onClick={() => setQuery("")} aria-label="Limpar pesquisa">
            <X size={15} />
          </button>
        )}
      </div>

      <div className="filter-row">
        <FilterDropdown
          label="Categoria"
          options={Object.entries(CATEGORIES).map(([id, label]) => ({ id, label }))}
          selected={categoryFilters}
          onChange={setCategoryFilters}
        />
        <GroupedFilterDropdown label="Quando" groups={WHEN_GROUPS} selected={whenFilters} onChange={setWhenFilters} />
      </div>

      {(categoryFilters.length > 0 || whenFilters.length > 0) && (
        <div className="active-filters">
          {categoryFilters.map((id) => (
            <button
              key={`cat-${id}`}
              className="active-filter-tag"
              onClick={() => setCategoryFilters(categoryFilters.filter((x) => x !== id))}
            >
              {CATEGORIES[id]} <X size={12} />
            </button>
          ))}
          {whenFilters.map((id) => (
            <button
              key={`when-${id}`}
              className="active-filter-tag"
              onClick={() => setWhenFilters(whenFilters.filter((x) => x !== id))}
            >
              {whenTagLabel(id)} <X size={12} />
            </button>
          ))}
          <button
            className="clear-filters"
            onClick={() => {
              setCategoryFilters([]);
              setWhenFilters([]);
            }}
          >
            Limpar tudo
          </button>
        </div>
      )}

      <div className="devotion-list">
        {filtered.map(({ dev: d, occ, status }) => {
          const isSelected = d.id === selectedId;
          return (
            <button
              key={d.id}
              className={`devotion-card ${isSelected ? "selected" : ""}`}
              onClick={() => onSelect(d.id)}
            >
              <div>
                <p className="devotion-category">{CATEGORIES[d.category]}</p>
                <p className="devotion-name">{d.name}</p>
                <p className="devotion-date">Consagração em {fmtLong(occ.feastDate)}</p>
                {d.note && <p className="devotion-note">{d.note}</p>}
                <p className="devotion-status">{statusLabel(status)}</p>
              </div>
              <ChevronRight size={18} />
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="empty-state">Nenhuma festa encontrada com esses filtros.</p>
        )}
      </div>
    </div>
  );
}

function statusLabel(status) {
  switch (status.phase) {
    case "upcoming":
      return `Começa em ${status.daysUntil} ${status.daysUntil === 1 ? "dia" : "dias"}`;
    case "reading":
      return `Em andamento · leitura, semana ${status.week}`;
    case "gap":
      return "Em andamento · intervalo";
    case "exercises":
      return `Em andamento · exercícios, dia ${status.dayNum}`;
    case "feast":
      return "Hoje é o dia da consagração";
    default:
      return "Ciclo já concluído";
  }
}

/* ========================================================================= */
/* App                                                                       */
/* ========================================================================= */

export default function App() {
  const [tab, setTab] = useState("hoje");
  const [selectedId, setSelectedId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState([]);
  const [sheet, setSheet] = useState(null); // { kind, title, subtitle }

  const today = todayISO();

  useEffect(() => {
    (async () => {
      let id = await loadSelected();
      if (!id) {
        const best = [...DEVOTIONS].sort(
          (a, b) => scoreDevotion(a, today) - scoreDevotion(b, today)
        )[0];
        id = best.id;
        await saveSelected(id);
      }
      setSelectedId(id);
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      const p = await loadProgress(selectedId);
      setProgress(p);
    })();
  }, [selectedId]);

  const dev = useMemo(() => DEVOTIONS.find((d) => d.id === selectedId), [selectedId]);
  const occ = useMemo(() => (dev ? getOccurrence(dev, today) : null), [dev, today]);
  const status = useMemo(() => (occ ? computeStatus(occ, today) : null), [occ, today]);

  const handleSelect = useCallback(async (id) => {
    setSelectedId(id);
    await saveSelected(id);
    setTab("hoje");
  }, []);

  const progressKey = useMemo(() => {
    if (!status) return null;
    if (status.phase === "reading") return `week-${status.week}`;
    if (status.phase === "exercises") return `day-${status.dayNum}`;
    return null;
  }, [status]);

  const isDone = progressKey ? progress.includes(progressKey) : false;

  const toggleDone = useCallback(async () => {
    if (!progressKey || !selectedId) return;
    const next = isDone ? progress.filter((k) => k !== progressKey) : [...progress, progressKey];
    setProgress(next);
    await saveProgress(selectedId, next);
  }, [progressKey, isDone, progress, selectedId]);

  if (!loaded || !dev || !occ || !status) {
    return (
      <div className="app-shell">
        <div className="loading">
          <Ornament size={26} />
        </div>
        <Styles />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        <header className="topbar">
          <Ornament />
          <span className="topbar-title">Consagração a Nossa Senhora</span>
        </header>

        <main className="content">
          {tab === "hoje" && (
            <div className="screen">
              <PhaseCard
                dev={dev}
                occ={occ}
                status={status}
                done={isDone}
                onToggleDone={toggleDone}
                onOpenReading={() =>
                  setSheet({
                    kind: "book",
                    title: READING_PLAN[status.week - 1]?.title,
                    subtitle: READING_PLAN[status.week - 1]?.pageRange,
                    url: treatisePdfUrl(status.week),
                  })
                }
                onOpenExercise={() =>
                  setSheet({
                    kind: "exercise",
                    title: `Dia ${status.dayNum} de ${status.total} dos Exercícios`,
                    subtitle: fmtLong(today),
                    url: exercisePdfUrl(status.dayNum),
                  })
                }
              />
            </div>
          )}

          {tab === "calendario" && <CalendarScreen dev={dev} occ={occ} />}

          {tab === "escolher" && <ChooseScreen selectedId={selectedId} onSelect={handleSelect} />}
        </main>

        <nav className="bottom-nav">
          <NavButton active={tab === "hoje"} onClick={() => setTab("hoje")} icon={Sparkles} label="Hoje" />
          <NavButton
            active={tab === "calendario"}
            onClick={() => setTab("calendario")}
            icon={CalendarDays}
            label="Calendário"
          />
          <NavButton
            active={tab === "escolher"}
            onClick={() => setTab("escolher")}
            icon={Heart}
            label="Escolher"
          />
        </nav>
      </div>

      <ReadingSheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        kind={sheet?.kind}
        title={sheet?.title}
        subtitle={sheet?.subtitle}
        url={sheet?.url}
      />

      <Styles />
    </div>
  );
}

function NavButton({ active, onClick, icon: Icon, label }) {
  return (
    <button className={`nav-btn ${active ? "active" : ""}`} onClick={onClick}>
      <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
      <span>{label}</span>
    </button>
  );
}

/* ========================================================================= */
/* Estilos                                                                   */
/* ========================================================================= */

function Styles() {
  return (
    <style>{`
      /* =====================================================================
         GUIA RÁPIDO DE EDIÇÃO — DESIGN (fonte, cor, espaçamento)
         =====================================================================
         1) FONTES: troque a URL do @import abaixo por outra do Google Fonts,
            depois troque os nomes usados em font-family: 'Cormorant Garamond'
            (título/serifada, usada em títulos e no logo) e 'Source Sans 3'
            (corpo do texto, usada em quase tudo o mais). Os dois nomes
            aparecem várias vezes no arquivo — troque "find & replace".
         2) CORES: quase toda cor do app vem das variáveis --bg, --gold etc.
            logo abaixo, em :root. Mude ali e o app inteiro atualiza — evite
            editar cores "soltas" (hexadecimais fora do :root) espalhadas
            pelo arquivo, exceto casos pontuais já comentados (ex: a tela de
            "hoje é o dia da consagração", que usa um gradiente roxo próprio).
         3) TAMANHOS DE FONTE / ESPAÇAMENTO: cada classe abaixo tem seus
            próprios font-size/padding/gap — procure pela classe (ex.:
            .hero-title, .devotion-name) e edite ali.
         ===================================================================== */

      /* Fonte: troque aqui a família tipográfica do app inteiro (ver guia acima) */
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Source+Sans+3:wght@400;500;600;700&display=swap');

      /* Paleta de cores do app — mude os valores aqui, o resto do CSS usa
         var(--nome) em vez de cores fixas, então tudo se atualiza sozinho.
           --bg             fundo geral (mais escuro)
           --bg-elevated    fundo dos cartões (hero, calendário, dropdown)
           --bg-elevated-2  fundo dos cartões "por cima" de outro cartão
           --gold           cor de destaque principal (botões, dia da consagração)
           --gold-soft      dourado mais claro (títulos, texto de destaque)
           --ink            cor do texto principal
           --ink-muted      cor do texto secundário/apagado
           --rose           cor usada nos dias de Exercícios Espirituais no calendário
           --line           cor das bordas/divisórias (sutil, semi-transparente) */
      :root {
        --bg: #0e1830;
        --bg-elevated: #16234a;
        --bg-elevated-2: #1c2c58;
        --gold: #cfa93c;
        --gold-soft: #e8d9a0;
        --ink: #f1ecdd;
        --ink-muted: #a6b1d1;
        --rose: #c96a83;
        --line: rgba(207,169,60,0.22);

        /* Semanas de leitura no calendário — propositalmente uma família de
           AZUIS (não dourado): o dourado fica reservado só pro dia da
           consagração, que é o destino final, então nunca se confunde com
           "estou lendo a semana 4". A progressão de azul mais escuro
           (semana 1) a mais claro/vibrante (semana 4) já sugere "chegando
           mais perto da meta". Troque os 4 tons aqui se quiser outra ideia
           de cor — mantenha uma sequência clara de escuro pra claro. */
        --week1: #24345c;
        --week2: #2f4a86;
        --week3: #3d61b3;
        --week4: #5c85e6;
      }

      * { box-sizing: border-box; }

      /* Remove a margem/borda branca padrão do navegador ao redor da
         página inteira (o index.html já faz isso antes do React carregar;
         isto aqui garante o mesmo resultado mesmo se o app for embutido
         de outro jeito, sem aquele <style> do index.html). */
      html, body, #root { margin: 0; padding: 0; height: 100%; background: #0e1830; }

      .app-shell {
        height: 100vh;
        height: 100dvh; /* dvh evita "pulo" quando a barra de endereço do celular aparece/some */
        background: radial-gradient(ellipse at 50% -10%, #1a2a54 0%, var(--bg) 55%);
        display: flex;
        justify-content: center;
        font-family: 'Source Sans 3', sans-serif; /* fonte de corpo do app inteiro (herdada por tudo) */
        color: var(--ink);
        padding: 0;
        overflow: hidden; /* impede que a página inteira role — só .content rola (ver abaixo) */
      }

      /* app-frame tem altura TRAVADA (não min-height) de propósito: é isso que faz
         .topbar e .bottom-nav ficarem sempre visíveis, fixos no topo/rodapé, enquanto
         só a área .content (ver mais abaixo) rola por dentro. Se precisar que o app
         ocupe mais ou menos espaço, ajuste aqui. */
      .app-frame {
        width: 100%;
        max-width: 480px;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--bg);
        position: relative;
        overflow: hidden;
      }

      @media (min-width: 720px) {
        .app-shell { padding: 40px 16px; height: 100vh; }
        .app-frame {
          height: 820px; /* altura fixa do "cartão" de celular centralizado no desktop */
          max-height: 90vh;
          border-radius: 28px;
          box-shadow: 0 30px 80px rgba(0,0,0,0.45), 0 0 0 1px var(--line);
          overflow: hidden;
        }
      }

      .loading {
        margin: auto;
        animation: pulse 1.6s ease-in-out infinite;
      }
      @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }

      .topbar {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 20px 22px 16px;
        border-bottom: 1px solid var(--line);
        flex-shrink: 0; /* nunca encolhe — fica sempre visível no topo */
      }
      .topbar-title {
        /* 'Cormorant Garamond' é a fonte "de título" usada em todo o app —
           aparece de novo em .screen-title, .hero-title, .cal-month,
           .sheet-title. Troque aqui e nesses outros lugares junto. */
        font-family: 'Cormorant Garamond', serif;
        font-size: 20px;
        font-weight: 600;
        letter-spacing: 0.01em;
        color: var(--gold-soft);
      }

      /* Única área que rola dentro do app-frame: topbar e bottom-nav ficam
         sempre fixos (ver .app-frame acima) enquanto isto aqui rola por dentro. */
      .content {
        flex: 1;
        min-height: 0; /* necessário no Safari/iOS para o overflow funcionar dentro de flexbox */
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding: 22px 20px 28px;
      }

      /* Barra de rolagem discreta e combinando com o tema (em vez da cinza
         padrão do navegador). Firefox usa scrollbar-width/scrollbar-color;
         Chrome/Safari/Edge usam os pseudo-elementos ::-webkit-scrollbar-*.
         Se quiser trocar a cor/espessura, mude aqui — vale para .content e
         para o painel dos dropdowns de filtro (.filter-panel), que reusam
         a mesma regra logo abaixo. */
      .content,
      .filter-panel {
        scrollbar-width: thin;                       /* Firefox: "auto" | "thin" | "none" */
        scrollbar-color: var(--line) transparent;     /* Firefox: cor da barra, cor da trilha */
      }
      .content::-webkit-scrollbar,
      .filter-panel::-webkit-scrollbar {
        width: 6px;
      }
      .content::-webkit-scrollbar-track,
      .filter-panel::-webkit-scrollbar-track {
        background: transparent;
      }
      .content::-webkit-scrollbar-thumb,
      .filter-panel::-webkit-scrollbar-thumb {
        background: var(--line);
        border-radius: 999px;
      }
      .content::-webkit-scrollbar-thumb:hover,
      .filter-panel::-webkit-scrollbar-thumb:hover {
        background: var(--gold-soft);
      }

      .screen-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: 28px;
        font-weight: 600;
        margin: 4px 0 2px;
      }
      .screen-sub {
        color: var(--ink-muted);
        font-size: 14.5px;
        margin: 0 0 20px;
      }

      .hero-card {
        background: linear-gradient(165deg, var(--bg-elevated) 0%, var(--bg-elevated-2) 100%);
        border: 1px solid var(--line);
        border-radius: 20px;
        padding: 26px 22px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      /* Cartão especial do dia da consagração — de propósito usa um gradiente
         roxo próprio (não as variáveis de cor) pra se destacar dos outros
         estados. Troque os dois tons de hexadecimal aqui se quiser mudar. */
      .hero-card.feast {
        align-items: center;
        text-align: center;
        background: linear-gradient(165deg, #2a2050 0%, #3a1f3f 100%);
        border-color: rgba(201,106,131,0.4);
      }

      .eyebrow {
        font-size: 13px;
        color: var(--gold);
        font-weight: 600;
        letter-spacing: 0.02em;
        margin: 0;
      }
      .hero-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: 27px;
        font-weight: 600;
        line-height: 1.2;
        margin: 0;
        color: var(--ink);
      }
      .hero-sub {
        color: var(--ink-muted);
        font-size: 15px;
        margin: 0 0 6px;
        line-height: 1.4;
      }
      .hint {
        color: var(--ink-muted);
        font-size: 13.5px;
        line-height: 1.5;
        margin: 4px 0 0;
      }

      .countdown {
        display: flex;
        align-items: baseline;
        gap: 10px;
        margin: 6px 0 4px;
      }
      .countdown-number {
        font-family: 'Cormorant Garamond', serif;
        font-size: 52px;
        font-weight: 600;
        color: var(--gold-soft);
        line-height: 1;
      }
      .countdown-label {
        font-size: 14px;
        color: var(--ink-muted);
      }

      .btn-primary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        background: var(--gold);
        color: #24190a;
        border: none;
        border-radius: 13px;
        padding: 14px 18px;
        font-size: 15.5px;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        margin-top: 6px;
        transition: transform 0.15s ease, filter 0.15s ease;
      }
      .btn-primary:active { transform: scale(0.97); filter: brightness(0.95); }

      .done-toggle {
        display: flex;
        align-items: center;
        gap: 9px;
        background: transparent;
        border: none;
        color: var(--ink-muted);
        font-size: 14px;
        font-family: inherit;
        padding: 10px 2px 2px;
        cursor: pointer;
        align-self: flex-start;
      }
      .done-toggle[aria-pressed="true"] { color: var(--gold-soft); }

      .week-dots { display: flex; gap: 7px; margin-top: 8px; }
      .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--bg-elevated-2); border: 1px solid var(--line); }
      .dot.active { background: var(--gold); border-color: var(--gold); }
      .dot.past { background: var(--gold-soft); opacity: 0.5; border-color: transparent; }

      .progress-track {
        height: 6px;
        border-radius: 4px;
        background: rgba(255,255,255,0.08);
        margin-top: 8px;
        overflow: hidden;
      }
      .progress-fill { height: 100%; background: var(--gold); border-radius: 4px; }
      .progress-caption {
        margin: 8px 0 0;
        font-size: 12.5px;
        color: var(--ink-muted);
      }

      /* Calendário */
      .cal-card {
        background: var(--bg-elevated);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 16px 14px 18px;
      }
      .cal-nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      .cal-month {
        font-family: 'Cormorant Garamond', serif;
        font-size: 19px;
        font-weight: 600;
        text-transform: capitalize;
        color: var(--gold-soft);
      }
      .cal-nav-btn {
        width: 32px; height: 32px;
        border-radius: 50%;
        border: 1px solid var(--line);
        background: var(--bg-elevated-2);
        color: var(--ink);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
      }
      .cal-nav-btn:disabled { opacity: 0.3; cursor: default; }

      .cal-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
      }
      .cal-weekdays {
        margin-bottom: 4px;
      }
      .cal-weekdays span {
        text-align: center;
        font-size: 11.5px;
        color: var(--ink-muted);
        font-weight: 600;
      }
      .cal-cell {
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 9px;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .cal-cell.empty { visibility: hidden; }
      .cal-cell.today { box-shadow: inset 0 0 0 1.5px var(--gold-soft); color: var(--ink); font-weight: 700; }

      /* Semanas de leitura: 4 azuis distintos (--week1..--week4, definidos
         lá em cima no :root), não a mesma cor em opacidades diferentes —
         fica bem mais fácil de diferenciar as semanas num piscar de olho.
         --rose marca os dias de Exercícios (cor totalmente diferente, de
         propósito, pra sinalizar "mudou de fase"). --gold no dia da
         consagração é a ÚNICA cor dourada no calendário — reservada pro
         dia em si, nunca reaproveitada nas semanas de leitura. */
      .cal-cell.reading-w1 { background: var(--week1); color: var(--ink); }
      .cal-cell.reading-w2 { background: var(--week2); color: var(--ink); }
      .cal-cell.reading-w3 { background: var(--week3); color: var(--ink); }
      .cal-cell.reading-w4 { background: var(--week4); color: #0e1830; font-weight: 700; }
      .cal-cell.gap { background: rgba(255,255,255,0.05); color: var(--ink-muted); }
      .cal-cell.exercises { background: rgba(201,106,131,0.55); color: var(--ink); }
      .cal-cell.feast {
        background: var(--gold);
        color: #24190a;
        font-weight: 800;
        box-shadow: 0 0 0 2px rgba(207,169,60,0.35);
      }

      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 12px 16px;
        margin-top: 16px;
      }
      .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12.5px;
        color: var(--ink-muted);
      }
      .legend-dot {
        width: 10px; height: 10px;
        border-radius: 3px;
        display: inline-block;
      }
      .legend-dot.reading-w1 { background: var(--week1); }
      .legend-dot.reading-w2 { background: var(--week2); }
      .legend-dot.reading-w3 { background: var(--week3); }
      .legend-dot.reading-w4 { background: var(--week4); }
      .legend-dot.exercises { background: var(--rose); }
      .legend-dot.feast { background: var(--gold); }

      /* Escolher */
      .search-box {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--bg-elevated);
        border: 1px solid var(--line);
        border-radius: 13px;
        padding: 11px 14px;
        margin-bottom: 16px;
      }
      .search-icon { color: var(--ink-muted); flex-shrink: 0; }
      .search-box input {
        flex: 1;
        min-width: 0;
        background: none;
        border: none;
        outline: none;
        color: var(--ink);
        font-family: inherit;
        font-size: 15px;
      }
      .search-box input::placeholder { color: var(--ink-muted); }
      .search-clear {
        background: none;
        border: none;
        color: var(--ink-muted);
        display: flex;
        align-items: center;
        cursor: pointer;
        padding: 2px;
        flex-shrink: 0;
      }
      .empty-state {
        text-align: center;
        color: var(--ink-muted);
        font-size: 14px;
        padding: 24px 10px;
      }
      /* --- Dropdowns de filtro (facetas: "Categoria" / "Fase" / "Período") --- */
      .filter-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 10px;
      }
      .filter-dropdown { position: relative; flex: 1 1 100px; min-width: 100px; }
      .filter-trigger {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        background: var(--bg-elevated);
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 10px 11px;
        font-size: 13.5px;
        font-family: inherit;
        color: var(--ink-muted);
        cursor: pointer;
        overflow: hidden;
      }
      .filter-trigger span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .filter-trigger.active { border-color: var(--gold); color: var(--gold-soft); }
      .filter-chevron { transition: transform 0.15s ease; flex-shrink: 0; }
      .filter-chevron.open { transform: rotate(180deg); }
      /* backdrop transparente: cobre a tela toda para fechar o dropdown ao tocar fora dele */
      .filter-backdrop { position: fixed; inset: 0; z-index: 40; }
      .filter-panel {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        right: 0;
        background: var(--bg-elevated-2);
        border: 1px solid var(--line);
        border-radius: 13px;
        padding: 6px;
        z-index: 41;
        max-height: 260px;
        overflow-y: auto;
        box-shadow: 0 12px 28px rgba(0,0,0,0.35);
      }
      .filter-option {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 9px 8px;
        border-radius: 9px;
        font-size: 14px;
        color: var(--ink-muted);
        cursor: pointer;
      }
      .filter-option.checked { color: var(--ink); }
      .filter-option input { display: none; }
      .filter-option-box {
        width: 17px; height: 17px;
        border-radius: 5px;
        border: 1.5px solid var(--line);
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        color: #24190a;
      }
      .filter-option.checked .filter-option-box { background: var(--gold); border-color: var(--gold); }

      /* --- Grupos do dropdown "Quando" (cabeçalho = período, indentado = fase) --- */
      .filter-group { padding: 2px 0; }
      .filter-group-divider { border-top: 1px solid var(--line); margin-top: 4px; padding-top: 4px; }
      .filter-group-header { font-weight: 600; }
      .filter-group-header .filter-option-box.indeterminate {
        background: var(--gold);
        border-color: var(--gold);
        opacity: 0.55; /* "marcado pela metade": só algumas fases desse mês estão marcadas */
      }
      .indeterminate-dash { width: 8px; height: 2px; background: #24190a; border-radius: 1px; }
      .filter-suboption { padding-left: 24px; font-size: 13.5px; }

      /* --- Tags dos filtros ativos (com opção de remover individualmente) --- */
      .active-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-bottom: 10px;
      }
      .active-filter-tag {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: rgba(207,169,60,0.14);
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 5px 10px;
        font-size: 12.5px;
        font-family: inherit;
        color: var(--gold-soft);
        cursor: pointer;
      }
      .clear-filters {
        background: none;
        border: none;
        font-family: inherit;
        font-size: 12.5px;
        color: var(--ink-muted);
        text-decoration: underline;
        cursor: pointer;
        padding: 5px 4px;
      }
      .devotion-category {
        margin: 0 0 3px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--gold);
        font-weight: 600;
      }
      .devotion-list { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
      .devotion-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        text-align: left;
        background: var(--bg-elevated);
        border: 1px solid var(--line);
        border-radius: 15px;
        padding: 15px 16px;
        color: var(--ink-muted);
        font-family: inherit;
        cursor: pointer;
      }
      .devotion-card.selected { border-color: var(--gold); background: var(--bg-elevated-2); }
      .devotion-name { margin: 0; color: var(--ink); font-weight: 600; font-size: 15.5px; }
      .devotion-date { margin: 3px 0 0; font-size: 13px; }
      .devotion-note { margin: 3px 0 0; font-size: 12px; font-style: italic; opacity: 0.8; }
      .devotion-status { margin: 4px 0 0; font-size: 12.5px; color: var(--gold-soft); }

      /* Bottom nav — fica sempre visível e fixa na base do app-frame porque
         .content (acima) é a única área que rola; isto aqui nunca encolhe. */
      .bottom-nav {
        display: flex;
        flex-shrink: 0;
        border-top: 1px solid var(--line);
        background: var(--bg-elevated);
      }
      .nav-btn {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        background: none;
        border: none;
        color: var(--ink-muted);
        font-family: inherit;
        font-size: 11.5px;
        padding: 11px 0 calc(11px + env(safe-area-inset-bottom, 0px));
        cursor: pointer;
      }
      .nav-btn.active { color: var(--gold); }

      /* Sheet / placeholder */
      .sheet-backdrop {
        position: fixed; inset: 0;
        background: rgba(5,9,20,0.6);
        display: flex; align-items: flex-end;
        z-index: 50;
      }
      .sheet {
        width: 100%;
        max-width: 480px;
        margin: 0 auto;
        background: var(--bg-elevated);
        border-radius: 22px 22px 0 0;
        padding: 12px 22px 26px;
        border: 1px solid var(--line);
        border-bottom: none;
        max-height: 88vh;
        max-height: 88dvh;
        overflow-y: auto;
      }
      /* Quando o PDF é encontrado, o painel usa quase a tela toda pra leitura */
      .sheet.sheet-with-pdf { max-height: 92vh; max-height: 92dvh; }
      .pdf-frame {
        width: 100%;
        height: 62vh;
        height: 62dvh;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: #fff;
        margin-bottom: 10px;
      }
      .pdf-open-link {
        display: inline-block;
        color: var(--gold-soft);
        font-size: 13px;
        text-decoration: underline;
        margin-bottom: 16px;
      }
      .sheet-handle {
        width: 36px; height: 4px;
        background: var(--line);
        border-radius: 4px;
        margin: 4px auto 16px;
      }
      .sheet-eyebrow { margin: 0; font-size: 12.5px; color: var(--gold); font-weight: 600; }
      .sheet-title { margin: 4px 0 2px; font-family: 'Cormorant Garamond', serif; font-size: 22px; }
      .sheet-subtitle { margin: 0 0 16px; color: var(--ink-muted); font-size: 13.5px; }
      .placeholder-page {
        border: 1px dashed var(--line);
        border-radius: 14px;
        padding: 22px 18px;
        display: flex; flex-direction: column; align-items: center; gap: 10px;
        text-align: center;
        color: var(--ink-muted);
        font-size: 13.5px;
        line-height: 1.5;
        margin-bottom: 18px;
      }
      .placeholder-page code {
        background: var(--bg-elevated-2);
        border: 1px solid var(--line);
        border-radius: 5px;
        padding: 1px 5px;
        font-size: 12.5px;
        color: var(--gold-soft);
      }

      @media (prefers-reduced-motion: reduce) {
        * { animation: none !important; transition: none !important; }
      }
    `}</style>
  );
}
