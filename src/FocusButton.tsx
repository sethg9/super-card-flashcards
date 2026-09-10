import { Maximize2, Minimize2 } from 'lucide-react';
export default function FocusButton({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  const label = active ? 'Exit focus view' : 'Enter focus view';
  return (
    <button
      className="icon-button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onToggle}
    >
      {active ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
    </button>
  );
}
