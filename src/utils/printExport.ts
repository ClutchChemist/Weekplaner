import type { Lang } from "../i18n/types";
import type {
  CalendarEvent as Session,
  Coach,
  Player,
  ThemeLocations,
} from "../state/types";

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

function isGameSession(s: Session): boolean {
  const info = s.info || "";
  return info.includes("vs") || info.includes("@");
}

function pageHeaderHtml(opts: { title: string; clubName: string; logoUrl?: string }): string {
  const { title, clubName, logoUrl } = opts;
  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" style="width: 80px; height: 80px; object-fit: contain;" />`
    : `<div style="width: 80px; height: 80px; border: 2px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #555;">Logo</div>`;
  return `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
      <div style="flex: 1;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold;">${escapeHtml(title)}</h1>
        <div style="font-size: 14px; color: #333; margin-top: 4px;">${escapeHtml(clubName)}</div>
      </div>
      ${logoHtml}
    </div>
  `;
}

function pageFooterHtml(opts: { clubName: string; locale: Lang }): string {
  const { clubName, locale } = opts;
  const trainingLabel = locale === "de" ? "Basketballtraining" : "Basketball Training";
  const planLabel = locale === "de" ? "Wochenplanung" : "Weekly Plan";
  return `
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #bbb; font-size: 12px; color: #333;">
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

export function renderWeekOverviewHtml(opts: {
  sessions: Session[];
  players: Player[];
  coaches: Coach[];
  clubName: string;
  locale: Lang;
  locations: ThemeLocations;
  logoUrl?: string;
}): string {
  const { sessions, players, coaches, clubName, locale, locations, logoUrl } = opts;

  const trainingSessions = sessions.filter((s) => !isGameSession(s));
  const games = sessions.filter((s) => isGameSession(s));

  const t = locale === "de"
    ? { training: "Training", trainingShort: "Tr", game: "Spiel", gameShort: "Sp", roster: "Kader", legend: "Legende" }
    : { training: "Training", trainingShort: "Tr", game: "Game", gameShort: "Gm", roster: "Roster", legend: "Legend" };

  const locationsLegendHtml = (() => {
    const defs = locations?.definitions || {};
    const customLocs = locations?.custom || {};
    const newLocs = locations?.locations || {};
    const allLocNames = new Set<string>();

    sessions.forEach((s) => {
      const loc = s.location || "";
      if (loc && loc !== "TBD") allLocNames.add(loc);
    });

    if (allLocNames.size === 0) return "";

    const legendItems: string[] = [];
    for (const name of Array.from(allLocNames).sort()) {
      const def = defs[name];
      const customAddr = customLocs[name];
      const newLoc = newLocs[name];
      const abbr = def?.abbr || "";
      const hallNo = def?.hallNo || "";
      const addr = newLoc?.address || customAddr || "";

      const parts: string[] = [];
      if (abbr) parts.push(`Abk.: ${escapeHtml(abbr)}`);
      if (hallNo) parts.push(`Halle: ${escapeHtml(hallNo)}`);
      if (addr) parts.push(escapeHtml(addr));

      const detail = parts.length > 0 ? ` (${parts.join(" · ")})` : "";
      legendItems.push(`<li style="margin: 4px 0;"><strong>${escapeHtml(name)}</strong>${detail}</li>`);
    }

    if (legendItems.length === 0) return "";

    return `
      <div style="margin-bottom: 24px; padding: 12px; border: 1px solid #ddd; background: #fafafa;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px;">${t.legend}</h3>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.5;">
          ${legendItems.join("")}
        </ul>
      </div>
    `;
  })();

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
  [...trainingSessions, ...games].forEach((s) => {
    const typeLabel = isGameSession(s) ? t.gameShort : t.trainingShort;
    sessionsTableRows += `
      <tr>
        <td style="${tdCss()}">${escapeHtml(s.date)}</td>
        <td style="${tdCss()}">${escapeHtml(s.day)}</td>
        <td style="${tdCss()}">${typeLabel}</td>
        <td style="${tdCss()}">${escapeHtml(s.teams.join(", "))}</td>
        <td style="${tdCss()}">${escapeHtml(s.time)}</td>
        <td style="${tdCss()}">${escapeHtml(s.location)}</td>
        <td style="${tdCss()}">${escapeHtml(s.info || "")}</td>
      </tr>
      <tr>
        <td colspan="7" style="padding: 12px; border: 1px solid #ccc; background: #fcfcfc;">
          <strong>${t.roster}:</strong>
          ${buildRosterTable(s)}
        </td>
      </tr>
    `;
  });

  return `
    <div class="page">
      ${pageHeaderHtml({ title: "Trainingsübersicht", clubName, logoUrl })}
      ${locationsLegendHtml}
      <table>
        <thead>
          <tr>
            <th style="${thCss()}">Datum</th>
            <th style="${thCss()}">Tag</th>
            <th style="${thCss()}">Typ</th>
            <th style="${thCss()}">Teams</th>
            <th style="${thCss()}">Zeit</th>
            <th style="${thCss()}">Ort</th>
            <th style="${thCss()}">Info</th>
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
}): string {
  const { sessions, clubName, locale, locations, logoUrl } = opts;

  const t = locale === "de"
    ? { title: "Trainingswoche", date: "Datum", day: "Tag", type: "Typ", teams: "Teams", time: "Zeit", loc: "Ort", info: "Info",
        trainingShort: "Tr", gameShort: "Sp" }
    : { title: "Training week", date: "Date", day: "Day", type: "Type", teams: "Teams", time: "Time", loc: "Location", info: "Info",
        trainingShort: "Tr", gameShort: "Gm" };

  const locationsLegendHtml = (() => {
    const defs = locations?.definitions || {};
    const customLocs = locations?.custom || {};
    const newLocs = locations?.locations || {};
    const allLocNames = new Set<string>();

    sessions.forEach((s) => {
      const loc = s.location || "";
      if (loc && loc !== "TBD") allLocNames.add(loc);
    });
    if (allLocNames.size === 0) return "";

    const resolveAddr = (name: string) => {
      if (newLocs?.[name]?.address) return newLocs[name].address;
      if (name === "BSH") return locations?.bsh || "";
      if (name === "SHP") return locations?.shp || "";
      if (name === "Seminarraum") return locations?.seminarraum || "";
      return customLocs?.[name] || "";
    };

    const items = Array.from(allLocNames)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => {
        const d = defs[name] ?? { abbr: name, name, hallNo: "" };
        const hall = d.hallNo ? ` · Halle ${d.hallNo}` : "";
        const addr = resolveAddr(name);
        const addrShort = addr
          ? addr.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 3).join(", ")
          : "";
        return `
          <div style="border:1px solid #eee; padding:6px 8px; border-radius:8px;">
            <div style="font-weight:900; font-size:11px;">${escapeHtml(d.abbr || name)} — ${escapeHtml(d.name || name)}${escapeHtml(hall)}</div>
            ${
              addrShort
                ? `<div style="font-size:10px; color:#333; margin-top:2px;">${escapeHtml(addrShort)}</div>`
                : `<div style="font-size:10px; color:#555; margin-top:2px;">(no address)</div>`
            }
          </div>
        `;
      })
      .join("");

    return `
      <div style="margin: 8px 0 14px 0;">
        <div style="font-weight:900; font-size:11px; margin-bottom:6px;">Orte (im Plan)</div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          ${items}
        </div>
      </div>
    `;
  })();

  const rows = sessions
    .map((s) => {
      const isGame = isGameSession(s);
      const typeLabel = isGame ? t.gameShort : t.trainingShort;
      return `
        <tr style="${isGame ? "background:#F59E0B; color:#111;" : ""}">
          <td style="${tdCss()}">${escapeHtml(s.date)}</td>
          <td style="${tdCss()}">${escapeHtml(s.day)}</td>
          <td style="${tdCss()}">${escapeHtml(typeLabel)}</td>
          <td style="${tdCss()}">${escapeHtml(s.teams.join(", "))}</td>
          <td style="${tdCss()}">${escapeHtml(s.time)}</td>
          <td style="${tdCss()}">${escapeHtml(s.location)}</td>
          <td style="${tdCss()}">${escapeHtml(s.info || "")}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="page">
      ${pageHeaderHtml({ title: t.title, clubName, logoUrl })}
      ${locationsLegendHtml}
      <table>
        <thead>
          <tr>
            <th style="${thCss()}">${t.date}</th>
            <th style="${thCss()}">${t.day}</th>
            <th style="${thCss()}">${t.type}</th>
            <th style="${thCss()}">${t.teams}</th>
            <th style="${thCss()}">${t.time}</th>
            <th style="${thCss()}">${t.loc}</th>
            <th style="${thCss()}">${t.info}</th>
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
      if (assigned.length === 0) return `<div style="color:#555; font-size:12px;">${t.none}</div>`;

      const sorted = assigned
        .slice()
        .sort((a, b) => (a.name || "").localeCompare((b.name || ""), locale));

      const rows = sorted
        .map((p, idx) => `
          <tr>
            <td style="${tdCss()} width:28px; text-align:center; font-size:10px; color:#333;">${idx + 1}</td>
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
}): string {
  const { sessions, players, clubName, locale, locations, logoUrl } = opts;

  const scheduleHtml = renderWeekScheduleOnlyHtml({ sessions, clubName, locale, locations, logoUrl });
  const scheduleInner = scheduleHtml
    .replace(/^\s*<div class="page">/, "")
    .replace(/<\/div>\s*$/, "")
    .replace(new RegExp(pageFooterHtml({ clubName, locale }).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "");

  const t = locale === "de"
    ? { rosterTitle: "Kaderlisten", empty: "Keine Teilnehmer zugewiesen." }
    : { rosterTitle: "Roster lists", empty: "No participants assigned." };

  const playerById = new Map(players.map((p) => [p.id, p] as const));

  const rosterRows = sessions
    .map((s) => {
      const names = (s.participants ?? [])
        .map((pid) => playerById.get(pid)?.name)
        .filter((n): n is string => Boolean(n))
        .sort((a, b) => a.localeCompare(b, locale));

      const eventLabel = `${s.day} · ${s.date} · ${s.time} · ${s.location} · ${s.teams.join(", ")}${s.info ? ` · ${s.info}` : ""}`;

      return `
        <tr>
          <td style="${tdCss()} width: 42%;">${escapeHtml(eventLabel)}</td>
          <td style="${tdCss()}">${names.length ? escapeHtml(names.join(", ")) : `<span style="color:#555;">${escapeHtml(t.empty)}</span>`}</td>
        </tr>
      `;
    })
    .join("");

  const rosterSection = `
    <div style="margin-top: 14px;">
      <h3 style="margin: 0 0 8px 0; font-size: 16px;">${escapeHtml(t.rosterTitle)}</h3>
      <table>
        <thead>
          <tr>
            <th style="${thCss()}">${locale === "de" ? "Event" : "Event"}</th>
            <th style="${thCss()}">${locale === "de" ? "Spieler" : "Players"}</th>
          </tr>
        </thead>
        <tbody>
          ${rosterRows}
        </tbody>
      </table>
    </div>
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

      const ta = p?.taNumber ?? "";
      const jerseyVal = p?.jerseyByTeam?.[firstTeam] ?? "";

      return `
        <tr>
          <td style="${tdCss()} text-align:center; font-size:10px; color:#333; width:22px;">${idx + 1}</td>
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

      <div style="font-size:11px; color:#333; margin-top:8px;">
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
}): PrintPage[] {
  const { sessions, players, coaches, clubName, locale, locations, logoUrl } = opts;
  const pages: PrintPage[] = [];

  const firstPageHtml = renderWeekSummaryAndRostersFirstPageHtml({
    sessions,
    players,
    clubName,
    locale,
    locations,
    logoUrl,
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
}): PrintPage[] {
  const { sessions, players, coaches, clubName, locale, locations, logoUrl } = opts;

  const pages: PrintPage[] = [];

  pages.push({
    type: "overview",
    html: renderWeekSummaryAndRostersFirstPageHtml({ sessions, players, clubName, locale, locations, logoUrl }),
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
