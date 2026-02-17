import type { ReactNode } from "react";
import { Modal } from "../ui/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function EventEditorModal({ open, onClose, title, children }: Props) {
  if (!open) return null;
  return (
    <Modal title={title} onClose={onClose}>
      {children}
    </Modal>
  );
}
