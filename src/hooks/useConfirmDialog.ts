import { useRef, type SetStateAction } from "react";
import type { ConfirmDialogState } from "../state/types";

export function useConfirmDialog(
  setConfirmDialog: (value: SetStateAction<ConfirmDialogState>) => void
) {
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

  function askConfirm(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmDialog({ open: true, title, message });
    });
  }

  function resolveConfirm(value: boolean) {
    setConfirmDialog((prev) => ({ ...prev, open: false }));
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    resolver?.(value);
  }

  return { askConfirm, resolveConfirm };
}
