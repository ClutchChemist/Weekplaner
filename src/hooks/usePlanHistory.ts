import { useRef, useCallback, useState } from "react";
import type { WeekPlan } from "@/types";

export function usePlanHistory(plan: WeekPlan, setPlan: (p: WeekPlan) => void) {
  const history = useRef<WeekPlan[]>([]);
  const future = useRef<WeekPlan[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncFlags = useCallback(() => {
    setCanUndo(history.current.length > 0);
    setCanRedo(future.current.length > 0);
  }, []);

  const push = useCallback((next: WeekPlan) => {
    history.current.push(plan);
    future.current = [];
    setPlan(next);
    syncFlags();
  }, [plan, setPlan, syncFlags]);

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (prev) {
      future.current.push(plan);
      setPlan(prev);
    }
    syncFlags();
  }, [plan, setPlan, syncFlags]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next) {
      history.current.push(plan);
      setPlan(next);
    }
    syncFlags();
  }, [plan, setPlan, syncFlags]);

  return { push, undo, redo, canUndo, canRedo };
}
