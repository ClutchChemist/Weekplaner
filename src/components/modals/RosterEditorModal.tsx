import { useMemo, useRef, useState } from "react";
import type { GroupId, Player, Position } from "@/types";
import { birthYearOf, getPlayerGroup } from "@/state/playerGrouping";
import { dbbDobMatchesBirthDate, primaryTna } from "@/state/playerMeta";
import { normalizeYearColor, pickTextColor } from "@/utils/color";
import { downloadJson } from "@/utils/json";
import { Button, Input, Modal, Select } from "@/components/ui";
import type { MmbImportFeedback } from "@/hooks/usePlayerActions";

type Props = {
  open: boolean;
  onClose: () => void;
  t: (key: string) => string;
  lang: "de" | "en";
  players: Player[];
  selectedPlayerId: string | null;
  onSelectPlayerId: (id: string) => void;
  rosterSearch: string;
  onRosterSearchChange: (value: string) => void;
  addNewPlayer: () => void;
  exportRoster: () => void;
  importRosterFile: (file: File) => void | Promise<void>;
  importMmbFile: (file: File, lizenzTyp: string) => void | Promise<void>;
  mmbImportFeedback: MmbImportFeedback | null;
  clearMmbImportFeedback: () => void;
  deletePlayer: (id: string) => void;
  updatePlayer: (id: string, patch: Partial<Player>) => void;
  activeYearGroups: string[];
  allTeamOptions: string[];
  teamCodeDraft: string;
  onTeamCodeDraftChange: (value: string) => void;
  onAddTeamCodeFromDraft: () => void;
  clubName: string;
  groupBg: Record<string, string>;
  groupText: Record<string, string | undefined>;
};

export function RosterEditorModal({
  open,
  onClose,
  t,
  lang,
  players,
  selectedPlayerId,
  onSelectPlayerId,
  rosterSearch,
  onRosterSearchChange,
  addNewPlayer,
  exportRoster,
  importRosterFile,
  importMmbFile,
  mmbImportFeedback,
  clearMmbImportFeedback,
  deletePlayer,
  updatePlayer,
  activeYearGroups,
  allTeamOptions,
  teamCodeDraft,
  onTeamCodeDraftChange,
  onAddTeamCodeFromDraft,
  clubName,
  groupBg,
  groupText,
}: Props) {
  const rosterFileRef = useRef<HTMLInputElement | null>(null);
  const mmbFileRef = useRef<HTMLInputElement | null>(null);
  const [mmbLizenzTyp, setMmbLizenzTyp] = useState<string>("DBB");
  const [selectedIssueIdx, setSelectedIssueIdx] = useState<number | null>(null);

  const filteredPreviewRows = useMemo(() => {
    if (!mmbImportFeedback) return [];
    const selectedIssue =
      selectedIssueIdx !== null ? mmbImportFeedback.issueDetails[selectedIssueIdx] : null;
    if (!selectedIssue) return mmbImportFeedback.previewRows;
    return mmbImportFeedback.previewRows.filter(
      (row) =>
        row.sheetName === selectedIssue.sheetName &&
        row.rowNumber === selectedIssue.rowNumber
    );
  }, [mmbImportFeedback, selectedIssueIdx]);

  function downloadIssueRowsCsv(filename: string, rows: Array<Record<string, string>>) {
    const headers = ["issue", "sheet", "row", "name", "taNumber", "birthDate"];
    const escapeCsv = (value: string) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const lines = [
      headers.join(","),
      ...rows.map((row) => headers.map((h) => escapeCsv(row[h] ?? "")).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function buildIssueExportRows() {
    if (!mmbImportFeedback) return [];
    const issueRows = mmbImportFeedback.issueDetails.map((issue) => {
      const match = mmbImportFeedback.previewRows.find(
        (row) => row.sheetName === issue.sheetName && row.rowNumber === issue.rowNumber
      );
      return {
        issue: issue.label,
        sheet: issue.sheetName ?? "",
        row: issue.rowNumber ? String(issue.rowNumber) : "",
        name: match?.name ?? "",
        taNumber: match?.taNumber ?? "",
        birthDate: match?.birthDate ?? "",
      };
    });
    const missingSheetRows = mmbImportFeedback.missingColumnsSheets.map((sheet) => ({
      issue: t("importMmbIssueMissingColumns"),
      sheet,
      row: "",
      name: "",
      taNumber: "",
      birthDate: "",
    }));
    return [...issueRows, ...missingSheetRows];
  }

  function buildFilteredIssueExportRows() {
    if (!mmbImportFeedback || selectedIssueIdx === null) return [];
    const selectedIssue = mmbImportFeedback.issueDetails[selectedIssueIdx];
    if (!selectedIssue) return [];
    if (filteredPreviewRows.length === 0) {
      return [
        {
          issue: selectedIssue.label,
          sheet: selectedIssue.sheetName ?? "",
          row: selectedIssue.rowNumber ? String(selectedIssue.rowNumber) : "",
          name: "",
          taNumber: "",
          birthDate: "",
        },
      ];
    }
    return filteredPreviewRows.map((row) => ({
      issue: selectedIssue.label,
      sheet: row.sheetName ?? "",
      row: row.rowNumber ? String(row.rowNumber) : "",
      name: row.name ?? "",
      taNumber: row.taNumber ?? "",
      birthDate: row.birthDate ?? "",
    }));
  }

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null;
    return players.find((p) => p.id === selectedPlayerId) ?? null;
  }, [players, selectedPlayerId]);

  if (!open) return null;

  return (
    <Modal title={`${t("rosterEdit")} (roster.json)`} onClose={onClose} closeLabel={t("close")}>
      <div className="rosterGrid">
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ border: `1px solid var(--ui-border)`, borderRadius: 14, background: "var(--ui-card)", padding: 12 }}>
            <div className="flexRow">
              <Button onClick={addNewPlayer} style={{ padding: "8px 10px" }}>+ {t("playersSingle")}</Button>
              <Button variant="outline" onClick={exportRoster} style={{ padding: "8px 10px" }}>
                {t("export")} roster.json
              </Button>
              <Button
                variant="outline"
                onClick={() => rosterFileRef.current?.click()}
                style={{ padding: "8px 10px" }}
              >
                {t("import")} roster.json
              </Button>
              <select
                value={mmbLizenzTyp}
                onChange={(e) => setMmbLizenzTyp(e.target.value)}
                title={t("importMmbLizenzTypLabel")}
                style={{
                  fontSize: 12,
                  padding: "6px 8px",
                  borderRadius: 8,
                  border: "1px solid var(--ui-border)",
                  background: "var(--ui-card)",
                  color: "var(--ui-text)",
                  fontWeight: 800,
                }}
              >
                <option value="DBB">DBB</option>
                <option value="NBBL">NBBL</option>
                <option value="JBBL">JBBL</option>
                <option value="ProA">ProA</option>
                <option value="ProB">ProB</option>
              </select>
              <Button
                variant="outline"
                onClick={() => mmbFileRef.current?.click()}
                style={{ padding: "8px 10px" }}
              >
                {t("import")} MMB (Excel/PDF)
              </Button>
              <input
                ref={rosterFileRef}
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importRosterFile(f);
                  e.currentTarget.value = "";
                }}
              />
              <input
                ref={mmbFileRef}
                type="file"
                accept=".xlsx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importMmbFile(f, mmbLizenzTyp);
                  e.currentTarget.value = "";
                }}
              />
            </div>

            <div style={{ marginTop: 10, color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
              {t("rosterHintTbd")}
            </div>
            <div style={{ marginTop: 6, color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
              {t("importMmbHint")}
            </div>
            {mmbImportFeedback && (
              <div
                style={{
                  marginTop: 10,
                  border: `1px solid ${mmbImportFeedback.kind === "success" ? "#10b981" : "#ef4444"}`,
                  background: mmbImportFeedback.kind === "success" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                  borderRadius: 12,
                  padding: 10,
                  fontSize: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ fontWeight: 900 }}>{t("importMmbReportTitle")}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const exportRows = buildIssueExportRows();
                        if (!exportRows.length) return;
                        downloadJson(
                          `mmb-import-issues-${Date.now()}.json`,
                          { fileName: mmbImportFeedback.fileName, issues: exportRows }
                        );
                      }}
                      style={{ padding: "4px 8px" }}
                      disabled={buildIssueExportRows().length === 0}
                    >
                      {t("importMmbExportIssuesJson")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const exportRows = buildIssueExportRows();
                        if (!exportRows.length) return;
                        downloadIssueRowsCsv(`mmb-import-issues-${Date.now()}.csv`, exportRows);
                      }}
                      style={{ padding: "4px 8px" }}
                      disabled={buildIssueExportRows().length === 0}
                    >
                      {t("importMmbExportIssuesCsv")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const exportRows = buildFilteredIssueExportRows();
                        if (!exportRows.length) return;
                        downloadIssueRowsCsv(`mmb-import-issues-filtered-${Date.now()}.csv`, exportRows);
                      }}
                      style={{ padding: "4px 8px" }}
                      disabled={selectedIssueIdx === null || buildFilteredIssueExportRows().length === 0}
                    >
                      {t("importMmbExportFilteredIssuesCsv")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedIssueIdx(null);
                        clearMmbImportFeedback();
                      }}
                      style={{ padding: "4px 8px" }}
                    >
                      {t("close")}
                    </Button>
                  </div>
                </div>
                <div style={{ marginTop: 6, fontWeight: 800 }}>
                  {mmbImportFeedback.message ?? t("importMmbReportSuccess")}
                </div>
                <div style={{ marginTop: 6, color: "var(--ui-muted)", fontWeight: 700 }}>
                  {t("importMmbReportFile")}: {mmbImportFeedback.fileName}
                </div>
                <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 4 }}>
                  <div>{t("importMmbReportCreated")}: {mmbImportFeedback.createdCount}</div>
                  <div>{t("importMmbReportUpdated")}: {mmbImportFeedback.updatedCount}</div>
                  <div>{t("importMmbReportImportedRows")}: {mmbImportFeedback.importedRows}</div>
                  <div>{t("importMmbReportDuplicates")}: {mmbImportFeedback.duplicateRowsSkipped}</div>
                </div>
                {mmbImportFeedback.missingColumnsSheets.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 900 }}>{t("importMmbReportMissingCols")}</div>
                    <div>{mmbImportFeedback.missingColumnsSheets.join(", ")}</div>
                  </div>
                )}
                {mmbImportFeedback.issueDetails.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 900 }}>{t("importMmbReportRowIssues")}</div>
                    <div style={{ display: "grid", gap: 2, marginTop: 4 }}>
                      {mmbImportFeedback.issueDetails.map((issue, idx) => (
                        <button
                          key={`${issue.label}-${idx}`}
                          onClick={() => setSelectedIssueIdx((prev) => (prev === idx ? null : idx))}
                          style={{
                            textAlign: "left",
                            border: `1px solid ${selectedIssueIdx === idx ? "var(--ui-soft)" : "var(--ui-border)"}`,
                            borderRadius: 8,
                            background: selectedIssueIdx === idx ? "rgba(59,130,246,0.15)" : "transparent",
                            color: "var(--ui-text)",
                            padding: "4px 6px",
                            cursor: "pointer",
                          }}
                        >
                          {issue.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {mmbImportFeedback.previewRows.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <div style={{ fontWeight: 900 }}>{t("importMmbReportPreviewRows")}</div>
                      {selectedIssueIdx !== null && (
                        <Button variant="outline" onClick={() => setSelectedIssueIdx(null)} style={{ padding: "4px 8px" }}>
                          {t("importMmbReportClearIssueFilter")}
                        </Button>
                      )}
                    </div>
                    <div style={{ marginTop: 6, maxHeight: 180, overflow: "auto", display: "grid", gap: 4 }}>
                      {filteredPreviewRows.map((row, idx) => (
                        <div
                          key={`${row.sheetName ?? "sheet"}-${row.rowNumber ?? 0}-${row.name}-${idx}`}
                          style={{
                            border: "1px solid var(--ui-border)",
                            borderRadius: 8,
                            padding: "4px 6px",
                            fontSize: 12,
                          }}
                        >
                          <div style={{ fontWeight: 800 }}>{row.name}</div>
                          <div style={{ color: "var(--ui-muted)" }}>
                            {row.sheetName ?? "?"} #{row.rowNumber ?? "?"} | TA: {row.taNumber ?? "-"} | DOB: {row.birthDate ?? "-"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ border: `1px solid var(--ui-border)`, borderRadius: 14, background: "var(--ui-card)", padding: 10 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>{t("players")}</div>
            <Input
              value={rosterSearch}
              onChange={onRosterSearchChange}
              placeholder={t("rosterSearchPlaceholder")}
              style={{ marginBottom: 8 }}
            />
            <div style={{ fontSize: 12, color: "var(--ui-muted)", fontWeight: 800, marginBottom: 8 }}>
              {t("filter")}: {rosterSearch.trim() ? `"${rosterSearch.trim()}"` : "-"}
            </div>
            <div style={{ display: "grid", gap: 6, maxHeight: "60vh", overflow: "auto" }}>
              {(() => {
                const q = rosterSearch.trim().toLowerCase();

                const list = players
                  .filter((p) => p.id !== "TBD")
                  .filter((p) => {
                    if (!q) return true;
                    const hay = [
                      p.name,
                      p.firstName,
                      p.lastName,
                      String(p.birthYear ?? ""),
                      String(p.birthDate ?? ""),
                      primaryTna(p),
                    ]
                      .filter(Boolean)
                      .join(" ")
                      .toLowerCase();
                    return hay.includes(q);
                  })
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name, "de"));

                return list.map((p) => {
                  const active = p.id === selectedPlayerId;
                  const gid = getPlayerGroup(p);
                  const bg = normalizeYearColor(p.yearColor) ?? groupBg[gid] ?? groupBg.TBD;
                  const text = p.yearColor ? pickTextColor(bg) : (groupText[gid] ?? pickTextColor(bg));
                  const subText = text === "#fff" ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.72)";
                  const tna = primaryTna(p);
                  return (
                    <button
                      key={p.id}
                      onClick={() => onSelectPlayerId(p.id)}
                      style={{
                        textAlign: "left",
                        border: `1px solid ${active ? "var(--ui-soft)" : "rgba(0,0,0,0.18)"}`,
                        background: bg,
                        color: text,
                        borderRadius: 12,
                        padding: "10px 10px",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                      title={tna ? `${t("primaryTaTna")}: ${tna}` : t("noTaTna")}
                    >
                      <span style={{ fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {p.name}
                      </span>
                      <span style={{ fontWeight: 900, color: subText }}>{gid}</span>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {!selectedPlayer ? (
            <div style={{ border: `1px solid var(--ui-border)`, borderRadius: 14, background: "var(--ui-card)", padding: 12, color: "var(--ui-muted)", fontWeight: 900 }}>
              {t("selectPlayerLeft")}
            </div>
          ) : (
            <>
              <div style={{ border: `1px solid var(--ui-border)`, borderRadius: 14, background: "var(--ui-card)", padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>{selectedPlayer.name}</div>
                  <Button
                    variant="outline"
                    onClick={() => deletePlayer(selectedPlayer.id)}
                    style={{ padding: "8px 10px", borderColor: "#ef4444", color: "#ef4444" }}
                  >
                    {t("delete").toLowerCase()}
                  </Button>
                </div>

                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("firstName")}</div>
                    <Input value={selectedPlayer.firstName ?? ""} onChange={(v) => updatePlayer(selectedPlayer.id, { firstName: v })} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("name")}</div>
                    <Input value={selectedPlayer.lastName ?? ""} onChange={(v) => updatePlayer(selectedPlayer.id, { lastName: v })} />
                  </div>

                  <div>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("birthYearForGroup")}</div>
                    <Input
                      type="number"
                      value={String(selectedPlayer.birthYear ?? "")}
                      onChange={(v) => updatePlayer(selectedPlayer.id, { birthYear: v ? parseInt(v, 10) : undefined })}
                    />
                  </div>
                  <div>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("birthDateOptional")}</div>
                    <Input type="date" value={selectedPlayer.birthDate ?? ""} onChange={(v) => updatePlayer(selectedPlayer.id, { birthDate: v })} />
                  </div>

                  <div>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("group")}</div>
                    {(() => {
                      const y = birthYearOf(selectedPlayer);
                      const yearLocked = typeof y === "number" && activeYearGroups.includes(String(y));
                      return (
                        <Select
                          value={selectedPlayer.group ?? getPlayerGroup(selectedPlayer)}
                          onChange={(v) => updatePlayer(selectedPlayer.id, { group: v as GroupId })}
                          options={
                            yearLocked
                              ? [{ value: String(y), label: String(y) }]
                              : [
                                ...activeYearGroups.map((year) => ({ value: year, label: year })),
                                { value: "Herren", label: "Herren" },
                              ]
                          }
                          disabled={yearLocked}
                        />
                      );
                    })()}
                  </div>

                  <div>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("localPlayer")}</div>
                    <Select
                      value={selectedPlayer.isLocalPlayer ? "true" : "false"}
                      onChange={(v) => updatePlayer(selectedPlayer.id, { isLocalPlayer: v === "true" })}
                      options={[
                        { value: "true", label: t("lpYes") },
                        { value: "false", label: t("lpNo") },
                      ]}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 12, borderTop: `1px solid var(--ui-border)`, paddingTop: 12 }}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>{t("licensesTa")}</div>

                  {(() => {
                    const check = dbbDobMatchesBirthDate(selectedPlayer);
                    if (check?.ok) return null;

                    return (
                      <div
                        style={{
                          marginTop: 10,
                          border: "1px solid #ef4444",
                          background: "rgba(239,68,68,0.12)",
                          borderRadius: 12,
                          padding: "10px 12px",
                          fontWeight: 900,
                          fontSize: 12,
                          color: "var(--ui-text)",
                        }}
                      >
                        {t("dbbTaBirthMismatch")}: {check?.reason}
                      </div>
                    );
                  })()}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("dbbTna")}</div>
                      <Input
                        value={(selectedPlayer.lizenzen ?? []).find((x) => String(x.typ).toUpperCase() === "DBB")?.tna ?? ""}
                        onChange={(v) => {
                          const list = [...(selectedPlayer.lizenzen ?? [])].filter((x) => String(x.typ).toUpperCase() !== "DBB");
                          if (v.trim()) list.push({ typ: "DBB", tna: v.trim(), verein: clubName });
                          updatePlayer(selectedPlayer.id, { lizenzen: list });
                        }}
                        placeholder={t("dbbTnaExample")}
                      />
                    </div>
                    <div>
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("nbblTna")}</div>
                      <Input
                        value={(selectedPlayer.lizenzen ?? []).find((x) => String(x.typ).toUpperCase() === "NBBL")?.tna ?? ""}
                        onChange={(v) => {
                          const list = [...(selectedPlayer.lizenzen ?? [])].filter((x) => String(x.typ).toUpperCase() !== "NBBL");
                          if (v.trim()) list.push({ typ: "NBBL", tna: v.trim(), verein: clubName });
                          updatePlayer(selectedPlayer.id, { lizenzen: list });
                        }}
                        placeholder={t("nbblTnaExample")}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 10, color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
                    {t("rosterPlayerIdHint")}
                  </div>
                </div>
              </div>

              <div style={{ border: `1px solid var(--ui-border)`, borderRadius: 14, background: "var(--ui-card)", padding: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>{t("positionsMultiSelect")}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(["PG", "SG", "SF", "PF", "C"] as Position[]).map((pos) => {
                    const current = selectedPlayer.positions ?? [];
                    const active = current.includes(pos);
                    return (
                      <Button
                        key={pos}
                        variant={active ? "solid" : "outline"}
                        onClick={() => {
                          const next = active ? current.filter((x) => x !== pos) : [...current, pos];
                          updatePlayer(selectedPlayer.id, { positions: next });
                        }}
                        style={{ padding: "8px 10px" }}
                      >
                        {pos}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  border: `1px solid var(--ui-border)`,
                  borderRadius: 14,
                  background: "var(--ui-card)",
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 8 }}>{t("defaultTeams")}</div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {allTeamOptions.map((teamCode) => {
                    const current = selectedPlayer.defaultTeams ?? [];
                    const active = current.includes(teamCode);

                    return (
                      <Button
                        key={teamCode}
                        variant={active ? "solid" : "outline"}
                        onClick={() => {
                          const next = active ? current.filter((x) => x !== teamCode) : [...current, teamCode];
                          updatePlayer(selectedPlayer.id, { defaultTeams: next });
                        }}
                        style={{ padding: "8px 10px" }}
                      >
                        {teamCode}
                      </Button>
                    );
                  })}
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Input
                    value={teamCodeDraft}
                    onChange={onTeamCodeDraftChange}
                    placeholder={lang === "de" ? "Team hinzufugen (z. B. U20)" : "Add team (e.g. U20)"}
                    style={{ maxWidth: 260 }}
                  />
                  <Button
                    variant="outline"
                    onClick={onAddTeamCodeFromDraft}
                    disabled={!teamCodeDraft.trim() || !selectedPlayerId}
                    style={{ padding: "8px 10px" }}
                  >
                    + Team
                  </Button>
                </div>

                <div style={{ marginTop: 8, color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
                  {t("defaultTeamsHint")}
                </div>
              </div>

              <div
                style={{
                  border: `1px solid var(--ui-border)`,
                  borderRadius: 14,
                  background: "var(--ui-card)",
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 8 }}>{t("jerseyNumbersByTeam")}</div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 1fr",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  {allTeamOptions.map((teamCode) => {
                    const current = selectedPlayer.jerseyByTeam ?? {};
                    const value = current[teamCode];

                    return (
                      <div key={teamCode} style={{ display: "contents" }}>
                        <div style={{ fontWeight: 900 }}>{teamCode}</div>
                        <Input
                          type="number"
                          value={value === null || value === undefined ? "" : String(value)}
                          onChange={(v) => {
                            const next = { ...(selectedPlayer.jerseyByTeam ?? {}) } as Record<string, number | null>;
                            const trimmed = (v ?? "").trim();
                            next[teamCode] = trimmed ? parseInt(trimmed, 10) : null;
                            updatePlayer(selectedPlayer.id, { jerseyByTeam: next });
                          }}
                          placeholder={t("jerseyExample")}
                        />
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 8, color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
                  {t("jerseyHint")}
                </div>
              </div>

              <div
                style={{
                  border: `1px solid var(--ui-border)`,
                  borderRadius: 14,
                  background: "var(--ui-card)",
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 10,
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{t("historyLast6")}</div>

                  <Button
                    variant="outline"
                    onClick={() => {
                      const cur = (selectedPlayer.historyLast6 ?? []).slice(0, 6);
                      if (cur.length >= 6) return;
                      cur.push({ date: "", opponent: "", note: "" });
                      updatePlayer(selectedPlayer.id, { historyLast6: cur });
                    }}
                    style={{ padding: "8px 10px" }}
                  >
                    + {t("entry")}
                  </Button>
                </div>

                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {(selectedPlayer.historyLast6 ?? []).slice(0, 6).map((h, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "140px 1fr 120px",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <Input
                        type="date"
                        value={h.date ?? ""}
                        onChange={(v) => {
                          const cur = (selectedPlayer.historyLast6 ?? []).slice(0, 6);
                          cur[idx] = { ...cur[idx], date: v };
                          updatePlayer(selectedPlayer.id, { historyLast6: cur });
                        }}
                      />

                      <Input
                        value={h.opponent ?? ""}
                        onChange={(v) => {
                          const cur = (selectedPlayer.historyLast6 ?? []).slice(0, 6);
                          cur[idx] = { ...cur[idx], opponent: v };
                          updatePlayer(selectedPlayer.id, { historyLast6: cur });
                        }}
                        placeholder={t("opponentExample")}
                      />

                      <Button
                        variant="outline"
                        onClick={() => {
                          const cur = (selectedPlayer.historyLast6 ?? []).slice(0, 6);
                          cur.splice(idx, 1);
                          updatePlayer(selectedPlayer.id, { historyLast6: cur });
                        }}
                        style={{ padding: "8px 10px", borderColor: "#ef4444", color: "#ef4444" }}
                      >
                        {t("delete").toLowerCase()}
                      </Button>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 8, color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
                  {t("historyLast6Hint")}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}


