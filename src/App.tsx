import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";

// ─── Types ────────────────────────────────────────────────────────────────────

type Page = "home" | "chemistry" | "history" | "stats" | "algorithm" | "recommendations" | "settings";

interface Chemical {
  id: string;
  name: string;
  comment: string;
  volume: number;
  remainder: number;
  spendPerWash: number;
  photo: string | null;
  color: string;
}

interface WashStep { label: string; done: boolean }

interface WashRecord {
  id: string;
  date: string;
  dateTs: number;
  duration: string;
  durationSec: number;
  comment: string;
  quality: number;
  chemicals: string[];
  stepsBefore: WashStep[];
  photosBefore: string[];
  photosAfter: string[];
}

interface Settings {
  carBrand: string;
  carModel: string;
  carYear: string;
  carPhoto: string | null;
  tgToken: string;
  tgChatId: string;
  notifyWash: boolean;
  notifyLowChem: boolean;
  notifyWeek: boolean;
  notifyMorning: boolean;
  city: string;
  geoAsked: boolean;
  orderList: string[];
  lastMorningNotif: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_STEPS: WashStep[] = [
  { label: "Предварительная", done: false },
  { label: "Бесконтактная", done: false },
  { label: "Двухфазная", done: false },
  { label: "Сушка", done: false },
  { label: "Стёкла", done: false },
  { label: "Салон", done: false },
  { label: "Защита", done: false },
];

const DEFAULT_SETTINGS: Settings = {
  carBrand: "", carModel: "", carYear: "",
  carPhoto: null,
  tgToken: "", tgChatId: "",
  notifyWash: true, notifyLowChem: true, notifyWeek: false, notifyMorning: false,
  city: "Москва", geoAsked: false,
  orderList: [],
  lastMorningNotif: "",
};

const CHEM_COLORS = ["#E8F4FF","#FFF3E0","#F3E5F5","#E8F5E9","#FFF8E1","#FCE4EC","#E0F2F1","#F9FBE7"];

const NAV_ITEMS = [
  { id: "home" as Page, label: "Главная", icon: "Home" },
  { id: "chemistry" as Page, label: "Химия", icon: "FlaskConical" },
  { id: "history" as Page, label: "История", icon: "History" },
  { id: "stats" as Page, label: "Статистика", icon: "BarChart3" },
  { id: "algorithm" as Page, label: "Алгоритм", icon: "ListChecks" },
  { id: "recommendations" as Page, label: "Советы", icon: "Lightbulb" },
  { id: "settings" as Page, label: "Настройки", icon: "Settings" },
];

// ─── LocalStorage helpers ────────────────────────────────────────────────────

function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch { return fallback; }
}
function lsSet(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota */ }
}

// ─── Image compression ───────────────────────────────────────────────────────

function compressImage(file: File, maxW = 800): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(1, maxW / img.width);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ─── Telegram sender ─────────────────────────────────────────────────────────

async function tgSend(token: string, chatId: string, text: string): Promise<boolean> {
  if (!token || !chatId) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    return r.ok;
  } catch { return false; }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function remColor(pct: number) {
  if (pct > 50) return "var(--dp-green)";
  if (pct > 20) return "var(--dp-yellow)";
  return "var(--dp-red)";
}
function remLabel(pct: number) {
  if (pct > 50) return "Достаточно";
  if (pct > 20) return "Заканчивается";
  return "Критично";
}
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
function fmtDur(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}ч ${m}мин`;
  if (m > 0) return `${m}мин ${s}с`;
  return `${s}с`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastItem { id: number; msg: string; ok: boolean }
let _toastId = 0;
let _addToast: ((msg: string, ok?: boolean) => void) | null = null;

function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  _addToast = useCallback((msg: string, ok = true) => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, msg, ok }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);
  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 z-[300] flex flex-col gap-2" style={{ maxWidth: 320 }}>
      {toasts.map((t) => (
        <div key={t.id} className="dp-animate rounded-2xl px-4 py-3 text-sm font-medium flex items-center gap-2"
          style={{ background: t.ok ? "var(--dp-navy)" : "var(--dp-red)", color: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
          <Icon name={t.ok ? "CheckCircle2" : "AlertCircle"} size={16} />
          {t.msg}
        </div>
      ))}
    </div>
  );
}
function toast(msg: string, ok = true) { _addToast?.(msg, ok); }

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(10,20,35,0.65)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="dp-card-lg w-full max-w-lg dp-animate"
        style={{ padding: "26px 22px 30px", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <p className="font-bold text-xl" style={{ color: "var(--dp-text)" }}>{title}</p>
          <button onClick={onClose} className="dp-btn-ghost" style={{ padding: "6px 10px", borderColor: "transparent" }}>
            <Icon name="X" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Stopwatch ────────────────────────────────────────────────────────────────

function Stopwatch({ settings, onStop }: { settings: Settings; onStop: (sec: number) => void }) {
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) ref.current = setInterval(() => setTime((t) => t + 1), 1000);
    else if (ref.current) clearInterval(ref.current);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);

  const fmt = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(time / 3600);
  const m = Math.floor((time % 3600) / 60);
  const s = time % 60;

  const handleStart = async () => {
    setRunning(true);
    if (settings.tgToken && settings.tgChatId) {
      const chems = lsGet<Chemical[]>("dp_chemicals", []);
      const chemList = chems.length ? chems.map((c) => `• ${c.name} (${c.remainder} мл)`).join("\n") : "Химия не добавлена";
      const stepsList = DEFAULT_STEPS.map((s) => `⬜ ${s.label}`).join("\n");
      const msg = `🚗 <b>Мойка начата!</b>\n${settings.carBrand} ${settings.carModel}\n\n<b>Этапы:</b>\n${stepsList}\n\n<b>Химия:</b>\n${chemList}`;
      const ok = await tgSend(settings.tgToken, settings.tgChatId, msg);
      toast(ok ? "Уведомление в Telegram отправлено" : "Telegram: ошибка отправки", ok);
    }
  };

  const handleStop = () => {
    setRunning(false);
    onStop(time);
    toast(`Мойка завершена: ${fmtDur(time)}`);
  };

  return (
    <div className="dp-card-lg p-8 flex flex-col items-center gap-6">
      <p className="dp-label" style={{ marginBottom: 0 }}>Секундомер мойки</p>
      <div
        className="font-golos font-black tracking-tight select-none"
        style={{
          fontSize: "clamp(52px,14vw,88px)",
          color: running ? "var(--dp-navy)" : "var(--dp-muted)",
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
          transition: "color 0.3s",
        }}
      >
        {fmt(h)}:{fmt(m)}:{fmt(s)}
      </div>
      <div className="flex gap-3 flex-wrap justify-center">
        {!running ? (
          <button className="dp-btn-primary" onClick={handleStart} style={{ minWidth: 130, justifyContent: "center" }}>
            <Icon name="Play" size={16} />Старт мойки
          </button>
        ) : (
          <button className="dp-btn-primary" onClick={handleStop}
            style={{ minWidth: 130, justifyContent: "center", background: "var(--dp-red)" }}>
            <Icon name="Square" size={16} />Завершить
          </button>
        )}
        <button className="dp-btn-ghost" onClick={() => { setRunning(false); setTime(0); }}>
          <Icon name="RotateCcw" size={16} />Сброс
        </button>
      </div>
    </div>
  );
}

// ─── Chemical Form ────────────────────────────────────────────────────────────

function ChemicalForm({ onSave, onClose, initial }: {
  onSave: (c: Chemical) => void;
  onClose: () => void;
  initial?: Chemical | null;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [volume, setVolume] = useState(String(initial?.volume ?? 500));
  const [spend, setSpend] = useState(String(initial?.spendPerWash ?? 30));
  const [photo, setPhoto] = useState<string | null>(initial?.photo ?? null);
  const color = initial?.color ?? CHEM_COLORS[Math.floor(Math.random() * CHEM_COLORS.length)];

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setPhoto(await compressImage(f, 600));
  };

  const save = () => {
    if (!name.trim()) { toast("Введите название", false); return; }
    onSave({
      id: initial?.id ?? Date.now().toString(),
      name: name.trim(),
      comment: comment.trim(),
      volume: Number(volume) || 500,
      remainder: initial?.remainder ?? (Number(volume) || 500),
      spendPerWash: Number(spend) || 30,
      photo,
      color,
    });
  };

  return (
    <Modal title={initial ? "Редактировать химию" : "Добавить химию"} onClose={onClose}>
      {photo ? (
        <div className="relative mb-4">
          <img src={photo} className="w-full rounded-2xl object-cover" style={{ height: 130 }} />
          <button onClick={() => setPhoto(null)} className="absolute top-2 right-2 dp-btn-ghost"
            style={{ padding: "4px 8px", background: "rgba(0,0,0,0.5)", color: "#fff", borderColor: "transparent" }}>
            <Icon name="X" size={14} />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed cursor-pointer mb-4"
          style={{ height: 90, borderColor: "var(--dp-border)", background: "var(--dp-bg)" }}>
          <Icon name="Camera" size={22} style={{ color: "var(--dp-muted)" }} />
          <span className="text-sm" style={{ color: "var(--dp-muted)" }}>Фото баночки</span>
          <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </label>
      )}
      <div className="flex flex-col gap-4">
        <div>
          <label className="dp-label">Название *</label>
          <input className="dp-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Koch Chemie MES" />
        </div>
        <div>
          <label className="dp-label">Комментарий</label>
          <input className="dp-input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="pH нейтральный, для кузова" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="dp-label">Объём (мл)</label>
            <input type="number" className="dp-input" value={volume} onChange={(e) => setVolume(e.target.value)} />
          </div>
          <div>
            <label className="dp-label">Расход/мойка (мл)</label>
            <input type="number" className="dp-input" value={spend} onChange={(e) => setSpend(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button className="dp-btn-primary flex-1" style={{ justifyContent: "center" }} onClick={save}>
            <Icon name="Save" size={16} />{initial ? "Сохранить" : "Добавить"}
          </button>
          <button className="dp-btn-ghost" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Chemical Card ────────────────────────────────────────────────────────────

function ChemicalCard({ chem, onDelete, onEdit, onRemainder, onOrder, settings }: {
  chem: Chemical;
  onDelete: (id: string) => void;
  onEdit: (c: Chemical) => void;
  onRemainder: (id: string, val: number) => void;
  onOrder: (name: string) => void;
  settings: Settings;
}) {
  const pct = Math.max(0, Math.round((chem.remainder / chem.volume) * 100));
  const color = remColor(pct);

  const handleSlider = (val: number) => {
    onRemainder(chem.id, val);
    const p = Math.round((val / chem.volume) * 100);
    if (p <= 20 && settings.tgToken && settings.tgChatId && settings.notifyLowChem) {
      tgSend(settings.tgToken, settings.tgChatId,
        `⚠️ <b>${chem.name}</b> заканчивается!\nОсталось: ${val} мл (${p}%)`);
    }
  };

  return (
    <div className="dp-card p-5 flex flex-col gap-3 dp-animate">
      <div className="rounded-2xl overflow-hidden flex items-center justify-center"
        style={{ height: 80, background: chem.photo ? "transparent" : chem.color }}>
        {chem.photo
          ? <img src={chem.photo} className="w-full h-full object-cover" />
          : <Icon name="FlaskConical" size={32} style={{ color: "var(--dp-navy)", opacity: 0.4 }} />}
      </div>
      <div>
        <p className="font-semibold text-sm leading-tight" style={{ color: "var(--dp-text)" }}>{chem.name}</p>
        {chem.comment && <p className="text-xs mt-0.5" style={{ color: "var(--dp-muted)" }}>{chem.comment}</p>}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <span className="dp-tag" style={{ background: "var(--dp-bg)", color: "var(--dp-muted)", fontSize: 11 }}>📦 {chem.volume} мл</span>
        <span className="dp-tag" style={{ background: "var(--dp-bg)", color: "var(--dp-muted)", fontSize: 11 }}>💧 {chem.spendPerWash} мл/мойка</span>
      </div>
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-semibold" style={{ color }}>{remLabel(pct)} · {pct}%</span>
          <span className="text-xs font-bold" style={{ color: "var(--dp-text)" }}>{chem.remainder} мл</span>
        </div>
        <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "var(--dp-bg)" }}>
          <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, background: color }} />
        </div>
        <input type="range" className="dp-slider mt-2.5"
          min={0} max={chem.volume} value={chem.remainder}
          onChange={(e) => handleSlider(Number(e.target.value))}
          style={{ background: `linear-gradient(to right, ${color} ${pct}%, var(--dp-bg) ${pct}%)` }}
        />
      </div>
      <div className="flex gap-2 mt-1">
        <button className="dp-btn-ghost" style={{ padding: "7px 10px" }} onClick={() => onEdit(chem)}>
          <Icon name="Pencil" size={14} />
        </button>
        <button className="dp-btn-ghost flex-1" style={{ justifyContent: "center", fontSize: 12, padding: "7px" }}
          onClick={() => { onOrder(chem.name); toast(`${chem.name} — в список заказа`); }}>
          <Icon name="ShoppingCart" size={14} />Заказать
        </button>
        <button onClick={() => onDelete(chem.id)} className="dp-btn-ghost"
          style={{ padding: "7px 10px", color: "var(--dp-red)", borderColor: "transparent" }}>
          <Icon name="Trash2" size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Wash Form ────────────────────────────────────────────────────────────────

function WashForm({ chemicals, onSave, onClose, lastDuration }: {
  chemicals: Chemical[];
  onSave: (rec: WashRecord, usedIds: string[]) => void;
  onClose: () => void;
  lastDuration: number;
}) {
  const [steps, setSteps] = useState<WashStep[]>(DEFAULT_STEPS.map((s) => ({ ...s })));
  const [comment, setComment] = useState("");
  const [quality, setQuality] = useState(4);
  const [selChem, setSelChem] = useState<string[]>([]);
  const [photosBefore, setPhotosBefore] = useState<string[]>([]);
  const [photosAfter, setPhotosAfter] = useState<string[]>([]);
  const [dur] = useState(lastDuration > 0 ? fmtDur(lastDuration) : "");

  const toggleStep = (i: number) =>
    setSteps((p) => p.map((s, idx) => idx === i ? { ...s, done: !s.done } : s));
  const toggleChem = (id: string) =>
    setSelChem((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const handlePhotos = async (e: React.ChangeEvent<HTMLInputElement>, which: "before" | "after") => {
    const files = Array.from(e.target.files ?? []);
    const b64s = await Promise.all(files.map((f) => compressImage(f)));
    if (which === "before") setPhotosBefore((p) => [...p, ...b64s].slice(0, 9));
    else setPhotosAfter((p) => [...p, ...b64s].slice(0, 9));
  };

  const save = () => {
    const rec: WashRecord = {
      id: Date.now().toString(),
      date: fmtDate(Date.now()),
      dateTs: Date.now(),
      duration: dur || "—",
      durationSec: lastDuration,
      comment,
      quality,
      chemicals: selChem.map((id) => chemicals.find((c) => c.id === id)?.name ?? "").filter(Boolean),
      stepsBefore: steps,
      photosBefore,
      photosAfter,
    };
    onSave(rec, selChem);
  };

  const PhotoGrid = ({ photos, setPhotos, which }: { photos: string[]; setPhotos: React.Dispatch<React.SetStateAction<string[]>>; which: "before" | "after" }) => (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((p, i) => (
        <div key={i} className="relative rounded-xl overflow-hidden" style={{ aspectRatio: "1" }}>
          <img src={p} className="w-full h-full object-cover" />
          <button
            onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
            className="absolute top-1 right-1 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.55)", color: "#fff", width: 20, height: 20, border: "none", cursor: "pointer" }}
          >
            <Icon name="X" size={10} />
          </button>
        </div>
      ))}
      {photos.length < 9 && (
        <label className="dp-photo-slot" style={{ aspectRatio: "1" }}>
          <Icon name="Plus" size={18} />
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handlePhotos(e, which)} />
        </label>
      )}
    </div>
  );

  return (
    <Modal title="Новая мойка" onClose={onClose}>
      <div className="flex flex-col gap-5">
        {/* Quality */}
        <div>
          <label className="dp-label">Оценка качества</label>
          <div className="flex gap-1.5 mt-1">
            {[1,2,3,4,5].map((n) => (
              <span key={n} onClick={() => setQuality(n)}
                style={{ fontSize: 26, cursor: "pointer", opacity: n <= quality ? 1 : 0.25, transition: "opacity 0.15s" }}>
                ⭐
              </span>
            ))}
          </div>
        </div>

        {/* Duration */}
        {dur && (
          <div className="dp-tag" style={{ alignSelf: "flex-start" }}>
            <Icon name="Clock" size={13} className="inline mr-1" />
            Время по секундомеру: {dur}
          </div>
        )}

        {/* Comment */}
        <div>
          <label className="dp-label">Комментарий</label>
          <textarea className="dp-input" style={{ resize: "vertical", minHeight: 70 }}
            value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Что получилось, что можно улучшить..." />
        </div>

        {/* Steps */}
        <div>
          <label className="dp-label">Выполненные этапы</label>
          <div className="grid grid-cols-2 gap-2">
            {steps.map((s, i) => (
              <label key={i} className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" className="dp-checkbox" checked={s.done} onChange={() => toggleStep(i)} />
                <span className="text-sm" style={{ color: "var(--dp-text)" }}>{s.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Chemicals */}
        {chemicals.length > 0 && (
          <div>
            <label className="dp-label">Использованная химия (спишем расход автоматически)</label>
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
              {chemicals.map((c) => {
                const pct = Math.round((c.remainder / c.volume) * 100);
                return (
                  <label key={c.id} className="flex items-center gap-3 cursor-pointer select-none p-2.5 rounded-xl"
                    style={{ background: selChem.includes(c.id) ? "rgba(30,58,95,0.06)" : "transparent" }}>
                    <input type="checkbox" className="dp-checkbox" checked={selChem.includes(c.id)} onChange={() => toggleChem(c.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--dp-text)" }}>{c.name}</p>
                      <p className="text-xs" style={{ color: "var(--dp-muted)" }}>−{c.spendPerWash} мл</p>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: remColor(pct) }}>{c.remainder} мл</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Photos */}
        <div>
          <label className="dp-label">Фото «До» ({photosBefore.length}/9)</label>
          <PhotoGrid photos={photosBefore} setPhotos={setPhotosBefore} which="before" />
        </div>
        <div>
          <label className="dp-label">Фото «После» ({photosAfter.length}/9)</label>
          <PhotoGrid photos={photosAfter} setPhotos={setPhotosAfter} which="after" />
        </div>

        <div className="flex gap-3 pt-1">
          <button className="dp-btn-primary flex-1" style={{ justifyContent: "center" }} onClick={save}>
            <Icon name="Save" size={16} />Сохранить мойку
          </button>
          <button className="dp-btn-ghost" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Wash Card ────────────────────────────────────────────────────────────────

function WashCard({ record, onDelete }: { record: WashRecord; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="dp-card-lg p-6 flex flex-col gap-4 dp-animate">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-lg" style={{ color: "var(--dp-text)" }}>{record.date}</p>
          <div className="flex gap-2 items-center mt-1 flex-wrap">
            <span className="text-sm flex items-center gap-1" style={{ color: "var(--dp-muted)" }}>
              <Icon name="Clock" size={13} />{record.duration}
            </span>
            <span className="dp-tag">{"⭐".repeat(record.quality)} {record.quality}/5</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="dp-btn-ghost" style={{ padding: "7px 12px" }} onClick={() => setExpanded((e) => !e)}>
            <Icon name={expanded ? "ChevronUp" : "ChevronDown"} size={16} />
          </button>
          <button className="dp-btn-ghost"
            style={{ padding: "7px 12px", color: "var(--dp-red)", borderColor: "transparent" }}
            onClick={() => onDelete(record.id)}>
            <Icon name="Trash2" size={15} />
          </button>
        </div>
      </div>

      {/* Photos */}
      {(record.photosBefore?.length > 0 || record.photosAfter?.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {(["До", "После"] as const).map((label, li) => {
            const photos = li === 0 ? record.photosBefore : record.photosAfter;
            if (!photos?.length) return null;
            return (
              <div key={label}>
                <p className="dp-label">{label}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {photos.slice(0, 3).map((p, i) => (
                    <div key={i} className="rounded-xl overflow-hidden" style={{ aspectRatio: "1" }}>
                      <img src={p} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {record.comment && (
        <p className="text-sm" style={{ color: "var(--dp-text)", lineHeight: 1.6 }}>{record.comment}</p>
      )}

      {record.chemicals?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {record.chemicals.map((c) => <span key={c} className="dp-tag">{c}</span>)}
        </div>
      )}

      {expanded && record.stepsBefore?.length > 0 && (
        <div>
          <p className="dp-label">Этапы</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {record.stepsBefore.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span style={{ fontSize: 16 }}>{s.done ? "✅" : "⬜"}</span>
                <span className="text-sm" style={{ color: s.done ? "var(--dp-text)" : "var(--dp-muted)" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pages ────────────────────────────────────────────────────────────────────

function PageHome({ chemicals, settings, lastDuration, onStop }: {
  chemicals: Chemical[];
  settings: Settings;
  lastDuration: number;
  onStop: (sec: number) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="dp-card p-5 dp-animate">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ width: 52, height: 52, background: "linear-gradient(135deg,#74b9ff,#0984e3)" }}>☀️</div>
            <div>
              <p className="font-bold text-2xl" style={{ color: "var(--dp-navy)" }}>+22°C</p>
              <p className="text-xs" style={{ color: "var(--dp-muted)" }}>{settings.city} · Ясно</p>
            </div>
          </div>
          {(settings.carBrand || settings.carModel) && (
            <div className="flex items-center gap-2">
              <Icon name="Car" size={18} style={{ color: "var(--dp-navy)" }} />
              <span className="font-semibold" style={{ color: "var(--dp-text)" }}>
                {settings.carBrand} {settings.carModel} {settings.carYear}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="dp-animate dp-animate-delay-1">
        <Stopwatch settings={settings} onStop={onStop} />
      </div>

      <div className="dp-card p-5 dp-animate dp-animate-delay-2" style={{ borderLeft: "4px solid var(--dp-navy)" }}>
        <p className="dp-label" style={{ marginBottom: 4 }}>Рекомендация дня</p>
        <p className="font-medium" style={{ color: "var(--dp-text)" }}>
          💡 Оптимальная температура для мойки +10...+25°C. Сегодня условия идеальные — самое время навести блеск!
        </p>
      </div>

      {chemicals.length > 0 ? (
        <div className="dp-animate dp-animate-delay-3">
          <p className="dp-section-title" style={{ marginBottom: 12 }}>Баланс химии</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {chemicals.slice(0, 8).map((c) => {
              const pct = Math.max(0, Math.round((c.remainder / c.volume) * 100));
              const color = remColor(pct);
              return (
                <div key={c.id} className="dp-metric-card">
                  <p className="font-semibold text-xs mb-2 leading-tight truncate" style={{ color: "var(--dp-text)" }}>{c.name}</p>
                  <div className="h-1.5 rounded-full mb-2" style={{ background: "var(--dp-bg)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
                    <span className="text-xs" style={{ color: "var(--dp-muted)" }}>{c.remainder} мл</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="dp-card p-8 flex flex-col items-center gap-3 dp-animate dp-animate-delay-3" style={{ textAlign: "center" }}>
          <span className="text-4xl">🧪</span>
          <p className="font-semibold" style={{ color: "var(--dp-text)" }}>Склад химии пуст</p>
          <p className="text-sm" style={{ color: "var(--dp-muted)" }}>Перейдите в раздел «Химия», чтобы добавить средства</p>
        </div>
      )}
    </div>
  );
}

function PageChemistry({ chemicals, setChemicals, settings }: {
  chemicals: Chemical[];
  setChemicals: React.Dispatch<React.SetStateAction<Chemical[]>>;
  settings: Settings;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editChem, setEditChem] = useState<Chemical | null>(null);

  const save = (list: Chemical[]) => { setChemicals(list); lsSet("dp_chemicals", list); };

  const handleSave = (c: Chemical) => {
    const next = chemicals.find((x) => x.id === c.id)
      ? chemicals.map((x) => x.id === c.id ? c : x)
      : [c, ...chemicals];
    save(next);
    setShowForm(false); setEditChem(null);
    toast(chemicals.find((x) => x.id === c.id) ? "Обновлено" : "Химия добавлена");
  };

  const handleRemainder = (id: string, val: number) => {
    const next = chemicals.map((c) => c.id === id ? { ...c, remainder: val } : c);
    save(next);
    const chem = next.find((c) => c.id === id);
    if (chem && settings.notifyLowChem && settings.tgToken && settings.tgChatId) {
      const pct = Math.round((val / chem.volume) * 100);
      if (pct <= 20) tgSend(settings.tgToken, settings.tgChatId,
        `⚠️ <b>${chem.name}</b> заканчивается!\nОсталось: ${val} мл (${pct}%)`);
    }
  };

  const handleOrder = (name: string) => {
    const s = lsGet<Settings>("dp_settings", DEFAULT_SETTINGS);
    if (!s.orderList.includes(name)) {
      const u = { ...s, orderList: [...s.orderList, name] };
      lsSet("dp_settings", u);
    }
  };

  return (
    <div>
      {(showForm || editChem) && (
        <ChemicalForm onSave={handleSave} onClose={() => { setShowForm(false); setEditChem(null); }} initial={editChem} />
      )}
      <div className="flex items-center justify-between mb-6">
        <p className="dp-section-title" style={{ marginBottom: 0 }}>Склад ({chemicals.length})</p>
        <button className="dp-btn-primary" onClick={() => setShowForm(true)}>
          <Icon name="Plus" size={16} />Добавить
        </button>
      </div>
      {chemicals.length === 0 ? (
        <div className="dp-card p-12 flex flex-col items-center gap-3" style={{ textAlign: "center" }}>
          <span className="text-5xl">🧪</span>
          <p className="font-bold text-lg" style={{ color: "var(--dp-text)" }}>Склад пуст</p>
          <p className="text-sm" style={{ color: "var(--dp-muted)" }}>Нажмите «Добавить», чтобы занести первое средство</p>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
          {chemicals.map((c) => (
            <ChemicalCard key={c.id} chem={c}
              onDelete={(id) => { save(chemicals.filter((x) => x.id !== id)); toast("Удалено"); }}
              onEdit={setEditChem} onRemainder={handleRemainder}
              onOrder={handleOrder} settings={settings} />
          ))}
        </div>
      )}
    </div>
  );
}

function PageHistory({ records, setRecords, chemicals, setChemicals, lastDuration }: {
  records: WashRecord[];
  setRecords: React.Dispatch<React.SetStateAction<WashRecord[]>>;
  chemicals: Chemical[];
  setChemicals: React.Dispatch<React.SetStateAction<Chemical[]>>;
  lastDuration: number;
}) {
  const [showForm, setShowForm] = useState(false);

  const handleSave = (rec: WashRecord, usedIds: string[]) => {
    const next = [rec, ...records];
    setRecords(next); lsSet("dp_history", next);
    const updChems = chemicals.map((c) =>
      usedIds.includes(c.id) ? { ...c, remainder: Math.max(0, c.remainder - c.spendPerWash) } : c
    );
    setChemicals(updChems); lsSet("dp_chemicals", updChems);
    setShowForm(false);
    toast("Мойка сохранена!");
  };

  const handleDelete = (id: string) => {
    const next = records.filter((r) => r.id !== id);
    setRecords(next); lsSet("dp_history", next);
    toast("Запись удалена");
  };

  return (
    <div>
      {showForm && <WashForm chemicals={chemicals} onSave={handleSave} onClose={() => setShowForm(false)} lastDuration={lastDuration} />}
      <div className="flex items-center justify-between mb-6">
        <p className="dp-section-title" style={{ marginBottom: 0 }}>История ({records.length})</p>
        <button className="dp-btn-primary" onClick={() => setShowForm(true)}>
          <Icon name="Plus" size={16} />Новая мойка
        </button>
      </div>
      {records.length === 0 ? (
        <div className="dp-card p-12 flex flex-col items-center gap-3" style={{ textAlign: "center" }}>
          <span className="text-5xl">🚗</span>
          <p className="font-bold text-lg" style={{ color: "var(--dp-text)" }}>Моек пока нет</p>
          <p className="text-sm" style={{ color: "var(--dp-muted)" }}>Запустите секундомер и добавьте первую запись</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {records.map((r) => <WashCard key={r.id} record={r} onDelete={handleDelete} />)}
        </div>
      )}
    </div>
  );
}

function PageStats({ records, chemicals }: { records: WashRecord[]; chemicals: Chemical[] }) {
  const [period, setPeriod] = useState<"week" | "month" | "all">("month");

  const now = Date.now();
  const filtered = records.filter((r) => {
    if (period === "week") return now - r.dateTs < 7 * 86400_000;
    if (period === "month") return now - r.dateTs < 30 * 86400_000;
    return true;
  });

  const totalSec = filtered.reduce((a, r) => a + (r.durationSec || 0), 0);
  const avgQ = filtered.length ? (filtered.reduce((a, r) => a + r.quality, 0) / filtered.length).toFixed(1) : "—";

  const chemSpend: Record<string, number> = {};
  filtered.forEach((r) => {
    r.chemicals?.forEach((name) => {
      const chem = chemicals.find((c) => c.name === name);
      if (chem) chemSpend[name] = (chemSpend[name] ?? 0) + chem.spendPerWash;
    });
  });
  const chemArr = Object.entries(chemSpend).sort((a, b) => b[1] - a[1]);
  const maxSpend = chemArr[0]?.[1] ?? 1;

  const verdict = () => {
    if (!filtered.length) return "Нет данных. Добавьте первую мойку в разделе «История»!";
    const q = parseFloat(avgQ as string);
    if (q >= 4.5) return "🏆 Великолепно! Средний балл выше 4.5 — детейлинг на высоте.";
    if (q >= 3.5) return "👍 Хороший результат. Обратите внимание на финальные этапы.";
    return "💪 Есть куда расти. Не пропускайте этапы и фиксируйте результат!";
  };

  const metrics = [
    { label: "Моек", value: String(filtered.length), icon: "Droplets", color: "#1E3A5F" },
    { label: "Ср. качество", value: `${avgQ}/5`, icon: "Star", color: "#F5A623" },
    { label: "Общее время", value: totalSec > 0 ? fmtDur(totalSec) : "—", icon: "Clock", color: "#34C759" },
    { label: "Видов химии", value: String(Object.keys(chemSpend).length), icon: "FlaskConical", color: "#9B59B6" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <p className="dp-section-title" style={{ marginBottom: 0 }}>Статистика</p>
      <div className="dp-card p-4 flex gap-2 dp-animate">
        {(["week","month","all"] as const).map((p) => {
          const labels = { week: "Неделя", month: "Месяц", all: "Всё время" };
          return (
            <button key={p} onClick={() => setPeriod(p)} className="dp-btn-ghost"
              style={{ background: period===p?"var(--dp-navy)":"transparent", color: period===p?"#fff":"var(--dp-navy)", borderColor: period===p?"var(--dp-navy)":"var(--dp-border)" }}>
              {labels[p]}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 dp-animate dp-animate-delay-1">
        {metrics.map((m) => (
          <div key={m.label} className="dp-metric-card flex flex-col gap-2">
            <div className="rounded-xl flex items-center justify-center" style={{ width: 40, height: 40, background: `${m.color}18` }}>
              <Icon name={m.icon} size={20} style={{ color: m.color }} fallback="CircleAlert" />
            </div>
            <p className="font-black text-2xl" style={{ color: "var(--dp-text)" }}>{m.value}</p>
            <p className="text-xs" style={{ color: "var(--dp-muted)" }}>{m.label}</p>
          </div>
        ))}
      </div>
      {chemArr.length > 0 && (
        <div className="dp-card-lg p-6 dp-animate dp-animate-delay-2">
          <p className="font-bold text-base mb-4" style={{ color: "var(--dp-text)" }}>Расход по химии</p>
          <div className="flex flex-col gap-3">
            {chemArr.map(([name, spent]) => (
              <div key={name} className="flex items-center gap-3">
                <p className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--dp-text)" }}>{name}</p>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--dp-bg)", minWidth: 60 }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.round(spent/maxSpend*100)}%`, background: "var(--dp-navy)", opacity: 0.8 }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: "var(--dp-navy)", minWidth: 55, textAlign: "right" }}>{spent} мл</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="dp-card-lg p-6 dp-animate dp-animate-delay-3"
        style={{ background: "var(--dp-navy)", borderColor: "var(--dp-navy)" }}>
        <div className="flex gap-3 items-start">
          <span className="text-2xl flex-shrink-0">📊</span>
          <div>
            <p className="dp-label" style={{ color: "rgba(255,255,255,0.55)" }}>Вердикт</p>
            <p className="font-semibold" style={{ color: "#fff", lineHeight: 1.65 }}>{verdict()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PageAlgorithm() {
  const steps = [
    { icon: "Droplets", label: "Предварительная мойка", desc: "Смыть крупные загрязнения струей воды сверху вниз" },
    { icon: "Waves", label: "Бесконтактная мойка", desc: "Нанести Koch MES, выдержать 3–5 мин, смыть под давлением" },
    { icon: "HandHeart", label: "Двухфазная контактная", desc: "Шампунь + мягкая варежка, секционно, без давления" },
    { icon: "Wind", label: "Сушка", desc: "Обдув компрессором + микрофибра 600 г/м²" },
    { icon: "Eye", label: "Стёкла", desc: "Gtechniq W6 + microfiber без ворса, сухой метод" },
    { icon: "Armchair", label: "Салон", desc: "Пылесос, APC 1:10 на пластик, стёкла изнутри" },
    { icon: "Shield", label: "Защитное покрытие", desc: "Koch FSE на влажный кузов, равномерно секциями" },
  ];
  return (
    <div>
      <p className="dp-section-title">Алгоритм мойки</p>
      <div className="flex flex-col gap-4">
        {steps.map((s, i) => (
          <div key={i} className="dp-card p-5 flex gap-4 items-start dp-animate" style={{ animationDelay: `${i*0.04}s` }}>
            <div className="rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ width: 48, height: 48, background: "rgba(30,58,95,0.08)" }}>
              <Icon name={s.icon} size={22} style={{ color: "var(--dp-navy)" }} fallback="CircleAlert" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ width: 22, height: 22, background: "var(--dp-navy)", color: "#fff", fontSize: 11 }}>{i+1}</span>
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
    { emoji: "🌡️", title: "Температурный режим", text: "Оптимально +10...+25°C. При минусе не давайте химии замерзать на поверхности." },
    { emoji: "💧", title: "Качество воды", text: "Жёсткая вода оставляет белый осадок. Используйте дистиллят или фильтр ОО на финальном ополаскивании." },
    { emoji: "🧽", title: "Инструменты", text: "Заменяйте варежку каждые 15–20 моек. Микрофибру стирайте без кондиционера на 40°C." },
    { emoji: "⏱️", title: "Периодичность", text: "При активной эксплуатации — раз в 2 недели. Защитное покрытие продлевает интервал до 4 недель." },
    { emoji: "🛡️", title: "Хранение химии", text: "Храните при +5...+25°C, вдали от прямых лучей. Плотно закрывайте крышки." },
    { emoji: "🔬", title: "pH-совместимость", text: "Не смешивайте кислотные и щелочные средства. Проверяйте маркировку перед нанесением." },
  ];
  return (
    <div>
      <p className="dp-section-title">Рекомендации</p>
      <div className="flex flex-col gap-4">
        {tips.map((t, i) => (
          <div key={i} className="dp-card p-5 dp-animate" style={{ animationDelay: `${i*0.05}s` }}>
            <div className="flex gap-3 items-start">
              <span className="text-2xl flex-shrink-0">{t.emoji}</span>
              <div>
                <p className="font-semibold text-base mb-1" style={{ color: "var(--dp-text)" }}>{t.title}</p>
                <p className="text-sm" style={{ color: "var(--dp-muted)", lineHeight: 1.65 }}>{t.text}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PageSettings({ settings, setSettings }: {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}) {
  const [local, setLocal] = useState({ ...settings });
  const [tgStatus, setTgStatus] = useState<"idle"|"ok"|"err">("idle");

  const upd = <K extends keyof Settings>(k: K, v: Settings[K]) => setLocal((p) => ({ ...p, [k]: v }));

  const save = () => { setSettings(local); lsSet("dp_settings", local); toast("Настройки сохранены"); };

  const handleCarPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upd("carPhoto", await compressImage(f, 1200));
  };

  const testTg = async () => {
    const ok = await tgSend(local.tgToken, local.tgChatId, "✅ <b>DetailPro</b>: соединение установлено!");
    setTgStatus(ok ? "ok" : "err");
    toast(ok ? "Telegram работает!" : "Ошибка: проверьте токен и Chat ID", ok);
  };

  const exportData = () => {
    const data = { chemicals: lsGet("dp_chemicals",[]), history: lsGet("dp_history",[]), settings: lsGet("dp_settings",{}) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `detailpro_${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast("Данные экспортированы");
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target!.result as string);
        if (data.chemicals) lsSet("dp_chemicals", data.chemicals);
        if (data.history) lsSet("dp_history", data.history);
        if (data.settings) { lsSet("dp_settings", data.settings); setLocal(data.settings); }
        toast("Данные импортированы! Обновите страницу.");
      } catch { toast("Ошибка: файл повреждён", false); }
    };
    reader.readAsText(f);
  };

  const orderList = settings.orderList ?? [];

  return (
    <div className="flex flex-col gap-6">
      <p className="dp-section-title">Настройки</p>

      {/* Car */}
      <div className="dp-card-lg p-6 dp-animate">
        <div className="flex items-center gap-2 mb-5">
          <Icon name="Car" size={20} style={{ color: "var(--dp-navy)" }} />
          <p className="font-bold text-base" style={{ color: "var(--dp-text)" }}>Мой автомобиль</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div><label className="dp-label">Марка</label><input className="dp-input" value={local.carBrand} onChange={(e) => upd("carBrand", e.target.value)} placeholder="Porsche" /></div>
          <div><label className="dp-label">Модель</label><input className="dp-input" value={local.carModel} onChange={(e) => upd("carModel", e.target.value)} placeholder="Cayenne" /></div>
          <div><label className="dp-label">Год</label><input className="dp-input" value={local.carYear} onChange={(e) => upd("carYear", e.target.value)} placeholder="2023" /></div>
        </div>
        <div className="mb-4">
          <label className="dp-label">Город</label>
          <input className="dp-input" value={local.city} onChange={(e) => upd("city", e.target.value)} placeholder="Москва" />
        </div>
        <div>
          <label className="dp-label">Фото авто (фон хедера)</label>
          {local.carPhoto ? (
            <div className="relative">
              <img src={local.carPhoto} className="w-full rounded-2xl object-cover" style={{ height: 110 }} />
              <button onClick={() => upd("carPhoto", null)} className="absolute top-2 right-2 dp-btn-ghost"
                style={{ padding: "4px 10px", background: "rgba(0,0,0,0.45)", color: "#fff", borderColor: "transparent" }}>
                <Icon name="X" size={14} />Удалить
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed cursor-pointer"
              style={{ height: 90, borderColor: "var(--dp-border)", background: "var(--dp-bg)" }}>
              <Icon name="Upload" size={22} style={{ color: "var(--dp-muted)" }} />
              <span className="text-sm" style={{ color: "var(--dp-muted)" }}>Загрузить фото</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleCarPhoto} />
            </label>
          )}
        </div>
        <button className="dp-btn-primary mt-4" onClick={save}>
          <Icon name="Save" size={16} />Сохранить
        </button>
      </div>

      {/* Telegram */}
      <div className="dp-card-lg p-6 dp-animate dp-animate-delay-1">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xl">✈️</span>
          <p className="font-bold text-base" style={{ color: "var(--dp-text)" }}>Telegram-уведомления</p>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label className="dp-label">Bot Token</label>
            <input className="dp-input" value={local.tgToken} onChange={(e) => upd("tgToken", e.target.value)} type="password" placeholder="123456:ABC-DEF..." />
            <p className="text-xs mt-1" style={{ color: "var(--dp-muted)" }}>Получить у @BotFather</p>
          </div>
          <div>
            <label className="dp-label">Chat ID</label>
            <input className="dp-input" value={local.tgChatId} onChange={(e) => upd("tgChatId", e.target.value)} placeholder="-100123456" />
            <p className="text-xs mt-1" style={{ color: "var(--dp-muted)" }}>Узнать через @userinfobot</p>
          </div>
          <button className="dp-btn-primary" style={{
            alignSelf: "flex-start",
            background: tgStatus==="ok" ? "var(--dp-green)" : tgStatus==="err" ? "var(--dp-red)" : undefined
          }}
            onClick={() => { save(); testTg(); }}>
            <Icon name={tgStatus==="ok" ? "CheckCircle2" : tgStatus==="err" ? "XCircle" : "Send"} size={16} />
            {tgStatus==="ok" ? "Работает!" : tgStatus==="err" ? "Ошибка" : "Проверить"}
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="dp-card-lg p-6 dp-animate dp-animate-delay-2">
        <div className="flex items-center gap-2 mb-5">
          <Icon name="Bell" size={20} style={{ color: "var(--dp-navy)" }} />
          <p className="font-bold text-base" style={{ color: "var(--dp-text)" }}>Уведомления</p>
        </div>
        <div className="flex flex-col gap-5">
          {[
            { key: "notifyWash" as const, label: "Напоминание о мойке", desc: "Раз в 2 недели" },
            { key: "notifyLowChem" as const, label: "Химия заканчивается", desc: "Когда остаток < 20%" },
            { key: "notifyMorning" as const, label: "Утренняя рекомендация", desc: "В 10:00 — погода + совет" },
            { key: "notifyWeek" as const, label: "Еженедельный отчёт", desc: "Сводка в воскресенье" },
          ].map((n) => (
            <div key={n.key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--dp-text)" }}>{n.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--dp-muted)" }}>{n.desc}</p>
              </div>
              <label className="dp-switch">
                <input type="checkbox" checked={local[n.key] as boolean} onChange={(e) => upd(n.key, e.target.checked)} />
                <span className="dp-switch-slider" />
              </label>
            </div>
          ))}
        </div>
        <button className="dp-btn-primary mt-5" onClick={save}>
          <Icon name="Save" size={16} />Сохранить
        </button>
      </div>

      {/* Order list */}
      {orderList.length > 0 && (
        <div className="dp-card-lg p-6 dp-animate dp-animate-delay-3">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="ShoppingCart" size={20} style={{ color: "var(--dp-navy)" }} />
            <p className="font-bold text-base" style={{ color: "var(--dp-text)" }}>Список заказа ({orderList.length})</p>
          </div>
          <div className="flex flex-col gap-2">
            {orderList.map((name) => (
              <div key={name} className="flex items-center justify-between gap-3 p-3 rounded-xl"
                style={{ background: "var(--dp-bg)" }}>
                <span className="text-sm font-medium" style={{ color: "var(--dp-text)" }}>{name}</span>
                <button className="dp-btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }}
                  onClick={() => {
                    const u = { ...settings, orderList: settings.orderList.filter((x) => x !== name) };
                    setSettings(u); lsSet("dp_settings", u);
                    setLocal(u);
                  }}>
                  <Icon name="X" size={12} />Убрать
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export / Import */}
      <div className="dp-card-lg p-6 dp-animate dp-animate-delay-3">
        <div className="flex items-center gap-2 mb-5">
          <Icon name="Database" size={20} style={{ color: "var(--dp-navy)" }} />
          <p className="font-bold text-base" style={{ color: "var(--dp-text)" }}>Резервная копия</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button className="dp-btn-primary" onClick={exportData}>
            <Icon name="Download" size={16} />Экспорт данных
          </button>
          <label className="dp-btn-ghost cursor-pointer">
            <Icon name="Upload" size={16} />Импорт данных
            <input type="file" accept=".json" className="hidden" onChange={importData} />
          </label>
        </div>
        <p className="text-xs mt-3" style={{ color: "var(--dp-muted)" }}>
          Скачайте JSON со всеми данными или загрузите ранее сохранённую копию.
        </p>
      </div>

      <div className="dp-card p-5 flex items-center justify-between dp-animate">
        <div>
          <p className="font-semibold text-sm" style={{ color: "var(--dp-text)" }}>DetailPro</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--dp-muted)" }}>Версия 2.0 · Полностью локальный кабинет</p>
        </div>
        <span className="text-2xl">🚗</span>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [chemicals, setChemicals] = useState<Chemical[]>(() => lsGet("dp_chemicals", []));
  const [records, setRecords] = useState<WashRecord[]>(() => lsGet("dp_history", []));
  const [settings, setSettings] = useState<Settings>(() => lsGet("dp_settings", DEFAULT_SETTINGS));
  const [lastDuration, setLastDuration] = useState(0);

  // Геолокация при первом входе
  useEffect(() => {
    if (!settings.geoAsked && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const r = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
            );
            const d = await r.json();
            const city = d.address?.city || d.address?.town || d.address?.village || settings.city;
            setSettings((prev) => { const u = { ...prev, city, geoAsked: true }; lsSet("dp_settings", u); return u; });
          } catch {
            setSettings((prev) => { const u = { ...prev, geoAsked: true }; lsSet("dp_settings", u); return u; });
          }
        },
        () => setSettings((prev) => { const u = { ...prev, geoAsked: true }; lsSet("dp_settings", u); return u; })
      );
    }
  }, []);

  // Утреннее уведомление в 10:00
  useEffect(() => {
    if (!settings.notifyMorning || !settings.tgToken || !settings.tgChatId) return;
    const check = () => {
      const now = new Date();
      const key = now.toISOString().slice(0, 10);
      if (now.getHours() === 10 && settings.lastMorningNotif !== key) {
        const msg = `🌅 <b>Доброе утро!</b>\n\n${settings.city} · +22°C, ясно ☀️\n\n💡 Совет: проверьте уровень химии и подготовьте микрофибру перед мойкой!`;
        tgSend(settings.tgToken, settings.tgChatId, msg).then(() => {
          setSettings((prev) => { const u = { ...prev, lastMorningNotif: key }; lsSet("dp_settings", u); return u; });
        });
      }
    };
    check();
    const timer = setInterval(check, 60_000);
    return () => clearInterval(timer);
  }, [settings.notifyMorning, settings.tgToken, settings.tgChatId]);

  const heroBg = settings.carPhoto
    ? `linear-gradient(to bottom,rgba(10,20,40,0.92) 0%,rgba(10,20,40,0.72) 100%),url('${settings.carPhoto}') center/cover no-repeat`
    : `linear-gradient(to bottom,rgba(20,42,72,0.93) 0%,rgba(20,42,72,0.78) 100%),url('https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1400&q=80&fm=jpg') center 40%/cover no-repeat`;

  const renderPage = () => {
    switch (page) {
      case "home": return <PageHome chemicals={chemicals} settings={settings} lastDuration={lastDuration} onStop={setLastDuration} />;
      case "chemistry": return <PageChemistry chemicals={chemicals} setChemicals={setChemicals} settings={settings} />;
      case "history": return <PageHistory records={records} setRecords={setRecords} chemicals={chemicals} setChemicals={setChemicals} lastDuration={lastDuration} />;
      case "stats": return <PageStats records={records} chemicals={chemicals} />;
      case "algorithm": return <PageAlgorithm />;
      case "recommendations": return <PageRecommendations />;
      case "settings": return <PageSettings settings={settings} setSettings={setSettings} />;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--dp-bg)" }}>
      <ToastContainer />

      <header className="sticky top-0 z-50"
        style={{ background: "rgba(245,245,247,0.88)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid var(--dp-border)" }}>
        <div style={{ background: heroBg, padding: "16px 24px 14px" }}>
          <div style={{ maxWidth: 960, margin: "0 auto" }} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl flex items-center justify-center" style={{ width: 34, height: 34, background: "rgba(255,255,255,0.15)" }}>
                <span style={{ fontSize: 18 }}>🚗</span>
              </div>
              <span className="font-black text-lg tracking-tight" style={{ color: "#fff" }}>DetailPro</span>
              {(settings.carBrand || settings.carModel) && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)" }}>
                  {settings.carBrand} {settings.carModel}
                </span>
              )}
            </div>
            <span className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.9)" }}>
              {new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
            </span>
          </div>
        </div>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <nav className="flex gap-1 px-4 py-2" style={{ maxWidth: 960, margin: "0 auto", minWidth: "max-content" }}>
            {NAV_ITEMS.map((item) => (
              <button key={item.id} className={`dp-nav-item ${page===item.id?"active":""}`} onClick={() => setPage(item.id)}>
                <Icon name={item.icon} size={18} fallback="Circle" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "28px 16px 120px" }}>
        <div key={page} className="dp-animate">{renderPage()}</div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 sm:hidden z-50"
        style={{ background: "rgba(245,245,247,0.96)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid var(--dp-border)", padding: "8px 4px", paddingBottom: "calc(8px + env(safe-area-inset-bottom))" }}>
        <nav className="flex justify-around">
          {NAV_ITEMS.slice(0, 5).map((item) => (
            <button key={item.id} className={`dp-nav-item ${page===item.id?"active":""}`} onClick={() => setPage(item.id)}
              style={{ minWidth: 0, flex: 1, padding: "6px 2px" }}>
              <Icon name={item.icon} size={20} fallback="Circle" />
              <span style={{ fontSize: 10 }}>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
