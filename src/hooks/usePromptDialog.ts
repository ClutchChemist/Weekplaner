import { useRef, useState, type SetStateAction } from "react";

export type PromptDialogState = {
  open: boolean;
  title: string;
  message: string;
  value: string;
  placeholder?: string;
};

export function usePromptDialog() {
  const [promptDialog, setPromptDialog] = useState<PromptDialogState>({
    open: false,
    title: "",
    message: "",
    value: "",
    placeholder: "",
  });
  const promptResolverRef = useRef<((value: string | null) => void) | null>(null);

  function askPrompt(title: string, message: string, initialValue = "", placeholder = "") {
    return new Promise<string | null>((resolve) => {
      promptResolverRef.current = resolve;
      setPromptDialog({
        open: true,
        title,
        message,
        value: initialValue,
        placeholder,
      });
    });
  }

  function resolvePrompt(value: string | null) {
    setPromptDialog((prev) => ({ ...prev, open: false }));
    const resolver = promptResolverRef.current;
    promptResolverRef.current = null;
    resolver?.(value);
  }

  function setPromptValue(value: SetStateAction<string>) {
    setPromptDialog((prev) => ({
      ...prev,
      value: typeof value === "function" ? (value as (p: string) => string)(prev.value) : value,
    }));
  }

  return { promptDialog, setPromptDialog, setPromptValue, askPrompt, resolvePrompt };
}
