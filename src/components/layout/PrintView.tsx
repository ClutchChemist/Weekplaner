import type { CalendarEvent as Session, Coach, GroupId, Player, ThemeLocations, WeekPlan } from "@/types";
import { PRINT_GROUP_ORDER, getPlayerGroup } from "@/state/playerGrouping";
import { dateToShortDE, kwLabelFromPlan, weekdayShortDE } from "@/utils/date";
import { normalizeYearColor, pickTextColor } from "@/utils/color";

type Props = {
  plan: WeekPlan;
  playerById: Map<string, Player>;
  groupBg: Record<GroupId, string>;
  coaches: Coach[];
  birthdayPlayerIds: Set<string>;
  clubName: string;
  logoUrl?: string | null;
  locations?: ThemeLocations;
  t: (k: string) => string;
};

function exportShortName(p: Player): string {
  if (p.id === "TBD") return "TBD";
  const fn = (p.firstName ?? "").trim();
  const ln = (p.lastName ?? "").trim();

  if (fn || ln) {
    const initial = ln ? ln[0].toUpperCase() : "";
    const first = fn ? fn : (p.name ?? "").split(" ")[0] ?? "";
    return (first || "").trim() + (initial ? ` ${initial}` : "");
  }

  const parts = String(p.name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0].toUpperCase()}`;
}

export function PrintView({
  plan,
  playerById,
  groupBg,
  coaches,
  birthdayPlayerIds,
  clubName,
  logoUrl,
  locations,
  t,
}: Props) {


  const kwText = kwLabelFromPlan(plan);

  const locationLegend = (() => {
    const defs = locations?.definitions ?? {};
    const newLocs = locations?.locations ?? {};
    const namesInPlan = Array.from(new Set((plan.sessions ?? []).map((s) => String(s.location ?? "").trim()).filter(Boolean)));
    const rows = namesInPlan
      .map((name) => {
        const def = defs[name];
        const abbr = (def?.abbr ?? "").trim() || name.substring(0, 3).toUpperCase();
        const fullName = (def?.name ?? name).trim();
        const addr = (newLocs[name]?.address ?? locations?.bsh ?? "").trim();
        const addrShort = addr ? addr.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 2).join(", ") : "";
        let text = `<strong>${abbr}</strong> = ${fullName}`;
        if (addrShort) text += ` | ${addrShort}`;
        return text;
      })
      .filter(Boolean);

    return rows.length > 0 ? rows : null;
  })();

  function sessionLabel(s: Session) {
    if (s.kaderLabel) return s.kaderLabel;
    const day = s.day || weekdayShortDE(s.date);
    const teamLabel = (s.teams ?? []).join("+").replaceAll("1RLH", "RLH");
    return `${day}-${teamLabel || "Event"}`;
  }

  function exportDateCell(s: Session) {
    // Format: DD-Mon (z.B. 22-Feb)
    const raw = s.date || "";
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    const day = String(d.getDate()).padStart(2, "0");
    const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    const mon = monthNames[d.getMonth()] ?? "";
    return `${day}-${mon}`;
  }

  function sortedParticipantsForSession(s: Session): Player[] {
    const players: Player[] = (s.participants ?? []).map((pid) => playerById.get(pid)).filter(Boolean) as Player[];

    const byGroup: Record<GroupId, Player[]> = {
      "2007": [],
      "2008": [],
      "2009": [],
      Herren: [],
      TBD: [],
    };

    for (const p of players) byGroup[getPlayerGroup(p)].push(p);
    for (const gid of PRINT_GROUP_ORDER) byGroup[gid].sort((a, b) => a.name.localeCompare(b.name, "de"));

    return PRINT_GROUP_ORDER.flatMap((gid) => byGroup[gid]);
  }

  const rosterColumns = plan.sessions.map((s) => ({
    id: s.id,
    label: sessionLabel(s),
    players: sortedParticipantsForSession(s),
  }));

  const maxRows = Math.max(0, ...rosterColumns.map((c) => c.players.length));
  const hasTbd = plan.sessions.some((s) => (s.participants ?? []).includes("TBD"));

  return (
    <div id="print-root" style={{ padding: 18, background: "white", color: "#111" }}>
      <style>
        {`
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            #app-root { display: none !important; }
            #print-root { display: block !important; }
            @page { size: A4 portrait; margin: 10mm; }
          }
          @media screen {
            #print-root { display: none; }
          }

          table { border-collapse: collapse; width: 100%; table-layout: auto; }
          th, td {
            border: 1px solid #ddd;
            padding: 3px 5px;
            font-size: 9px;
            vertical-align: middle;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
          }
          th { background: #f3f4f6; font-weight: 900; }

          /* Wochenplan-Tabelle: linke 5 Spalten je 10% = 50%, Info 50% */
          .weekTable { table-layout: fixed; }
          .weekTable .colDate  { width: 10%; }
          .weekTable .colDay   { width: 10%; }
          .weekTable .colTime  { width: 10%; }
          .weekTable .colTeam  { width: 10%; }
          .weekTable .colHall  { width: 10%; }
          .weekTable .colInfo  { width: 50%; white-space: normal !important; word-break: break-word; text-align: left !important; }

          .infoCol {
            white-space: normal !important;
            word-break: break-word;
            text-align: left !important;
          }
        `}
      </style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        {/* LINKS: LOGO */}
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          {logoUrl ? <img src={logoUrl} alt={clubName} style={{ height: 48, objectFit: "contain" }} /> : <div style={{ width: 48, height: 48, background: "#eee" }} />}
        </div>

        {/* MITTE: TITEL & KW */}
        <div style={{ flex: 1, textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{t("seasonTrainingOverview")}</div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>- {t("trainingWeek")} {kwText} -</div>
        </div>

        {/* RECHTS: VEREIN & ORTE */}
        <div style={{ flex: 1, textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 2 }}>{clubName}</div>
          {locationLegend ? (
            <div style={{ textAlign: "right" }}>
              {locationLegend.map((line, i) => (
                <div key={i} style={{ fontSize: 8, color: "#444", lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: line }} />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 8, fontWeight: 900, fontSize: 11 }}>{t("weekOverview")}</div>
      <div style={{ marginTop: 4 }}>
        <table className="weekTable">
          <colgroup>
            <col className="colDate" />
            <col className="colDay" />
            <col className="colTime" />
            <col className="colTeam" />
            <col className="colHall" />
            <col className="colInfo" />
          </colgroup>
          <thead>
            <tr>
              <th className="colDate">{t("date")}</th>
              <th className="colDay">{t("day")}</th>
              <th className="colTime">{t("time")}</th>
              <th className="colTeam">{t("teams")}</th>
              <th className="colHall">{t("hall")}</th>
              <th className="colInfo">{t("info")}</th>
            </tr>
          </thead>
          <tbody>
            {plan.sessions.map((s, i, arr) => {
              const prev = arr[i - 1];
              const sameDayAsPrev = prev ? prev.date === s.date : false;

              const dayLower = (s.day || "").toLowerCase();
              const isWeekend = dayLower.startsWith("sa") || dayLower.startsWith("so");

              const infoText = (s.info ?? "").trim();
              const isGame = infoText.toLowerCase().startsWith("vs") || infoText.startsWith("@");

              const topBorder = !sameDayAsPrev ? (isWeekend ? "2px solid #111" : "1px solid #bbb") : "1px solid #ddd";
              const rowBg = s.rowColor || (isGame ? "#F59E0B" : "transparent");

              return (
                <tr key={s.id}>
                  <td style={{ borderTop: topBorder }}>{sameDayAsPrev ? "" : exportDateCell(s)}</td>
                  <td style={{ borderTop: topBorder }}>{sameDayAsPrev ? "" : s.day}</td>
                  <td style={{ borderTop: topBorder, background: rowBg, color: "#111" }}>{s.time}</td>
                  <td style={{ borderTop: topBorder, background: rowBg, color: "#111" }}>{(s.teams ?? []).join(" / ")}</td>
                  <td style={{ borderTop: topBorder, background: rowBg, color: "#111" }}>{s.location}</td>
                  <td className="colInfo" style={{ borderTop: topBorder, background: rowBg, color: "#111" }}>
                    {s.info ?? ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, fontWeight: 900, fontSize: 12 }}>{t("rosterLists")}</div>
      <div style={{ marginTop: 6 }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 28 }}>#</th>
              {rosterColumns.map((c) => (
                <th key={c.id}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRows }, (_, i) => i).map((rowIdx) => (
              <tr key={rowIdx}>
                <td style={{ fontWeight: 900 }}>{rowIdx + 1}</td>
                {rosterColumns.map((c) => {
                  const p = c.players[rowIdx];
                  if (!p) return <td key={c.id}></td>;

                  const gid = getPlayerGroup(p);
                  const bg = normalizeYearColor(p.yearColor) ?? groupBg[gid];
                  const text = pickTextColor(bg);

                  return (
                    <td key={c.id} style={{ background: bg, color: text, fontWeight: 900 }}>
                      {exportShortName(p)}
                      {birthdayPlayerIds.has(p.id) ? " 🎂" : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {hasTbd && (
          <div style={{ marginTop: 6, fontSize: 10, color: "#374151", fontWeight: 700 }}>{t("tbdLegend")}</div>
        )}
      </div>

      {(() => {
        const games = plan.sessions.filter((s) => {
          const info = (s.info ?? "").trim();
          const low = info.toLowerCase();
          return low.startsWith("vs") || info.startsWith("@");
        });

        function getOpponent(info: string): { mode: "HOME" | "AWAY"; opponent: string } {
          const text = (info ?? "").trim();
          if (text.startsWith("@")) return { mode: "AWAY", opponent: text.slice(1).trim() || "—" };
          const low = text.toLowerCase();
          if (low.startsWith("vs")) return { mode: "HOME", opponent: text.slice(2).trim() || "—" };
          return { mode: "HOME", opponent: text || "—" };
        }

        function jerseyForTeam(p: Player, team: string): string {
          const jb = p.jerseyByTeam ?? {};
          const v = jb[team];
          if (typeof v === "number" && Number.isFinite(v)) return String(v);
          if (v === 0) return "0";
          return "";
        }

        function taForPlayer(p: Player): string {
          const list = p.lizenzen ?? [];
          const dbb = list.find((x) => String(x.typ).toUpperCase() === "DBB")?.tna;
          const nbbl = list.find((x) => String(x.typ).toUpperCase() === "NBBL")?.tna;
          return (dbb ?? nbbl ?? list[0]?.tna ?? "").trim();
        }

        if (!games.length) return null;

        return (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900, fontSize: 12 }}>{t("gameExports")}</div>

            <div style={{ marginTop: 8, display: "grid", gap: 12 }}>
              {games.map((g) => {
                const team = (g.teams ?? [])[0] ?? "—";
                const opp = getOpponent(g.info ?? "");
                const title = `${dateToShortDE(g.date)} | ${team} ${opp.mode === "AWAY" ? "@ " : "vs "}${opp.opponent}`;

                const players: Player[] = (g.participants ?? []).map((pid) => playerById.get(pid)).filter(Boolean) as Player[];

                players.sort((a, b) => {
                  const ja = parseInt(jerseyForTeam(a, team) || "999", 10);
                  const jb = parseInt(jerseyForTeam(b, team) || "999", 10);
                  if (ja !== jb) return ja - jb;
                  return a.name.localeCompare(b.name, "de");
                });

                return (
                  <div key={g.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <div style={{ fontWeight: 900, fontSize: 11 }}>{title}</div>
                      <div style={{ fontWeight: 800, fontSize: 11, color: "#374151" }}>
                        {g.time} | {g.location}
                      </div>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: 28 }}>#</th>
                            <th style={{ width: 54 }}>{t("jersey")}</th>
                            <th>{t("lastName")}</th>
                            <th>{t("firstName")}</th>
                            <th style={{ width: 120 }}>TA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {players.map((p, idx) => (
                            <tr key={p.id}>
                              <td style={{ fontWeight: 900 }}>{idx + 1}</td>
                              <td>{jerseyForTeam(p, team)}</td>
                              <td style={{ textAlign: "left" }}>{(p.lastName ?? "").trim()}</td>
                              <td style={{ textAlign: "left" }}>{(p.firstName ?? "").trim()}</td>
                              <td>{taForPlayer(p)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 10, color: "#374151", fontWeight: 800 }}>
                      {t("coaches")}: {(coaches ?? []).map((c) => `${c.role}: ${c.name}${c.license ? ` (${c.license})` : ""}`).join(" | ")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div style={{ marginTop: 12, fontWeight: 900, fontSize: 12 }}>{t("coaches")}</div>
      <div style={{ marginTop: 6, fontSize: 11 }}>
        {(coaches ?? []).map((c) => (
          <div
            key={c.id}
            style={{ display: "flex", justifyContent: "space-between", gap: 10, borderBottom: "1px solid #eee", padding: "4px 0" }}
          >
            <div style={{ fontWeight: 800 }}>
              {c.role}: {c.name}
            </div>
            <div style={{ color: "#374151", fontWeight: 800 }}>
              {c.license ? `${t("license")} ${c.license}` : `${t("license")} —`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
