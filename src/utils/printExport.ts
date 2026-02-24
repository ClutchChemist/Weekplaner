import type { Lang } from "../i18n/types";
import type {
  CalendarEvent as Session,
  Coach,
  GroupId,
  Player,
  ThemeLocations,
} from "../state/types";
import { getPlayerGroup } from "../state/playerGrouping";
import { normalizeYearColor, pickTextColor } from "./color";

export interface PrintPage {
  type: "overview" | "rosters" | "game";
  html: string;
  title: string;
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function dateToDDMon(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, "0");
  const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  return `${day}-${monthNames[d.getMonth()] ?? ""}`;
}

function isGameSession(s: Session): boolean {
  const info = s.info || "";
  return info.includes("vs") || info.includes("@");
}

function requiredTaTypeForTeams(teams: string[]): "NBBL" | "JBBL" | "DBB" | null {
  const normalized = (teams ?? []).map((t) => String(t ?? "").trim().toUpperCase());
  if (normalized.includes("NBBL")) return "NBBL";
  if (normalized.includes("JBBL")) return "JBBL";
  if (normalized.some((t) => t === "U18" || t === "HOL" || t === "1RLH")) return "DBB";
  return null;
}

function tnaByType(player: Player, typ: string): string {
  const wanted = String(typ ?? "").trim().toUpperCase();
  return (
    (player.lizenzen ?? []).find((x) => String(x.typ ?? "").trim().toUpperCase() === wanted)?.tna ?? ""
  ).trim();
}

function resolveLegendAddress(name: string, locations: ThemeLocations): string {
  const newLocs = locations?.locations || {};
  const customLocs = locations?.custom || {};
  if (newLocs?.[name]?.address) return newLocs[name].address;
  if (name === "BSH") return locations?.bsh || "";
  if (name === "SHP") return locations?.shp || "";
  if (name === "Seminarraum") return locations?.seminarraum || "";
  return customLocs?.[name] || "";
}

function buildLocationsLegendHtml(sessions: Session[], locations: ThemeLocations): string {
  const defs = locations?.definitions || {};
  const usedNames = Array.from(
    new Set(
      sessions
        .map((s) => (s.location || "").trim())
        .filter((loc) => Boolean(loc && loc !== "TBD"))
    )
  ).sort((a, b) => a.localeCompare(b, "de"));

  if (usedNames.length === 0) return "";

  const rows = usedNames
    .map((name) => {
      const def = defs[name] ?? { abbr: name, name, hallNo: "" };
      const abbr = (def.abbr || name).trim();
      const fullName = (def.name || name).trim();
      const address = resolveLegendAddress(name, locations).trim();
      const addrShort = address
        ? address.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 2).join(", ")
        : "";
      return `
        <tr>
          <td style="width:56px; padding:1px 6px 2px 0; text-align:right; vertical-align:top; white-space:nowrap; font-weight:900;">
            ${escapeHtml(abbr)}
          </td>
          <td style="padding:1px 0 2px 0; text-align:left; vertical-align:top; word-break:break-word;">
            ${escapeHtml(fullName)}${addrShort ? ` | ${escapeHtml(addrShort)}` : ""}
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <table style="border-collapse:collapse; width:100%; max-width:360px; font-size:9px; line-height:1.45; color:#374151; table-layout:fixed;">
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function pageHeaderHtml(opts: { title: string; clubName: string; logoUrl?: string; locationsLegendHtml?: string; kwText?: string }): string {
  const { title, clubName, logoUrl, locationsLegendHtml, kwText } = opts;
  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" style="height: 48px; object-fit: contain;" />`
    : `<div style="width: 48px; height: 48px; background: #eee;"></div>`;

  return `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 12px;">
      <!-- LINKS: LOGO -->
      <div style="flex: 1; display: flex; align-items: center;">
        ${logoHtml}
      </div>

      <!-- MITTE: TITEL & KW -->
      <div style="flex: 1; text-align: center; display: flex; flex-direction: column; justify-content: center;">
        <div style="font-size: 18px; font-weight: 900;">${escapeHtml(title)}</div>
        <div style="font-size: 14px; font-weight: 800;">- ${escapeHtml(kwText || "")} -</div>
      </div>

      <!-- RECHTS: VEREIN & ORTE -->
      <div style="flex: 1; text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
        <div style="font-size: 14px; font-weight: 900; margin-bottom: 2px;">${escapeHtml(clubName)}</div>
        ${locationsLegendHtml ? `<div style="margin-top:2px;">${locationsLegendHtml}</div>` : ""}
      </div>
    </div>
  `;
}

function pageFooterHtml(opts: { clubName: string; locale: Lang }): string {
  const { clubName, locale } = opts;
  const trainingLabel = locale === "de" ? "Basketballtraining" : "Basketball Training";
  const planLabel = locale === "de" ? "Wochenplanung" : "Weekly Plan";
  return `
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
      ${escapeHtml(clubName)} · ${trainingLabel} · ${planLabel}
    </div>
  `;
}

function thCss(): string {
  return "border: 1px solid #ccc; padding: 8px; background: #f5f5f5; text-align: left; font-weight: bold;";
}

function tdCss(): string {
  return "border: 1px solid #ccc; padding: 8px;";
}

// ── Kader-Listen Spalten-Layout Helpers ──────────────────────────────────────

/** Gibt "Vorname N." zurück (oder nur Vorname wenn kein Nachname erkennbar) */
function formatPlayerShortName(player: Player): string {
  const first = player.firstName?.trim();
  const last = player.lastName?.trim();
  if (first && last) return `${first} ${last.charAt(0)}`;
  // fallback: name-Feld splitten
  const parts = (player.name ?? "").trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}`;
  }
  return player.name ?? "";
}

/** Gibt abgekürzten Event-Header zurück: z.B. "Mi-NBBL", "Do-U18" */
function abbrevEventHeader(s: Session): string {
  const day = (s.day ?? "").slice(0, 2); // "Mi", "Do", "Fr" etc.
  const teams = (s.teams ?? []).join("/");
  return `${day}-${teams}`;
}

const GROUP_ORDER: GroupId[] = ["2007", "2008", "2009", "Herren", "TBD"];

function groupSortKey(group: GroupId | undefined): number {
  if (!group) return GROUP_ORDER.length;
  const idx = GROUP_ORDER.indexOf(group);
  return idx === -1 ? GROUP_ORDER.length : idx;
}

function sortPlayersByGroup(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const ka = groupSortKey(getPlayerGroup(a));
    const kb = groupSortKey(getPlayerGroup(b));
    if (ka !== kb) return ka - kb;
    return (a.name ?? "").localeCompare(b.name ?? "", "de");
  });
}

/** Rendert die Kader-Listen als Spalten-Layout (eine Spalte pro Event) */
function renderKaderColumnLayoutHtml(opts: {
  sessions: Session[];
  players: Player[];
  groupColors: Record<string, string>;
  compactLevel?: 0 | 1 | 2;
}): string {
  const { sessions, players, groupColors, compactLevel = 0 } = opts;

  if (sessions.length === 0) return "";
  const headerFont = compactLevel >= 2 ? 9 : compactLevel === 1 ? 10 : 11;
  const cellFont = compactLevel >= 2 ? 9 : compactLevel === 1 ? 10 : 11;
  const idxFont = compactLevel >= 2 ? 7 : compactLevel === 1 ? 8 : 9;
  const padY = compactLevel >= 2 ? 1 : compactLevel === 1 ? 2 : 3;
  const padX = compactLevel >= 2 ? 4 : compactLevel === 1 ? 5 : 7;
  const rowGap = compactLevel >= 2 ? 10 : compactLevel === 1 ? 11 : 12;
  const idxMinWidth = compactLevel >= 2 ? 10 : compactLevel === 1 ? 11 : 12;
  const idxMargin = compactLevel >= 2 ? 3 : 4;

  const playerById = new Map(players.map((p) => [p.id, p] as const));

  // Für jede Session: sortierte Spielerliste aufbauen
  const columns = sessions.map((s) => {
    const assigned = (s.participants ?? [])
      .map((pid) => playerById.get(pid))
      .filter((p): p is Player => Boolean(p));
    return {
      session: s,
      players: sortPlayersByGroup(assigned),
    };
  });

  const maxRows = Math.max(0, ...columns.map((c) => c.players.length));

  // Header-Zeile
  const headerCells = columns
    .map((c) => {
      const label = abbrevEventHeader(c.session);
      return `<th style="border:1px solid #bbb; padding:${padY + 2}px ${padX}px; background:#f0f0f0; font-size:${headerFont}px; font-weight:900; white-space:nowrap; text-align:left;">${escapeHtml(label)}</th>`;
    })
    .join("");

  // Daten-Zeilen
  const rows: string[] = [];
  for (let i = 0; i < maxRows; i++) {
    const cells = columns
      .map((c) => {
        const p = c.players[i];
        if (!p) return `<td style="border:1px solid #ddd; padding:${padY}px ${padX}px; height:${rowGap}px;"></td>`;
        const group = getPlayerGroup(p);
        const bg = normalizeYearColor(p.yearColor) ?? groupColors[group] ?? "#eee";
        const fg = pickTextColor(bg);
        const name = formatPlayerShortName(p);
        const nrColor = fg === "#fff" ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.62)";
        return `<td style="border:1px solid #ddd; padding:${padY}px ${padX}px; background:${escapeHtml(bg)}; color:${escapeHtml(fg)}; font-size:${cellFont}px; white-space:nowrap; line-height:1.1; height:${rowGap}px; -webkit-print-color-adjust:exact; print-color-adjust:exact; forced-color-adjust:none;"><span style="display:inline-block; min-width:${idxMinWidth}px; margin-right:${idxMargin}px; font-size:${idxFont}px; font-weight:800; color:${nrColor}; text-align:right;">${i + 1}</span>${escapeHtml(name)}</td>`;
      })
      .join("");
    rows.push(`<tr>${cells}</tr>`);
  }

  return `
    <table style="border-collapse:collapse; font-size:11px; width:100%;">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table>
  `;
}

export function renderWeekOverviewHtml(opts: {
  sessions: Session[];
  players: Player[];
  coaches: Coach[];
  clubName: string;
  locale: Lang;
  locations: ThemeLocations;
  logoUrl?: string;
  kwText?: string;
}): string {
  const { sessions, players, coaches, clubName, locale, locations, logoUrl } = opts;

  const trainingSessions = sessions.filter((s) => !isGameSession(s));
  const games = sessions.filter((s) => isGameSession(s));

  const t = locale === "de"
    ? { training: "Training", trainingShort: "Tr", game: "Spiel", gameShort: "Sp", roster: "Kader", legend: "Legende", date: "Datum", day: "Tag", teams: "Teams", time: "Zeit" }
    : { training: "Training", trainingShort: "Tr", game: "Game", gameShort: "Gm", roster: "Roster", legend: "Legend", date: "Date", day: "Day", teams: "Teams", time: "Time" };

  const locationsLegendHtml = buildLocationsLegendHtml(sessions, locations);

  const buildRosterTable = (session: Session): string => {
    const sessionPlayers = players.filter((p) =>
      session.teams.some((team) => p.primaryYouthTeam === team || p.primarySeniorTeam === team || p.defaultTeams?.includes(team))
    );
    const sessionCoaches = coaches.filter((c) =>
      session.teams.some((team) => c.name.includes(team))
    );

    if (sessionPlayers.length === 0 && sessionCoaches.length === 0) {
      return `<p style="font-size: 13px; color: #666;">Kein Kader</p>`;
    }

    let rosterRows = "";
    if (sessionCoaches.length > 0) {
      sessionCoaches.forEach((c) => {
        rosterRows += `
          <tr>
            <td style="${tdCss()}">${escapeHtml(c.name)}</td>
            <td style="${tdCss()}">${escapeHtml(c.role)}</td>
          </tr>
        `;
      });
    }
    if (sessionPlayers.length > 0) {
      sessionPlayers.forEach((p) => {
        const teamLabel = p.primaryYouthTeam || p.primarySeniorTeam || p.defaultTeams?.join(", ") || "";
        rosterRows += `
          <tr>
            <td style="${tdCss()}">${escapeHtml(p.name)}</td>
            <td style="${tdCss()}">${escapeHtml(teamLabel)}</td>
          </tr>
        `;
      });
    }

    return `
      <table style="width: 100%; margin-top: 8px;">
        <thead>
          <tr>
            <th style="${thCss()}">Name</th>
            <th style="${thCss()}">Team/Rolle</th>
          </tr>
        </thead>
        <tbody>
          ${rosterRows}
        </tbody>
      </table>
    `;
  };

  let sessionsTableRows = "";
  [...trainingSessions, ...games].forEach((s, i, arr) => {
    const prev = arr[i - 1];
    const sameDayAsPrev = prev ? prev.date === s.date : false;
    // const typeLabel = isGameSession(s) ? t.gameShort : t.trainingShort;

    const topBorder = !sameDayAsPrev ? "border-top: 2px solid #aaa;" : "border-top: 1px solid #ddd;";

    sessionsTableRows += `
      <tr>
        <td style="${tdCss()} ${topBorder}">${sameDayAsPrev ? "" : escapeHtml(s.date)}</td>
        <td style="${tdCss()} ${topBorder}">${sameDayAsPrev ? "" : escapeHtml(s.day)}</td>
        <td style="${tdCss()} ${topBorder}">${escapeHtml(s.teams.join(", "))}</td>
        <td style="${tdCss()} ${topBorder}">${escapeHtml(s.time)}</td>
        <td style="${tdCss()} ${topBorder}">${escapeHtml(s.location)}</td>
        <td style="${tdCss()} ${topBorder} width: auto;">${escapeHtml(s.info || "")}</td>
      </tr>
      <tr>
        <td colspan="6" style="padding: 12px; border: 1px solid #ccc; background: #fcfcfc;">
          <strong>${t.roster}:</strong>
          ${buildRosterTable(s)}
        </td>
      </tr>
    `;
  });

  return `
    <div class="page">
      ${pageHeaderHtml({ title: "Trainingsübersicht", clubName, logoUrl, locationsLegendHtml, kwText: opts.kwText })}
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="${thCss()}">${t.date}</th>
            <th style="${thCss()}">${t.day}</th>
            <th style="${thCss()}">${t.teams}</th>
            <th style="${thCss()}">${t.time}</th>
            <th style="${thCss()}">Ort/Halle</th>
            <th style="${thCss()} width: auto;">Info</th>
          </tr>
        </thead>
        <tbody>
          ${sessionsTableRows}
        </tbody>
      </table>
      ${pageFooterHtml({ clubName, locale })}
    </div>
  `;
}

function renderWeekScheduleOnlyHtml(opts: {
  sessions: Session[];
  clubName: string;
  locale: Lang;
  locations: ThemeLocations;
  logoUrl?: string;
  kwText?: string;
  compactLevel?: 0 | 1 | 2;
}): string {
  const { sessions, clubName, locale, locations, logoUrl, kwText, compactLevel = 0 } = opts;

  const t = locale === "de"
    ? {
      title: "Trainingswoche", date: "Datum", day: "Tag", teams: "Teams", time: "Zeit", loc: "Ort", info: "Info"
    }
    : {
      title: "Training week", date: "Date", day: "Day", teams: "Teams", time: "Time", loc: "Location", info: "Info"
    };

  const locationsLegendHtml = buildLocationsLegendHtml(sessions, locations);

  const scheduleFont = compactLevel >= 2 ? 8 : compactLevel === 1 ? 8.5 : 9;
  const schedulePadY = compactLevel >= 2 ? 2 : 3;
  const schedulePadX = compactLevel >= 2 ? 4 : 5;
  const rows = sessions
    .map((s, i, arr) => {
      const isGame = isGameSession(s);
      const prev = arr[i - 1];
      const sameDayAsPrev = prev ? prev.date === s.date : false;
      const topBorder = !sameDayAsPrev ? "border-top: 2px solid #aaa;" : "border-top: 1px solid #ddd;";
      const baseCell = `border: 1px solid #ccc; padding: ${schedulePadY}px ${schedulePadX}px; font-size: ${scheduleFont}px; overflow: hidden; text-overflow: ellipsis; line-height:1.15;`;
      const cellBg = s.rowColor ? `background: ${escapeHtml(s.rowColor)};` : (isGame ? "background: #F59E0B;" : "");
      const dateTdCss = `${baseCell} white-space: nowrap; ${topBorder}`;
      const dataCellCss = `${baseCell} white-space: nowrap; ${cellBg} color: #111; ${topBorder}`;
      const infoCellCss = `${baseCell} white-space: normal; word-break: break-word; text-align: left; ${cellBg} color: #111; ${topBorder}`;

      return `
        <tr>
          <td style="${dateTdCss}">${sameDayAsPrev ? "" : dateToDDMon(s.date)}</td>
          <td style="${dateTdCss}">${sameDayAsPrev ? "" : escapeHtml(s.day)}</td>
          <td style="${dataCellCss}">${escapeHtml(s.teams.join(", "))}</td>
          <td style="${dataCellCss}">${escapeHtml(s.time)}</td>
          <td style="${dataCellCss}">${escapeHtml(s.location)}</td>
          <td style="${infoCellCss}">${escapeHtml(s.info || "")}</td>
        </tr>
      `;
    })
    .join("");

  const thBase = `border: 1px solid #ccc; padding: ${schedulePadY + 1}px ${schedulePadX}px; background: #f5f5f5; font-size: ${scheduleFont}px; font-weight: bold; white-space: nowrap; overflow: hidden;`;

  return `
    <div class="page">
      ${pageHeaderHtml({ title: t.title, clubName, logoUrl, locationsLegendHtml, kwText })}
      <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
        <colgroup>
          <col style="width: 10%;" />
          <col style="width: 10%;" />
          <col style="width: 10%;" />
          <col style="width: 10%;" />
          <col style="width: 10%;" />
          <col style="width: 50%;" />
        </colgroup>
        <thead>
          <tr>
            <th style="${thBase}">${t.date}</th>
            <th style="${thBase}">${t.day}</th>
            <th style="${thBase}">${t.teams}</th>
            <th style="${thBase}">${t.time}</th>
            <th style="${thBase}">${t.loc}</th>
            <th style="${thBase} text-align: left; white-space: normal;">${t.info}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${pageFooterHtml({ clubName, locale })}
    </div>
  `;
}

export function renderRostersOnlyHtml(opts: {
  sessions: Session[];
  players: Player[];
  clubName: string;
  locale: Lang;
  logoUrl?: string;
}): string {
  const { sessions, players, clubName, locale, logoUrl } = opts;

  const t = locale === "de"
    ? { title: "Kader pro Event", roster: "Kader", none: "Keine Teilnehmer zugewiesen." }
    : { title: "Rosters per event", roster: "Roster", none: "No participants assigned." };

  const blocks = sessions
    .map((s) => {
      const label = `${s.day} · ${s.date} · ${s.time} · ${s.location} · ${s.teams.join(", ")} ${s.info ? `· ${s.info}` : ""}`;
      const assigned = players.filter((p) => s.participants?.includes(p.id));
      if (assigned.length === 0) return `<div style="color:#999; font-size:12px;">${t.none}</div>`;

      const sorted = assigned
        .slice()
        .sort((a, b) => (a.name || "").localeCompare((b.name || ""), locale));

      const rows = sorted
        .map((p, idx) => `
          <tr>
            <td style="${tdCss()} width:28px; text-align:center; font-size:10px; color:#555;">${idx + 1}</td>
            <td style="${tdCss()}">${escapeHtml(p.name)}</td>
          </tr>
        `)
        .join("");

      const rosterTable = `
        <table style="margin-top:8px;">
          <thead>
            <tr>
              <th style="${thCss()} width:28px; text-align:center; font-size:10px;">#</th>
              <th style="${thCss()}">${locale === "de" ? "Name" : "Name"}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;

      return `
        <div style="border:1px solid #ddd; border-radius:10px; padding:10px 12px; margin-bottom:12px;">
          <div style="font-weight:900; font-size:12px;">${escapeHtml(label)}</div>
          <div style="margin-top:6px;"><strong>${t.roster}:</strong></div>
          ${rosterTable}
        </div>
      `;
    })
    .join("");

  return `
    <div class="page">
      ${pageHeaderHtml({ title: t.title, clubName, logoUrl })}
      ${blocks}
      ${pageFooterHtml({ clubName, locale })}
    </div>
  `;
}

function renderWeekSummaryAndRostersFirstPageHtml(opts: {
  sessions: Session[];
  players: Player[];
  clubName: string;
  locale: Lang;
  locations: ThemeLocations;
  logoUrl?: string;
  groupColors?: Record<string, string>;
  kwText?: string;
}): string {
  const { sessions, players, clubName, locale, locations, logoUrl, groupColors = {}, kwText } = opts;
  const scheduleSessions = sessions;

  const rosterSessions = scheduleSessions.filter((s) => !s.excludeFromRoster);
  const isGameOrWeekend = (s: Session) => isGameSession(s) || /^(sa|so)/i.test(s.day || "");
  const trainingRoster = rosterSessions.filter(s => !isGameOrWeekend(s));
  const gameRoster = rosterSessions.filter(s => isGameOrWeekend(s));

  const trainingMaxRows = Math.max(0, ...trainingRoster.map((s) => (s.participants ?? []).length));
  const gameMaxRows = Math.max(0, ...gameRoster.map((s) => (s.participants ?? []).length));
  const totalCols = trainingRoster.length + gameRoster.length;
  const pressure = Math.max(trainingMaxRows, gameMaxRows) + Math.ceil(totalCols / 2);
  const compactLevel: 0 | 1 | 2 = pressure > 24 ? 2 : pressure > 17 ? 1 : 0;

  const scheduleHtml = renderWeekScheduleOnlyHtml({
    sessions: scheduleSessions,
    clubName,
    locale,
    locations,
    logoUrl,
    kwText,
    compactLevel,
  });
  const scheduleInner = scheduleHtml
    .replace(/^\s*<div class="page">/, "")
    .replace(/<\/div>\s*$/, "")
    .replace(new RegExp(pageFooterHtml({ clubName, locale }).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "");

  const t = locale === "de"
    ? { rosterTitle: "Kader-Listen", trainingMoFr: "Training (Mo-Fr)", gamesWeekends: "Spiele / Weekend" }
    : { rosterTitle: "Roster lists", trainingMoFr: "Practice (Mon-Fri)", gamesWeekends: "Games / Weekend" };

  const kaderColumnsTraining = renderKaderColumnLayoutHtml({ sessions: trainingRoster, players, groupColors, compactLevel });
  const kaderColumnsGames = renderKaderColumnLayoutHtml({ sessions: gameRoster, players, groupColors, compactLevel });
  const titleSize = compactLevel >= 2 ? 11 : compactLevel === 1 ? 12 : 13;
  const blockGap = compactLevel >= 2 ? 8 : 14;
  const splitGap = compactLevel >= 2 ? 8 : 14;

  const rosterSection = `
    <div style="margin-top:${blockGap}px; break-inside:avoid; page-break-inside:avoid;">
      <div style="font-weight:900; font-size:${titleSize}px; margin-bottom:${compactLevel >= 2 ? 4 : 8}px;">${escapeHtml(t.rosterTitle)} &middot; ${escapeHtml(t.trainingMoFr)}:</div>
      ${kaderColumnsTraining || '<div style="font-size:11px; color:#666;">Keine Termine</div>'}
    </div>
    ${gameRoster.length > 0 ? `
    <div style="margin-top:${splitGap}px; padding-top:${splitGap}px; border-top: 2px dashed #eee; break-inside:avoid; page-break-inside:avoid;">
      <div style="font-weight:900; font-size:${titleSize}px; margin-bottom:${compactLevel >= 2 ? 4 : 8}px;">${escapeHtml(t.rosterTitle)} &middot; ${escapeHtml(t.gamesWeekends)}:</div>
      ${kaderColumnsGames}
    </div>
    ` : ""}
  `;

  return `
    <div class="page">
      ${scheduleInner}
      ${rosterSection}
      ${pageFooterHtml({ clubName, locale })}
    </div>
  `;
}

function renderGameSheetHtml(opts: {
  session: Session;
  players: Player[];
  coaches: Coach[];
  clubName: string;
  locale: Lang;
  logoUrl?: string;
}): string {
  const { session: game, players, coaches, clubName, locale, logoUrl } = opts;
  const teamStr = game.teams.join(" · ");
  const opponent = (game.info || "").replace("vs", "vs.").replace("@", "@");

  const assignedPlayers = players.filter((p) => game.participants?.includes(p.id));

  const firstTeam = game.teams[0] || "";
  const sorted = assignedPlayers
    .map((p) => ({
      player: p,
      jersey: p.jerseyByTeam?.[firstTeam] ?? 999,
    }))
    .sort((a, b) => a.jersey - b.jersey)
    .map((x) => x.player);

  const lines: (Player | null)[] = [];
  for (let i = 0; i < 15; i++) {
    lines.push(sorted[i] || null);
  }

  const rosterRows = lines
    .map((p, idx) => {
      const full = p?.name ?? "";
      const parts = full.trim().split(/\s+/);
      const vorname = parts.length > 1 ? parts[0] : "";
      const nachname = parts.length > 1 ? parts.slice(1).join(" ") : full;

      const requiredTa = requiredTaTypeForTeams(game.teams ?? []);
      const ta = p ? (requiredTa ? tnaByType(p, requiredTa) : (tnaByType(p, "DBB") || tnaByType(p, "NBBL") || tnaByType(p, "JBBL"))) : "";
      const jerseyVal = p?.jerseyByTeam?.[firstTeam] ?? "";

      return `
        <tr>
          <td style="${tdCss()} text-align:center; font-size:10px; color:#555; width:22px;">${idx + 1}</td>
          <td style="${tdCss()} text-align:center; width:44px;">${escapeHtml(String(jerseyVal))}</td>
          <td style="${tdCss()}">${escapeHtml(nachname)}</td>
          <td style="${tdCss()}">${escapeHtml(vorname)}</td>
          <td style="${tdCss()} width:120px;">${escapeHtml(ta)}</td>
          <td style="${tdCss()} text-align:center; width:54px;"></td>
          <td style="${tdCss()} width:170px;"></td>
        </tr>`;
    })
    .join("");

  const assignedCoaches = coaches
    .slice()
    .sort((a, b) => `${a.role} ${a.name}`.localeCompare(`${b.role} ${b.name}`, locale));
  let coachRows = "";
  for (const c of assignedCoaches) {
    coachRows += `
      <tr>
        <td style="${tdCss()}">${escapeHtml(c.name)}</td>
        <td style="${tdCss()}">${escapeHtml(c.license || "")}</td>
      </tr>
    `;
  }

  return `
    <div class="page">
      ${pageHeaderHtml({ title: `Spielbogen: ${teamStr}`, clubName, logoUrl })}
      
      <div style="margin-bottom: 16px;">
        <strong>Spiel:</strong> ${escapeHtml(game.date)} · ${escapeHtml(game.day)} · ${escapeHtml(game.time)}<br/>
        <strong>Ort:</strong> ${escapeHtml(game.location)}<br/>
        <strong>Gegner:</strong> ${escapeHtml(opponent)}
      </div>

      <h3 style="margin-top: 24px; margin-bottom: 8px;">Spieler (15 Plätze)</h3>
      <table>
        <thead>
          <tr>
            <th style="${thCss()} width:22px; text-align:center; font-size:10px;">#</th>
            <th style="${thCss()} width:44px; text-align:center;">Trikot</th>
            <th style="${thCss()}">Nachname</th>
            <th style="${thCss()}">Vorname</th>
            <th style="${thCss()} width:120px;">TA-Nr.</th>
            <th style="${thCss()} width:54px; text-align:center;">Aktiv</th>
            <th style="${thCss()} width:170px;">Notizen</th>
          </tr>
        </thead>
        <tbody>
          ${rosterRows}
        </tbody>
      </table>

      <div style="font-size:11px; color:#555; margin-top:8px;">
        Hinweis: Bitte maximal <b>12</b> Spieler als <b>Aktiv</b> markieren. Insgesamt sind <b>15</b> Zeilen für kurzfristige Änderungen vorgesehen.
      </div>

      <h3 style="margin-top: 24px; margin-bottom: 8px;">Trainer</h3>
      <table>
        <thead>
          <tr>
            <th style="${thCss()}">Name</th>
            <th style="${thCss()}">Lizenz</th>
          </tr>
        </thead>
        <tbody>
          ${coachRows || `<tr><td style="${tdCss()}" colspan="2">Keine Trainer zugewiesen</td></tr>`}
        </tbody>
      </table>

      ${pageFooterHtml({ clubName, locale })}
    </div>
  `;
}

export function buildPrintPages(opts: {
  sessions: Session[];
  players: Player[];
  coaches: Coach[];
  clubName: string;
  locale: Lang;
  locations: ThemeLocations;
  logoUrl?: string;
  groupColors?: Record<string, string>;
  kwText?: string;
}): PrintPage[] {
  const { sessions, players, coaches, clubName, locale, locations, logoUrl, groupColors, kwText } = opts;
  const pages: PrintPage[] = [];

  const firstPageHtml = renderWeekSummaryAndRostersFirstPageHtml({
    sessions,
    players,
    clubName,
    locale,
    locations,
    logoUrl,
    groupColors,
    kwText,
  });
  pages.push({
    type: "overview",
    html: firstPageHtml,
    title: locale === "de" ? "Trainingswoche + Kaderlisten" : "Training week + roster lists",
  });

  const games = sessions.filter((s) => isGameSession(s));
  for (const g of games) {
    const html = renderGameSheetHtml({ session: g, players, coaches, clubName, locale, logoUrl });
    const title = `Spielbogen: ${g.teams.join(" · ")} – ${g.info || ""}`;
    pages.push({ type: "game", html, title });
  }

  return pages;
}

export function buildPreviewPages(opts: {
  sessions: Session[];
  players: Player[];
  coaches: Coach[];
  clubName: string;
  locale: Lang;
  locations: ThemeLocations;
  logoUrl?: string;
  groupColors?: Record<string, string>;
  kwText?: string;
}): PrintPage[] {
  const { sessions, players, coaches, clubName, locale, locations, logoUrl, groupColors, kwText } = opts;

  const pages: PrintPage[] = [];

  pages.push({
    type: "overview",
    html: renderWeekSummaryAndRostersFirstPageHtml({ sessions, players, clubName, locale, locations, logoUrl, groupColors, kwText }),
    title: locale === "de" ? "Trainingswoche + Kaderlisten" : "Training week + roster lists",
  });

  const games = sessions.filter((s) => isGameSession(s));
  for (const g of games) {
    const html = renderGameSheetHtml({ session: g, players, coaches, clubName, locale, logoUrl });
    const title = `${locale === "de" ? "Spielbogen" : "Game sheet"}: ${g.teams.join(" · ")} – ${g.info || ""}`;
    pages.push({ type: "game", html, title });
  }

  return pages;
}
