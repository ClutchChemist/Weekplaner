import { I18N } from "./dict";
import type { Lang } from "./types";

export function makeT(locale: Lang) {
  return (key: string) => I18N[locale]?.[key] ?? key;
}

export function makeTF(locale: Lang) {
  return (key: string, vars: Record<string, string | number> = {}) => {
    const tpl = I18N[locale]?.[key] ?? key;
    return tpl.replace(/{(\w+)}/g, (_, k) => String(vars[k] ?? `{${k}}`));
  };
}
