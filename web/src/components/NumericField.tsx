import { useEffect, useState, type JSX } from "react";

interface NumericFieldProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

export function NumericField({
  label,
  value,
  onCommit,
  step = 0.1,
  min,
  max
}: NumericFieldProps): JSX.Element {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number.parseFloat(draft);
    if (Number.isFinite(parsed)) {
      onCommit(parsed);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <label className="field">
      <span>{label}</span>
      <input
        aria-label={label}
        type="number"
        step={step}
        min={min}
        max={max}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
