import { Input } from "./Input";

export function MinutePicker({
    value,
    onChange,
    presets,
    allowZero = true,
    placeholder = "Minuten",
}: {
    value: number;
    onChange: (v: number) => void;
    presets: number[];
    allowZero?: boolean;
    placeholder?: string;
}) {
    const items = allowZero ? [0, ...presets] : presets;

    return (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {items.map((m) => {
                const active = value === m;
                return (
                    <button
                        key={m}
                        type="button"
                        onClick={() => onChange(m)}
                        style={{
                            padding: "6px 10px",
                            borderRadius: 999,
                            border: `1px solid ${active ? "var(--ui-accent)" : "var(--ui-border)"}`,
                            background: active ? "rgba(59,130,246,.18)" : "transparent",
                            color: "var(--ui-text)",
                            fontWeight: 900,
                            cursor: "pointer",
                        }}
                    >
                        {m}
                    </button>
                );
            })}

            <Input
                type="number"
                value={String(value)}
                onChange={(v) => onChange(Math.max(allowZero ? 0 : 1, Math.floor(Number(v || "0"))))}
                placeholder={placeholder}
                style={{ maxWidth: 80 }}
            />
        </div>
    );
}
