import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

// ─── Types ───────────────────────────────────────────────────────────────────

type Page = "home" | "chemistry" | "history" | "stats" | "algorithm" | "recommendations" | "settings";

interface Chemical {
  id: number;
  name: string;
  comment: string;
  volume: number;
  remainder: number;
  spendPerWash: number;
  color: string;
}

interface WashRecord {
  id: number;
  date: string;
  duration: string;
  comment: string;
  quality: number;
  chemicals: string[];
  steps: { label: string; done: boolean }[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_CHEMICALS: Chemical[] = [
  { id: 1, name: "Koch Chemie MES", comment: "Предактивная пена, pH нейтральный", volume: 1000, remainder: 720, spendPerWash: 80, color: "#E8F4FF" },
  { id: 2, name: "Gyeon Q²M Bathe+", comment: "Шампунь для двухфазной мойки", volume: 1000, remainder: 190, spendPerWash: 60, color: "#FFF3E0" },
  { id: 3, name: "Gtechniq W6", comment: "Стекольный очиститель", volume: 500, remainder: 110, spendPerWash: 20, color: "#F3E5F5" },
  { id: 4, name: "Koch Chemie FSE", comment: "Быстрый защитный финишер", volume: 750, remainder: 650, spendPerWash: 15, color: "#E8F5E9" },
  { id: 5, name: "Meguiar's APC", comment: "Универсальный очиститель салона", volume: 946, remainder: 420, spendPerWash: 50, color: "#FFF8E1" },
  { id: 6, name: "Sonax Felgenreiniger", comment: "Очиститель дисков", volume: 750, remainder: 80, spendPerWash: 40, color: "#FCE4EC" },
];

const MOCK_WASH_RECORDS: WashRecord[] = [
  {
    id: 1,
    date: "7 марта 2026",
    duration: "2ч 15мин",
    comment: "Хорошая сушка, немного разводов на задних стёклах",
    quality: 4,
    chemicals: ["Koch Chemie MES", "Gyeon Bathe+", "Gtechniq W6", "Koch FSE"],
    steps: [
      { label: "Предварительная", done: true },
      { label: "Бесконтактная", done: true },
      { label: "Двухфазная", done: true },
      { label: "Сушка", done: true },
      { label: "Стекло", done: true },
      { label: "Салон", done: false },
      { label: "Защита", done: true },
    ],
  },
  {
    id: 2,
    date: "28 февраля 2026",
    duration: "1ч 50мин",
    comment: "Экспресс-мойка перед поездкой",
    quality: 3,
    chemicals: ["Koch Chemie MES", "Gyeon Bathe+"],
    steps: [
      { label: "Предварительная", done: true },
      { label: "Бесконтактная", done: true },
      { label: "Двухфазная", done: false },
      { label: "Сушка", done: true },
      { label: "Стекло", done: false },
      { label: "Салон", done: false },
      { label: "Защита", done: false },
    ],
  },
];

const NAV_ITEMS = [
  { id: "home" as Page, label: "Главная", icon: "Home" },
  { id: "chemistry" as Page, label: "Химия", icon: "FlaskConical" },
  { id: "history" as Page, label: "История", icon: "History" },
  { id: "stats" as Page, label: "Статистика", icon: "BarChart3" },
  { id: "algorithm" as Page, label: "Алгоритм", icon: "ListChecks" },
  { id: "recommendations" as Page, label: "Советы", icon: "Lightbulb" },
  { id: "settings" as Page, label: "Настройки", icon: "Settings" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRemainderColor(pct: number): string {
  if (pct > 50) return "var(--dp-green)";
  if (pct > 20) return "var(--dp-yellow)";
  return "var(--dp-red)";
}

function getRemainderLabel(pct: number): string {
  if (pct > 50) return "Достаточно";
  if (pct > 20) return "Заканчивается";
  return "Критично";
}

// ─── Stopwatch ────────────────────────────────────────────────────────────────

function Stopwatch() {
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setTime((t) => t + 1), 1000);
    } else {
      if (ref.current) clearInterval(ref.current);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);

  const fmt = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(time / 3600);
  const m = Math.floor((time % 3600) / 60);
  const s = time % 60;

  return (
    <div className="dp-card-lg p-8 flex flex-col items-center gap-6">
      <p className="dp-label" style={{ marginBottom: 0 }}>Секундомер мойки</p>
      <div
        className="font-golos font-black tracking-tight select-none"
        style={{ fontSize: "clamp(48px, 12vw, 80px)", color: "var(--dp-navy)", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}
      >
        {fmt(h)}:{fmt(m)}:{fmt(s)}
      </div>
      <div className="flex gap-3">
        <button
          className="dp-btn-primary"
          onClick={() => setRunning((r) => !r)}
          style={{ minWidth: 120, justifyContent: "center" }}
        >
          <Icon name={running ? "Square" : "Play"} size={16} />
          {running ? "Стоп" : "Старт"}
        </button>
        <button
          className="dp-btn-ghost"
          onClick={() => { setRunning(false); setTime(0); }}
        >
          <Icon name="RotateCcw" size={16} />
          Сброс
        </button>
      </div>
    </div>
  );
}

// ─── Chemical Card ────────────────────────────────────────────────────────────

function ChemicalCard({ chem, onDelete }: { chem: Chemical; onDelete: (id: number) => void }) {
  const [remainder, setRemainder] = useState(chem.remainder);
  const pct = Math.round((remainder / chem.volume) * 100);
  const color = getRemainderColor(pct);

  return (
    <div className="dp-card p-5 flex flex-col gap-3 dp-animate">
      <div
        className="rounded-2xl flex items-center justify-center"
        style={{ height: 80, background: chem.color, marginBottom: 4 }}
      >
        <Icon name="FlaskConical" size={32} style={{ color: "var(--dp-navy)", opacity: 0.5 }} />
      </div>

      <div>
        <p className="font-semibold text-sm leading-tight" style={{ color: "var(--dp-text)" }}>{chem.name}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--dp-muted)" }}>{chem.comment}</p>
      </div>

      <div className="flex gap-2 text-xs flex-wrap">
        <span className="dp-tag" style={{ background: "var(--dp-bg)", color: "var(--dp-muted)" }}>
          📦 {chem.volume} мл
        </span>
        <span className="dp-tag" style={{ background: "var(--dp-bg)", color: "var(--dp-muted)" }}>
          💧 {chem.spendPerWash} мл/мойка
        </span>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium" style={{ color }}>
            {getRemainderLabel(pct)} — {pct}%
          </span>
          <span className="text-xs font-semibold" style={{ color: "var(--dp-text)" }}>{remainder} мл</span>
        </div>
        <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "var(--dp-bg)" }}>
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
        <input
          type="range"
          className="dp-slider mt-3"
          min={0}
          max={chem.volume}
          value={remainder}
          onChange={(e) => setRemainder(Number(e.target.value))}
          style={{
            background: `linear-gradient(to right, ${color} ${pct}%, var(--dp-bg) ${pct}%)`,
          }}
        />
      </div>

      <div className="flex gap-2 mt-1">
        <button
          className="dp-btn-ghost flex-1"
          style={{ justifyContent: "center", fontSize: 12, padding: "8px" }}
          title="В корзину заказа"
        >
          <Icon name="ShoppingCart" size={14} />
          Заказать
        </button>
        <button
          onClick={() => onDelete(chem.id)}
          className="dp-btn-ghost"
          style={{ padding: "8px 10px", color: "var(--dp-red)", borderColor: "transparent" }}
          title="Удалить"
        >
          <Icon name="Trash2" size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Wash Card ────────────────────────────────────────────────────────────────

function WashCard({ record }: { record: WashRecord }) {
  const [steps, setSteps] = useState(record.steps);

  const toggleStep = (i: number) =>
    setSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, done: !s.done } : s));

  const PHOTO_COUNT = 6;

  return (
    <div className="dp-card-lg p-6 flex flex-col gap-5 dp-animate">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <p className="font-bold text-lg" style={{ color: "var(--dp-text)" }}>{record.date}</p>
          <div className="flex gap-3 items-center mt-1">
            <span className="text-sm" style={{ color: "var(--dp-muted)" }}>
              <Icon name="Clock" size={13} className="inline mr-1" />
              {record.duration}
            </span>
            <span className="dp-tag">
              {"⭐".repeat(record.quality)} {record.quality}/5
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {["До", "После"].map((label) => (
          <div key={label}>
            <p className="dp-label">{label}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: PHOTO_COUNT }).map((_, i) => (
                <div key={i} className="dp-photo-slot">
                  <Icon name="Camera" size={16} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div>
        <p className="dp-label">Комментарий</p>
        <p className="text-sm" style={{ color: "var(--dp-text)" }}>{record.comment}</p>
      </div>

      <div>
        <p className="dp-label">Использованная химия</p>
        <div className="flex flex-wrap gap-2">
          {record.chemicals.map((c) => (
            <span key={c} className="dp-tag">{c}</span>
          ))}
        </div>
      </div>

      <div>
        <p className="dp-label">Этапы мойки</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {steps.map((step, i) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="dp-checkbox"
                checked={step.done}
                onChange={() => toggleStep(i)}
              />
              <span className="text-sm" style={{ color: step.done ? "var(--dp-text)" : "var(--dp-muted)" }}>
                {step.label}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Pages ────────────────────────────────────────────────────────────────────

function PageHome({ chemicals }: { chemicals: Chemical[] }) {
  const [carName, setCarName] = useState("Porsche Cayenne");
  const [editingCar, setEditingCar] = useState(false);

  return (
    <div className="flex flex-col gap-6">

      <div className="dp-card p-5 dp-animate">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="rounded-2xl flex items-center justify-center text-2xl"
              style={{ width: 52, height: 52, background: "linear-gradient(135deg, #74b9ff, #0984e3)" }}
            >
              ☀️
            </div>
            <div>
              <p className="font-bold text-2xl" style={{ color: "var(--dp-navy)" }}>+4°C</p>
              <p className="text-xs" style={{ color: "var(--dp-muted)" }}>Москва · Ясно</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="Car" size={20} style={{ color: "var(--dp-navy)" }} />
            {editingCar ? (
              <input
                className="dp-input"
                style={{ width: 200 }}
                value={carName}
                autoFocus
                onChange={(e) => setCarName(e.target.value)}
                onBlur={() => setEditingCar(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingCar(false)}
              />
            ) : (
              <span
                className="font-semibold text-lg cursor-pointer"
                style={{ color: "var(--dp-text)", borderBottom: "1.5px dashed var(--dp-border)" }}
                onClick={() => setEditingCar(true)}
              >
                {carName}
              </span>
            )}
            <button onClick={() => setEditingCar(true)} style={{ color: "var(--dp-muted)" }}>
              <Icon name="Pencil" size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="dp-animate dp-animate-delay-1">
        <Stopwatch />
      </div>

      <div className="dp-card p-5 dp-animate dp-animate-delay-2" style={{ borderLeft: "4px solid var(--dp-navy)" }}>
        <p className="dp-label" style={{ marginBottom: 4 }}>Рекомендация дня</p>
        <p className="font-medium" style={{ color: "var(--dp-text)" }}>
          💡 При температуре ниже +5°C используйте незамерзающую добавку в воду — это предотвратит заморозку сопел пистолета.
        </p>
      </div>

      <div className="dp-animate dp-animate-delay-3">
        <p className="dp-section-title" style={{ marginBottom: 12 }}>Баланс химии</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {chemicals.slice(0, 4).map((c) => {
            const pct = Math.round((c.remainder / c.volume) * 100);
            const color = getRemainderColor(pct);
            return (
              <div key={c.id} className="dp-metric-card">
                <p className="font-semibold text-xs mb-3 leading-tight" style={{ color: "var(--dp-text)" }}>{c.name}</p>
                <div className="h-1.5 rounded-full mb-2" style={{ background: "var(--dp-bg)" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
                  <span className="text-xs" style={{ color: "var(--dp-muted)" }}>{c.remainder} мл</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PageChemistry() {
  const [chemicals, setChemicals] = useState<Chemical[]>(MOCK_CHEMICALS);

  const handleDelete = (id: number) =>
    setChemicals((prev) => prev.filter((c) => c.id !== id));

  const handleAdd = () => {
    const newChem: Chemical = {
      id: Date.now(),
      name: "Новая химия",
      comment: "Добавьте описание",
      volume: 500,
      remainder: 500,
      spendPerWash: 30,
      color: "#F0F4FF",
    };
    setChemicals((prev) => [newChem, ...prev]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="dp-section-title" style={{ marginBottom: 0 }}>Мой склад химии</p>
        <button className="dp-btn-primary" onClick={handleAdd}>
          <Icon name="Plus" size={16} />
          Добавить
        </button>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {chemicals.map((c) => (
          <ChemicalCard key={c.id} chem={c} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}

function PageHistory() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="dp-section-title" style={{ marginBottom: 0 }}>История моек</p>
        <button className="dp-btn-primary">
          <Icon name="Plus" size={16} />
          Новая мойка
        </button>
      </div>
      <div className="flex flex-col gap-6">
        {MOCK_WASH_RECORDS.map((r) => (
          <WashCard key={r.id} record={r} />
        ))}
      </div>
    </div>
  );
}

function PageStats() {
  const [period, setPeriod] = useState<"month" | "season" | "custom">("month");

  const PERIODS = [
    { id: "month" as const, label: "Месяц" },
    { id: "season" as const, label: "Сезон" },
    { id: "custom" as const, label: "Произвольный" },
  ];

  const metrics = [
    { label: "Моек за период", value: "8", icon: "Droplets", color: "#1E3A5F" },
    { label: "Среднее качество", value: "4.2 / 5", icon: "Star", color: "#F5A623" },
    { label: "Общее время", value: "18ч 40мин", icon: "Clock", color: "#34C759" },
    { label: "Расход химии", value: "3.2 л", icon: "FlaskConical", color: "#9B59B6" },
  ];

  const chemStats = [
    { name: "Koch Chemie MES", spent: 640 },
    { name: "Gyeon Q²M Bathe+", spent: 480 },
    { name: "Gtechniq W6", spent: 160 },
    { name: "Koch Chemie FSE", spent: 120 },
    { name: "Meguiar's APC", spent: 400 },
    { name: "Sonax Felgenreiniger", spent: 320 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <p className="dp-section-title" style={{ marginBottom: 0 }}>Статистика</p>

      <div className="dp-card p-4 flex flex-wrap gap-2 items-center dp-animate">
        <div className="flex gap-2 flex-wrap">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className="dp-btn-ghost"
              style={{
                background: period === p.id ? "var(--dp-navy)" : "transparent",
                color: period === p.id ? "#fff" : "var(--dp-navy)",
                borderColor: period === p.id ? "var(--dp-navy)" : "var(--dp-border)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="flex gap-2 items-center ml-2 flex-wrap">
            <input type="date" className="dp-input" style={{ width: "auto" }} defaultValue="2026-02-01" />
            <span style={{ color: "var(--dp-muted)" }}>—</span>
            <input type="date" className="dp-input" style={{ width: "auto" }} defaultValue="2026-03-08" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 dp-animate dp-animate-delay-1">
        {metrics.map((m) => (
          <div key={m.label} className="dp-metric-card flex flex-col gap-2">
            <div
              className="rounded-xl flex items-center justify-center"
              style={{ width: 40, height: 40, background: `${m.color}18` }}
            >
              <Icon name={m.icon} size={20} style={{ color: m.color }} fallback="CircleAlert" />
            </div>
            <p className="font-bold text-2xl" style={{ color: "var(--dp-text)" }}>{m.value}</p>
            <p className="text-xs" style={{ color: "var(--dp-muted)" }}>{m.label}</p>
          </div>
        ))}
      </div>

      <div className="dp-card-lg p-6 dp-animate dp-animate-delay-2">
        <p className="font-bold text-base mb-4" style={{ color: "var(--dp-text)" }}>Расход по химии</p>
        <div className="flex flex-col gap-3">
          {chemStats.map((c) => {
            const maxSpent = Math.max(...chemStats.map((x) => x.spent));
            const pct = Math.round((c.spent / maxSpent) * 100);
            return (
              <div key={c.name} className="flex items-center gap-3">
                <p className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--dp-text)" }}>{c.name}</p>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--dp-bg)", minWidth: 60 }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--dp-navy)", opacity: 0.8 }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: "var(--dp-navy)", minWidth: 50, textAlign: "right" }}>
                  {c.spent} мл
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="dp-card-lg p-6 dp-animate dp-animate-delay-3"
        style={{ background: "var(--dp-navy)", borderColor: "var(--dp-navy)" }}
      >
        <div className="flex gap-3 items-start">
          <span className="text-2xl">🏆</span>
          <div>
            <p className="dp-label" style={{ color: "rgba(255,255,255,0.6)" }}>Вердикт за период</p>
            <p className="font-semibold text-base" style={{ color: "#fff" }}>
              Отличный результат! Среднее качество выше 4.0 — ваш автомобиль получает достойный уход.
              Стоит пополнить запас Gyeon Bathe+ и Sonax Felgenreiniger.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PageAlgorithm() {
  const steps = [
    { icon: "Droplets", label: "Предварительная мойка", desc: "Смыть крупные загрязнения струей воды сверху вниз" },
    { icon: "Waves", label: "Бесконтактная мойка", desc: "Нанести Koch MES, выдержать 3–5 мин, смыть" },
    { icon: "HandHeart", label: "Двухфазная контактная", desc: "Шампунь Gyeon Bathe+, мягкая варежка, по секциям" },
    { icon: "Wind", label: "Сушка", desc: "Обдув компрессором + микрофибра плетением 600 г/м²" },
    { icon: "Eye", label: "Стёкла", desc: "Gtechniq W6 + газетная бумага или microfiber" },
    { icon: "Armchair", label: "Салон", desc: "Пылесос, APC 1:10 на пластик, стёкла изнутри" },
    { icon: "Shield", label: "Защитное покрытие", desc: "Koch FSE на влажный кузов, равномерно" },
  ];

  return (
    <div>
      <p className="dp-section-title">Алгоритм мойки</p>
      <div className="flex flex-col gap-4">
        {steps.map((s, i) => (
          <div key={i} className="dp-card p-5 flex gap-4 items-start dp-animate" style={{ animationDelay: `${i * 0.05}s` }}>
            <div
              className="rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ width: 48, height: 48, background: "rgba(30, 58, 95, 0.08)" }}
            >
              <Icon name={s.icon} size={22} style={{ color: "var(--dp-navy)" }} fallback="CircleAlert" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ width: 22, height: 22, background: "var(--dp-navy)", color: "#fff", fontSize: 11 }}
                >
                  {i + 1}
                </span>
                <p className="font-semibold text-sm" style={{ color: "var(--dp-text)" }}>{s.label}</p>
              </div>
              <p className="text-sm" style={{ color: "var(--dp-muted)", paddingLeft: 30 }}>{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PageRecommendations() {
  const tips = [
    { emoji: "🌡️", title: "Температурный режим", text: "Оптимальная температура для мойки +10...+25°C. При минусе используйте тёплую воду и не давайте химии замерзать на поверхности." },
    { emoji: "💧", title: "Качество воды", text: "Жёсткая вода оставляет белый осадок. Рекомендуется фильтр обратного осмоса или дистиллированная вода на финальном ополаскивании." },
    { emoji: "🧽", title: "Инструменты", text: "Заменяйте варежку после 15–20 моек. Микрофибру стирайте отдельно без кондиционера на 40°C." },
    { emoji: "⏱️", title: "Периодичность", text: "При активной эксплуатации — 1 раз в 2 недели. Защитное покрытие продлевает интервал до 4 недель в хорошую погоду." },
    { emoji: "🛡️", title: "Хранение химии", text: "Храните при +5...+25°C, вдали от прямых солнечных лучей. Плотно закрывайте крышки после использования." },
  ];

  return (
    <div>
      <p className="dp-section-title">Рекомендации</p>
      <div className="flex flex-col gap-4">
        {tips.map((t, i) => (
          <div key={i} className="dp-card p-5 dp-animate" style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="flex gap-3 items-start">
              <span className="text-2xl flex-shrink-0">{t.emoji}</span>
              <div>
                <p className="font-semibold text-base mb-1" style={{ color: "var(--dp-text)" }}>{t.title}</p>
                <p className="text-sm" style={{ color: "var(--dp-muted)", lineHeight: 1.6 }}>{t.text}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PageSettings() {
  const [carBrand, setCarBrand] = useState("Porsche");
  const [carModel, setCarModel] = useState("Cayenne");
  const [carYear, setCarYear] = useState("2023");
  const [tgToken, setTgToken] = useState("");
  const [tgChatId, setTgChatId] = useState("");
  const [notifyWash, setNotifyWash] = useState(true);
  const [notifyLowChem, setNotifyLowChem] = useState(true);
  const [notifyWeek, setNotifyWeek] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <p className="dp-section-title">Настройки</p>

      <div className="dp-card-lg p-6 dp-animate">
        <div className="flex items-center gap-2 mb-5">
          <Icon name="Car" size={20} style={{ color: "var(--dp-navy)" }} />
          <p className="font-bold text-base" style={{ color: "var(--dp-text)" }}>Мой автомобиль</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="dp-label">Марка</label>
            <input className="dp-input" value={carBrand} onChange={(e) => setCarBrand(e.target.value)} placeholder="BMW" />
          </div>
          <div>
            <label className="dp-label">Модель</label>
            <input className="dp-input" value={carModel} onChange={(e) => setCarModel(e.target.value)} placeholder="M5" />
          </div>
          <div>
            <label className="dp-label">Год</label>
            <input className="dp-input" value={carYear} onChange={(e) => setCarYear(e.target.value)} placeholder="2023" />
          </div>
        </div>
        <div className="mt-4">
          <label className="dp-label">Фото автомобиля</label>
          <div
            className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer"
            style={{ height: 100, borderColor: "var(--dp-border)", background: "var(--dp-bg)" }}
          >
            <Icon name="Upload" size={22} style={{ color: "var(--dp-muted)" }} />
            <span className="text-sm" style={{ color: "var(--dp-muted)" }}>Нажмите для загрузки фото</span>
          </div>
        </div>
        <button className="dp-btn-primary mt-4">
          <Icon name="Save" size={16} />
          Сохранить
        </button>
      </div>

      <div className="dp-card-lg p-6 dp-animate dp-animate-delay-1">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xl">✈️</span>
          <p className="font-bold text-base" style={{ color: "var(--dp-text)" }}>Telegram-уведомления</p>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label className="dp-label">Bot Token</label>
            <input
              className="dp-input"
              value={tgToken}
              onChange={(e) => setTgToken(e.target.value)}
              placeholder="123456789:ABC-DEF1234ghIkl-zyx57W2v..."
              type="password"
            />
            <p className="text-xs mt-1.5" style={{ color: "var(--dp-muted)" }}>
              Получить у @BotFather в Telegram
            </p>
          </div>
          <div>
            <label className="dp-label">Chat ID</label>
            <input
              className="dp-input"
              value={tgChatId}
              onChange={(e) => setTgChatId(e.target.value)}
              placeholder="-100123456789"
            />
            <p className="text-xs mt-1.5" style={{ color: "var(--dp-muted)" }}>
              Узнать через @userinfobot
            </p>
          </div>
          <button className="dp-btn-primary" style={{ alignSelf: "flex-start" }}>
            <Icon name="Send" size={16} />
            Проверить соединение
          </button>
        </div>
      </div>

      <div className="dp-card-lg p-6 dp-animate dp-animate-delay-2">
        <div className="flex items-center gap-2 mb-5">
          <Icon name="Bell" size={20} style={{ color: "var(--dp-navy)" }} />
          <p className="font-bold text-base" style={{ color: "var(--dp-text)" }}>Уведомления</p>
        </div>
        <div className="flex flex-col gap-5">
          {[
            { label: "Напоминание о мойке", desc: "Раз в 2 недели", value: notifyWash, set: setNotifyWash },
            { label: "Заканчивается химия", desc: "Когда остаток < 20%", value: notifyLowChem, set: setNotifyLowChem },
            { label: "Еженедельный отчёт", desc: "Сводка за неделю в воскресенье", value: notifyWeek, set: setNotifyWeek },
          ].map((n) => (
            <div key={n.label} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--dp-text)" }}>{n.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--dp-muted)" }}>{n.desc}</p>
              </div>
              <label className="dp-switch">
                <input type="checkbox" checked={n.value} onChange={(e) => n.set(e.target.checked)} />
                <span className="dp-switch-slider" />
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="dp-card p-5 dp-animate dp-animate-delay-3 flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm" style={{ color: "var(--dp-text)" }}>DetailPro</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--dp-muted)" }}>Версия 1.0.0 · Личный кабинет детейлинга</p>
        </div>
        <span className="text-2xl">🚗</span>
      </div>
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>("home");

  const renderPage = () => {
    switch (page) {
      case "home": return <PageHome chemicals={MOCK_CHEMICALS} />;
      case "chemistry": return <PageChemistry />;
      case "history": return <PageHistory />;
      case "stats": return <PageStats />;
      case "algorithm": return <PageAlgorithm />;
      case "recommendations": return <PageRecommendations />;
      case "settings": return <PageSettings />;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--dp-bg)" }}>

      {/* Header */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: "rgba(245, 245, 247, 0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--dp-border)",
        }}
      >
        {/* Hero strip with blurred car photo */}
        <div
          style={{
            background: `linear-gradient(to bottom, rgba(20,42,72,0.93) 0%, rgba(20,42,72,0.78) 100%), url('https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1400&q=80&fm=jpg') center 40%/cover no-repeat`,
            padding: "16px 24px 14px",
          }}
        >
          <div style={{ maxWidth: 960, margin: "0 auto" }} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="rounded-xl flex items-center justify-center"
                style={{ width: 34, height: 34, background: "rgba(255,255,255,0.15)" }}
              >
                <span style={{ fontSize: 18 }}>🚗</span>
              </div>
              <span className="font-black text-lg tracking-tight" style={{ color: "#fff" }}>DetailPro</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-xs px-3 py-1 rounded-full font-medium"
                style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)" }}
              >
                {new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
              </span>
            </div>
          </div>
        </div>

        {/* Horizontal nav */}
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <nav
            className="flex gap-1 px-4 py-2"
            style={{ maxWidth: 960, margin: "0 auto", minWidth: "max-content" }}
          >
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`dp-nav-item ${page === item.id ? "active" : ""}`}
                onClick={() => setPage(item.id)}
              >
                <Icon name={item.icon} size={18} fallback="Circle" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "28px 16px 120px" }}>
        <div key={page} className="dp-animate">
          {renderPage()}
        </div>
      </main>

      {/* Mobile bottom bar */}
      <div
        className="fixed bottom-0 left-0 right-0 sm:hidden z-50"
        style={{
          background: "rgba(245, 245, 247, 0.96)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid var(--dp-border)",
          padding: "8px 4px",
          paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
        }}
      >
        <nav className="flex justify-around">
          {NAV_ITEMS.slice(0, 5).map((item) => (
            <button
              key={item.id}
              className={`dp-nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => setPage(item.id)}
              style={{ minWidth: 0, flex: 1, padding: "6px 2px" }}
            >
              <Icon name={item.icon} size={20} fallback="Circle" />
              <span style={{ fontSize: 10 }}>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
