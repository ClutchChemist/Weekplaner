import { Button, Input, Modal } from "@/components/ui";

type Props = {
  open: boolean;
  title: string;
  message: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  onConfirm: () => void;
  onCancel: () => void;
  t: (key: string) => string;
};

export function PromptModal({
  open,
  title,
  message,
  value,
  onValueChange,
  placeholder,
  onConfirm,
  onCancel,
  t,
}: Props) {
  if (!open) return null;

  return (
    <Modal title={title} onClose={onCancel} closeLabel={t("close")}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ color: "var(--ui-text)", fontWeight: 800 }}>{message}</div>
        <Input value={value} onChange={onValueChange} placeholder={placeholder} />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Button variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button onClick={onConfirm}>{t("confirm")}</Button>
        </div>
      </div>
    </Modal>
  );
}
