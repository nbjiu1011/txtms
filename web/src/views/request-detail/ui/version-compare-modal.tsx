"use client";

import { useState } from "react";
import { cn, formatDateTime } from "@/shared/lib";
import { Empty, Field, Modal, ReadOnlyBox, Select } from "@/shared/ui";
import { textFields, useContentVersion, type Content, type ContentType } from "@/entities/request";
import type { UserDirectory } from "@/entities/user";
import styles from "./tabs.module.css";

export interface VersionCompareModalProps {
  open: boolean;
  onClose: () => void;
  requestId: string;
  type: ContentType;
  content: Content;
  users: UserDirectory;
}

/** `{key} 버전 비교` — two versions side by side per text field (reference `verCmp`). */
export function VersionCompareModal(props: VersionCompareModalProps) {
  if (!props.open) return null;
  return <VersionCompareBody {...props} />;
}

function VersionCompareBody({ open, onClose, requestId, type, content, users }: VersionCompareModalProps) {
  const versions = content.versions;
  const [a, setA] = useState(versions[versions.length - 2]?.version ?? content.version);
  const [b, setB] = useState(content.version);
  const va = useContentVersion(requestId, content.key, a);
  const vb = useContentVersion(requestId, content.key, b);
  const options = versions.map((v) => ({
    value: v.version,
    label: `v${v.version}  ${users.name(v.createdBy)}  ${formatDateTime(v.createdAt)}`,
  }));

  const body = () => {
    if (va.isPending || vb.isPending) return <Empty plain title="버전을 불러오는 중입니다" />;
    if (va.isError || vb.isError) return <Empty plain title="버전을 불러오지 못했습니다" />;
    const before = textFields(type, va.data.payload);
    const after = textFields(type, vb.data.payload);
    const filesA = va.data.files.map((f) => `${f.name} v${f.version}`).join(", ");
    const filesB = vb.data.files.map((f) => `${f.name} v${f.version}`).join(", ");
    return (
      <>
        {after.map(([key, text]) => {
          const old = before.find(([k]) => k === key)?.[1] ?? "";
          const changed = old !== text;
          return (
            <div key={key} className={styles.cmp}>
              <div className={styles.faintSmall}>
                {key}
                {changed ? (
                  <>
                    {" "}
                    <b className={styles.changed}>변경</b>
                  </>
                ) : null}
              </div>
              <div className={styles.grid2}>
                <ReadOnlyBox className={styles.cmpBox}>{old || "-"}</ReadOnlyBox>
                <ReadOnlyBox className={cn(styles.cmpBox, changed && styles.on)}>{text || "-"}</ReadOnlyBox>
              </div>
            </div>
          );
        })}
        {filesA || filesB ? (
          <p className={styles.small}>
            파일: {filesA} → {filesB}
          </p>
        ) : null}
      </>
    );
  };

  return (
    <Modal open={open} size="lg" title={`${content.key} 버전 비교`} onClose={onClose}>
      <div className={styles.grid2}>
        <Field label="이전" htmlFor="cmp-a">
          <Select id="cmp-a" value={a} onChange={(e) => setA(Number(e.target.value))}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="이후" htmlFor="cmp-b">
          <Select id="cmp-b" value={b} onChange={(e) => setB(Number(e.target.value))}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {body()}
    </Modal>
  );
}
