import type { CalendarEvent as Session, Coach, GroupId, Player, WeekPlan } from "@/types";
import { PRINT_GROUP_ORDER, getPlayerGroup } from "@/state/playerGrouping";
import { dateToDDMMYYYY_DOTS, dateToShortDE, kwLabelFromPlan, weekdayShortDE } from "@/utils/date";
import { normalizeYearColor, pickTextColor } from "@/utils/color";

type Props = {
  plan: WeekPlan;
  playerById: Map<string, Player>;
  groupBg: Record<GroupId, string>;
  coaches: Coach[];
  birthdayPlayerIds: Set<string>;
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

export function PrintView({ plan, playerById, groupBg, coaches, birthdayPlayerIds, t }: Props) {
  const logoUrl = "https://ubc.ms/wp-content/uploads/2022/06/ubc-logo.png";

  const mondayDate =
    plan.sessions.find((s) => (s.day || "").toLowerCase().startsWith("mo"))?.date ??
    plan.sessions[0]?.date ??
    new Date().toISOString().slice(0, 10);

  const kwText = kwLabelFromPlan(plan);

  function sessionLabel(s: Session) {
    if (s.kaderLabel) return s.kaderLabel;
    const day = s.day || weekdayShortDE(s.date);
    const teamLabel = (s.teams ?? []).join("+").replaceAll("1RLH", "RLH");
    return `${day}-${teamLabel || "Event"}`;
  }

  function exportDateCell(s: Session) {
    const day = (s.day || "").toLowerCase();
    if (day.startsWith("mo")) return dateToDDMMYYYY_DOTS(s.date);
    return dateToShortDE(s.date);
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
            padding: 6px 8px;
            font-size: 11px;
            vertical-align: middle;
            text-align: center;
            white-space: nowrap;
          }
          th { background: #f3f4f6; font-weight: 900; }

          .infoCol {
            white-space: normal !important;
            word-break: break-word;
            text-align: left !important;
            min-width: 260px;
          }
        `}
      </style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={logoUrl} alt="UBC" style={{ height: 38 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 900 }}>UBC Münster</div>
            <div style={{ fontSize: 11, fontWeight: 800 }}>{t("seasonTrainingOverview")}</div>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 900 }}>{dateToDDMMYYYY_DOTS(mondayDate)}</div>
          <div style={{ fontSize: 11, fontWeight: 900 }}>
            {t("trainingWeek")}: {kwText}
          </div>
          <div style={{ fontSize: 10, color: "#374151", fontWeight: 700 }}>
            BSH = Ballsporthalle; SHP = Sporthalle Pascal; Seminarraum = Seminarraum
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, fontWeight: 900, fontSize: 12 }}>{t("weekOverview")}</div>
      <div style={{ marginTop: 6 }}>
        <table>
          <thead>
            <tr>
              <th>{t("date")}</th>
              <th>{t("day")}</th>
              <th>{t("time")}</th>
              <th>{t("teams")}</th>
              <th>{t("hall")}</th>
              <th>{t("roster")}</th>
              <th className="infoCol">{t("info")}</th>
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

              return (
                <tr key={s.id} style={{ background: isGame ? "#F59E0B" : "transparent", color: "#111" }}>
                  <td style={{ borderTop: topBorder }}>{sameDayAsPrev ? "" : exportDateCell(s)}</td>
                  <td style={{ borderTop: topBorder }}>{sameDayAsPrev ? "" : s.day}</td>
                  <td style={{ borderTop: topBorder }}>{s.time}</td>
                  <td style={{ borderTop: topBorder }}>{(s.teams ?? []).join(" / ")}</td>
                  <td style={{ borderTop: topBorder }}>{s.location}</td>
                  <td style={{ borderTop: topBorder }}>{sessionLabel(s)}</td>
                  <td className="infoCol" style={{ borderTop: topBorder }}>
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
