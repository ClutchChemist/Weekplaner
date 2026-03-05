import type { Lang } from "@/i18n/types";
import { Button, Input, Modal } from "@/components/ui";

type BaseArchiveEntry = {
  id: string;
  label: string;
  savedAt: string;
};

type Props<TEntry extends BaseArchiveEntry> = {
  open: boolean;
  onClose: () => void;
  t: (key: string) => string;
  lang: Lang;
  activeProfileName: string | null;
  activeProfileId: string | null;
  sessionCount: number;
  archiveTemplateStart: string;
  onArchiveTemplateStartChange: (value: string) => void;
  activeArchiveEntries: TEntry[];
  onSaveCurrentWeekToArchive: () => void;
  onLoadArchiveEntry: (entry: TEntry) => void;
  onUseArchiveAsTemplate: (entry: TEntry) => void;
  onDeleteArchiveEntry: (entry: TEntry) => void;
};

export function WeekArchiveModal<TEntry extends BaseArchiveEntry>({
  open,
  onClose,
  t,
  lang,
  activeProfileName,
  activeProfileId,
  sessionCount,
  archiveTemplateStart,
  onArchiveTemplateStartChange,
  activeArchiveEntries,
  onSaveCurrentWeekToArchive,
  onLoadArchiveEntry,
  onUseArchiveAsTemplate,
  onDeleteArchiveEntry,
}: Props<TEntry>) {
  if (!open) return null;

  return (
    <Modal title={t("weekArchiveTitle")} onClose={onClose} closeLabel={t("close")}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
            {activeProfileName ? `${t("cloudProfileCurrent")}: ${activeProfileName}` : t("profileNone")}
          </div>
          <Button
            variant="outline"
            onClick={onSaveCurrentWeekToArchive}
            disabled={!activeProfileId || sessionCount === 0}
          >
            {t("weekArchiveSaveCurrent")}
          </Button>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 900 }}>{t("weekArchiveTemplateDate")}</div>
          <Input type="date" value={archiveTemplateStart} onChange={onArchiveTemplateStartChange} />
        </div>

        {activeArchiveEntries.length === 0 ? (
          <div style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
            {t("weekArchiveEmpty")}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8, maxHeight: "55vh", overflow: "auto" }}>
            {activeArchiveEntries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  border: "1px solid var(--ui-border)",
                  borderRadius: 12,
                  background: "var(--ui-card)",
                  padding: 10,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 900 }}>{entry.label}</div>
                <div style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
                  {new Date(entry.savedAt).toLocaleString(lang === "de" ? "de-DE" : "en-GB")}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <Button variant="outline" onClick={() => onLoadArchiveEntry(entry)}>
                    {t("weekArchiveLoadDraft")}
                  </Button>
                  <Button variant="outline" onClick={() => onUseArchiveAsTemplate(entry)}>
                    {t("weekArchiveUseTemplate")}
                  </Button>
                  <Button variant="danger" onClick={() => onDeleteArchiveEntry(entry)}>
                    {t("delete")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

