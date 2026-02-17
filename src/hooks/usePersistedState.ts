import { useEffect, useState } from "react";

export function usePersistedState<T>(
  storageKey: string,
  fallbackValue: T,
  revive: (raw: string) => T | null
) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return fallbackValue;
    const savedRaw = localStorage.getItem(storageKey);
    if (!savedRaw) return fallbackValue;

    try {
      return revive(savedRaw) ?? fallbackValue;
    } catch {
      return fallbackValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [storageKey, state]);

  return [state, setState] as const;
}
