import type { Coach } from "./types";
import { randomId } from "../utils/id";

export const DEFAULT_STAFF: Coach[] = [
  { id: "c_andrej", name: "Andrej König", role: "Headcoach", license: "B-23273" },
  { id: "c_edgars", name: "Edgars Ikstens", role: "Coach", license: "" },
  { id: "c_mardin", name: "Mardin Ahmedin", role: "Coach", license: "" },
];

export function safeParseStaff(raw: string | null): Coach[] | null {
  if (!raw) return null;
  try {
    const x = JSON.parse(raw);
    if (!Array.isArray(x)) return null;
    const list = x
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
    return list.length ? list : null;
  } catch {
    return null;
  }
}
