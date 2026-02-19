import type { Coach } from "@/types";
import { usePersistedState } from "./usePersistedState";
import { DEFAULT_STAFF, safeParseStaff } from "@/state/staffPersistence";
import { STAFF_STORAGE_KEY } from "@/state/storageKeys";
import { downloadJson } from "@/utils/json";
import { randomId } from "@/utils/id";

export function useCoaches(
  t: (k: string) => string,
  setLastDropError: (err: string | null) => void
) {
  const [coaches, setCoaches] = usePersistedState<Coach[]>(
    STAFF_STORAGE_KEY,
    DEFAULT_STAFF,
    (savedRaw) => safeParseStaff(savedRaw) ?? DEFAULT_STAFF
  );

  async function importStaffFile(file: File) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const list = Array.isArray(json) ? json : json?.coaches;
      if (!Array.isArray(list)) return;
      const normalized: Coach[] = list
        .map((rawCoach) => {
          const c =
            rawCoach && typeof rawCoach === "object"
              ? (rawCoach as Record<string, unknown>)
              : {};
          return {
            id: String(c.id ?? randomId("c_")),
            name: String(c.name ?? ""),
            role: String(c.role ?? "Coach"),
            license: c.license !== undefined ? String(c.license ?? "") : "",
          };
        })
        .filter((c: Coach) => c.id && c.name);
      if (normalized.length) {
        setCoaches(normalized);
        setLastDropError(null);
      } else {
        setLastDropError(t("importJsonError"));
      }
    } catch (err) {
      console.warn("Staff import failed", err);
      setLastDropError(t("importJsonError"));
    }
  }

  function exportStaff() {
    downloadJson("staff.json", coaches);
  }

  function addCoach() {
    const id = randomId("c_");
    setCoaches((prev) => [
      ...prev,
      { id, name: "Name", role: "Coach", license: "" },
    ]);
  }

  function updateCoach(id: string, patch: Partial<Coach>) {
    setCoaches((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  }

  function deleteCoach(id: string) {
    setCoaches((prev) => prev.filter((c) => c.id !== id));
  }

  return {
    coaches,
    setCoaches,
    addCoach,
    updateCoach,
    deleteCoach,
    exportStaff,
    importStaffFile,
  };
}
