import { segmentVariables } from "../model/payload";
import styles from "./content-mockup.module.css";

export interface VariableTextProps {
  text: string;
  /** Known variable values; unknown `#{key}` tokens render as chips. */
  values?: ReadonlyMap<string, string>;
}

/** Text with `#{key}` variable tokens shown as `.var` chips (reference `renderVars`). */
export function VariableText({ text, values }: VariableTextProps) {
  return (
    <>
      {segmentVariables(text, values).map((s, i) =>
        s.kind === "text" ? (
          <span key={i}>{s.text}</span>
        ) : (
          <span key={i} className={styles.var}>
            {s.key}
          </span>
        ),
      )}
    </>
  );
}
