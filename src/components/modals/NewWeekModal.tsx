import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { addDaysISO, dateToDDMMYYYY_DOTS, isoWeekMonday } from "../../utils/date";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";

export type NewWeekMode = "MASTER" | "EMPTY" | "COPY_CURRENT";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (mode: NewWeekMode, keepParticipants: boolean, weekStartMondayISO: string) => void;
  defaultMode?: NewWeekMode;
  t: (key: string) => string;
};

export function NewWeekModal({
  open,
  onClose,
  onCreate,
  defaultMode = "MASTER",
  t,
}: Props) {
  const [mode, setMode] = useState<NewWeekMode>(defaultMode);
  const [keepParticipants, setKeepParticipants] = useState<boolean>(false);
  type WeekPick = "THIS" | "NEXT" | "CUSTOM";

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [weekPick, setWeekPick] = useState<WeekPick>("THIS");
  const [customStart, setCustomStart] = useState<string>(isoWeekMonday(todayISO));

  useEffect(() => {
    if (mode !== "COPY_CURRENT" && keepParticipants) {
      setKeepParticipants(false);
    }
  }, [mode, keepParticipants]);

  useEffect(() => {
    if (open) {
      setMode(defaultMode);
    }
  }, [defaultMode, open]);

  const weekStartMondayISO = useMemo(() => {
    const base = isoWeekMonday(todayISO);
    if (weekPick === "THIS") return base;
    if (weekPick === "NEXT") return addDaysISO(base, 7);
    return isoWeekMonday(customStart || todayISO);
  }, [weekPick, customStart, todayISO]);

  const weekEndISO = useMemo(() => addDaysISO(weekStartMondayISO, 6), [weekStartMondayISO]);

  const weekRangeLabel = `${dateToDDMMYYYY_DOTS(weekStartMondayISO)} – ${dateToDDMMYYYY_DOTS(weekEndISO)}`;

  const optionBtnBase: CSSProperties = {
    height: 44,
    width: "100%",
    borderRadius: 12,
    padding: "0 16px",
    fontSize: 14,
    fontWeight: 700,
    transition: "all 0.18s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  function optionBtnStyle(active: boolean, disabledLike = false): CSSProperties {
    return {
      ...optionBtnBase,
      border: active ? "1px solid transparent" : "1px solid var(--border)",
      background: active ? "var(--primary)" : "var(--panel2)",
      color: active ? "var(--primaryText)" : "var(--text)",
      cursor: disabledLike ? "not-allowed" : "pointer",
      opacity: disabledLike ? 0.55 : 1,
    };
  }

  const participantToggleDisabled = mode !== "COPY_CURRENT";

  if (!open) return null;

  return (
    <Modal title="Neue Woche planen" onClose={onClose}>
      <div className="grid grid-cols-1 gap-8">
        <section className="rounded-xl border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--panel)" }}>
          <div className="mb-4">
            <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>Start-Optionen</div>
            <div className="text-sm" style={{ color: "var(--muted)", marginTop: 6 }}>
              Wähle, wie die neue Woche erstellt wird. Details siehst du per Hover auf den Buttons.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode("MASTER")}
              style={optionBtnStyle(mode === "MASTER")}
              title="Standard-Struktur (Events/Slots) – ohne Teilnehmer"
            >
              Wochenplan_master verwenden
            </button>

            <button
              type="button"
              onClick={() => setMode("EMPTY")}
              style={optionBtnStyle(mode === "EMPTY")}
              title="Keine Sessions – du baust alles neu"
            >
              Leere Woche starten
            </button>

            <button
              type="button"
              onClick={() => setMode("COPY_CURRENT")}
              className="md:col-span-2"
              style={optionBtnStyle(mode === "COPY_CURRENT")}
              title="Kopiert Sessions aus deiner zuletzt bearbeiteten Woche"
            >
              Aktuelle Woche übernehmen
            </button>

            <button
              type="button"
              aria-disabled={participantToggleDisabled}
              onClick={() => {
                if (!participantToggleDisabled) {
                  setKeepParticipants((v) => !v);
                }
              }}
              style={optionBtnStyle(keepParticipants, participantToggleDisabled)}
              title={
                participantToggleDisabled
                  ? "Nur verfügbar bei: Aktuelle Woche übernehmen"
                  : "Übernimmt Teilnehmer aus der zuletzt bearbeiteten Woche"
              }
            >
              Teilnehmer übernehmen
            </button>
          </div>
        </section>

        <section className="rounded-xl border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--panel)" }}>
          <div className="mb-4">
            <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>Woche / Zeitraum</div>
            <div className="text-sm" style={{ color: "var(--muted)", marginTop: 6 }}>
              Ausgewählter Zeitraum: {weekRangeLabel}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button type="button" onClick={() => setWeekPick("THIS")} style={optionBtnStyle(weekPick === "THIS")} title="Setzt den Zeitraum auf die aktuelle Kalenderwoche">
              Diese Woche
            </button>

            <button type="button" onClick={() => setWeekPick("NEXT")} style={optionBtnStyle(weekPick === "NEXT")} title="Setzt den Zeitraum auf die nächste Kalenderwoche">
              {t("nextWeek")}
            </button>

            <button type="button" onClick={() => setWeekPick("CUSTOM")} style={optionBtnStyle(weekPick === "CUSTOM")} title={`Freie Wahl des Startdatums (aktuell: ${weekRangeLabel})`}>
              Custom
            </button>
          </div>

          {weekPick === "CUSTOM" && (
            <div className="mt-4 rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--panel2)" }}>
              <div className="font-semibold" style={{ color: "var(--text)" }}>Startdatum</div>
              <Input type="date" value={customStart} onChange={setCustomStart} />
            </div>
          )}
        </section>

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={onClose} style={{ height: 44, padding: "0 16px" }}>
            {t("cancel")}
          </Button>
          <Button onClick={() => onCreate(mode, keepParticipants, weekStartMondayISO)} style={{ height: 44, padding: "0 16px" }}>
            {t("create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
