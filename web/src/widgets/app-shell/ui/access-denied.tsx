import { Button, Icon, Page } from "@/shared/ui";
import styles from "./app-shell.module.css";

export interface AccessDeniedProps {
  title: string;
  description: string;
  /** Hide the policy note (used for screens that are not available yet). */
  hideNote?: boolean;
  onGoHome: () => void;
}

export const ACCESS_POLICY_NOTE = "직접 주소와 화면 작업에는 같은 권한 조건을 적용합니다.";

/** Shown in a tab whose route the user cannot open in the current context. */
export function AccessDenied({ title, description, hideNote, onGoHome }: AccessDeniedProps) {
  return (
    <Page>
      <div className={styles.denied}>
        <div className={styles.deniedIcon} aria-hidden="true">
          <Icon name="x" />
        </div>
        <h1>{title}</h1>
        <p className={styles.desc}>{description}</p>
        {hideNote ? null : <p className={styles.note}>{ACCESS_POLICY_NOTE}</p>}
        <Button onClick={onGoHome}>대시보드로 이동</Button>
      </div>
    </Page>
  );
}
