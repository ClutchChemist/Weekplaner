import { useRef, useCallback } from "react";
import type { WeekPlan } from "@/types";

export function usePlanHistory(plan: WeekPlan, setPlan: (p: WeekPlan) => void) {
  const history = useRef<WeekPlan[]>([]);
  const future = useRef<WeekPlan[]>([]);

  const push = useCallback((next: WeekPlan) => {
    history.current.push(plan);
    future.current = [];
    setPlan(next);
  }, [plan, setPlan]);

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (prev) {
      future.current.push(plan);
      setPlan(prev);
    }
  }, [plan, setPlan]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next) {
      history.current.push(plan);
      setPlan(next);
    }
  }, [plan, setPlan]);

  return { push, undo, redo, canUndo: history.current.length > 0, canRedo: future.current.length > 0 };
}
