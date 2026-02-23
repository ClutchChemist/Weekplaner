import { useEffect, type SetStateAction } from "react";
import type { RightLayout, RightModule } from "@/types";

type Setter<T> = (value: SetStateAction<T>) => void;

type UseRightSidebarPersistenceArgs = {
  rightOpen: boolean;
  rightLayout: RightLayout;
  rightTop: RightModule;
  rightBottom: RightModule;
  rightSplitPct: number;
  setRightOpen: Setter<boolean>;
  setRightLayout: Setter<RightLayout>;
  setRightTop: Setter<RightModule>;
  setRightBottom: Setter<RightModule>;
  setRightSplitPct: Setter<number>;
  storageKey?: string;
};

export function useRightSidebarPersistence({
  rightOpen,
  rightLayout,
  rightTop,
  rightBottom,
  rightSplitPct,
  setRightOpen,
  setRightLayout,
  setRightTop,
  setRightBottom,
  setRightSplitPct,
  storageKey = "right_sidebar_v1",
}: UseRightSidebarPersistenceArgs) {
  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;

    try {
      const s = JSON.parse(raw) as {
        rightOpen?: unknown;
        rightLayout?: unknown;
        rightTop?: unknown;
        rightBottom?: unknown;
        rightSplitPct?: unknown;
      };

      if (typeof s.rightOpen === "boolean") setRightOpen(s.rightOpen);
      if (s.rightLayout === "single" || s.rightLayout === "split") setRightLayout(s.rightLayout);
      if (s.rightTop === "calendar" || s.rightTop === "preview" || s.rightTop === "maps" || s.rightTop === "none") {
        setRightTop(s.rightTop);
      }
      if (s.rightBottom === "calendar" || s.rightBottom === "preview" || s.rightBottom === "maps" || s.rightBottom === "none") {
        setRightBottom(s.rightBottom);
      }
      if (typeof s.rightSplitPct === "number") {
        setRightSplitPct(Math.max(0.2, Math.min(0.8, s.rightSplitPct)));
      }
    } catch {
      // ignore malformed persisted state
    }
  }, [storageKey, setRightBottom, setRightLayout, setRightOpen, setRightSplitPct, setRightTop]);

  useEffect(() => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ rightOpen, rightLayout, rightTop, rightBottom, rightSplitPct })
    );
  }, [storageKey, rightOpen, rightLayout, rightTop, rightBottom, rightSplitPct]);
}
