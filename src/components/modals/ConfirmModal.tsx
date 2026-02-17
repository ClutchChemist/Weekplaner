import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

type Props = {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({ open, title, message, onConfirm, onCancel }: Props) {
  if (!open) return null;

  return (
    <Modal title={title} onClose={onCancel}>
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ color: "var(--ui-text)", fontWeight: 800, lineHeight: 1.4 }}>{message}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Button variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Bestätigen
          </Button>
        </div>
      </div>
    </Modal>
  );
}
