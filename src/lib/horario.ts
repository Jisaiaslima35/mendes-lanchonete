import type { BusinessHour } from "@/types/database";

const TIMEZONE = "America/Sao_Paulo";
const WEEKDAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

/** Dia da semana (0=domingo) e minutos desde 00:00, no fuso America/Sao_Paulo. */
function saoPauloParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const weekdayShort = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return { weekday: weekdayMap[weekdayShort] ?? 0, minutes: hour * 60 + minute };
}

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Verifica se um horario (weekday + minutos) cai dentro de um intervalo que
 * pode cruzar a meia-noite (ex.: 18:00-02:00).
 */
function isWithinRange(
  targetWeekday: number,
  targetMinutes: number,
  rangeWeekday: number,
  opensAt: number,
  closesAt: number,
) {
  const overnight = closesAt <= opensAt;

  if (!overnight) {
    return targetWeekday === rangeWeekday && targetMinutes >= opensAt && targetMinutes < closesAt;
  }

  // Mesmo dia do inicio, depois da abertura.
  if (targetWeekday === rangeWeekday && targetMinutes >= opensAt) return true;
  // Dia seguinte, antes do fechamento.
  const nextWeekday = (rangeWeekday + 1) % 7;
  if (targetWeekday === nextWeekday && targetMinutes < closesAt) return true;
  return false;
}

export function isStoreOpen(
  hours: BusinessHour[],
  manualClosed: boolean,
  now: Date = new Date(),
): boolean {
  if (manualClosed) return false;

  const { weekday, minutes } = saoPauloParts(now);

  return hours.some((h) => {
    if (h.is_closed) return false;
    return isWithinRange(
      weekday,
      minutes,
      h.weekday,
      timeToMinutes(h.opens_at),
      timeToMinutes(h.closes_at),
    );
  });
}

/** Retorna um texto amigavel do proximo horario de abertura, ou null se nao houver nenhum cadastrado. */
export function nextOpeningLabel(
  hours: BusinessHour[],
  now: Date = new Date(),
): string | null {
  const active = hours.filter((h) => !h.is_closed);
  if (active.length === 0) return null;

  const { weekday, minutes } = saoPauloParts(now);

  for (let offset = 0; offset < 8; offset++) {
    const checkWeekday = (weekday + offset) % 7;
    const candidates = active
      .filter((h) => h.weekday === checkWeekday)
      .map((h) => timeToMinutes(h.opens_at))
      .filter((opens) => (offset === 0 ? opens > minutes : true))
      .sort((a, b) => a - b);

    if (candidates.length > 0) {
      const opens = candidates[0];
      const hh = String(Math.floor(opens / 60)).padStart(2, "0");
      const mm = String(opens % 60).padStart(2, "0");
      const day = offset === 0 ? "hoje" : offset === 1 ? "amanhã" : WEEKDAY_NAMES[checkWeekday];
      return `Abre ${day} às ${hh}:${mm}`;
    }
  }
  return null;
}

/** Horarios do dia atual, formatados para exibicao (ex.: "18:00 - 23:00"). */
export function todayHoursLabel(hours: BusinessHour[], now: Date = new Date()): string {
  const { weekday } = saoPauloParts(now);
  const today = hours.filter((h) => h.weekday === weekday);

  if (today.length === 0 || today.every((h) => h.is_closed)) {
    return "Fechado hoje";
  }

  return today
    .filter((h) => !h.is_closed)
    .map((h) => `${h.opens_at.slice(0, 5)} - ${h.closes_at.slice(0, 5)}`)
    .join(" e ");
}

export { WEEKDAY_NAMES };
