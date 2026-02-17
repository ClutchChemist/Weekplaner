import type { ReactNode } from "react";
import { Modal } from "../ui/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  closeLabel?: string;
};

export function EventEditorModal({ open, onClose, title, children, closeLabel }: Props) {
  if (!open) return null;
  return (
    <Modal title={title} onClose={onClose} closeLabel={closeLabel}>
      {children}
    </Modal>
  );
}
