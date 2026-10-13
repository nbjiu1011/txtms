"use client";

import { Banner, Panel, PanelBody } from "@/shared/ui";
import { Modal, Select } from "@/shared/common";
import type { ScanOutcome, DraftEditing } from "../model/use-draft-editing";
import type { RevisionEditing } from "../model/use-revision-editing";
import styles from "./tabs.module.css";

/** Danger banner while the last autosave failed (reference `storeError` banner above the header). */
export function SaveFailureBanner({ editing }: { editing: DraftEditing | null }) {
  if (!editing?.saveError || editing.session.saveState.status !== "fail") return null;
  return (
    <Banner tone="danger" role="alert" className={styles.saveBanner}>
      {editing.saveError}
    </Banner>
  );
}

/** A newer save from another tab or window blocked this autosave. */
export function SaveConflictModal({ editing }: { editing: DraftEditing | null }) {
  const conflict = editing?.conflict;
  return (
    <Modal
      open={conflict !== undefined}
      onClose={() => editing?.resolveConflict(false)}
      title="다른 곳에서 먼저 저장했습니다"
      description={`${conflict ? `${conflict} 콘텐츠` : "이 요청"}를 연 뒤 다른 탭이나 창에서 더 최신 내용이 저장되었습니다. 덮어쓰지 않도록 저장을 막았습니다.`}
      okLabel="최신 내용 불러오기"
      cancelLabel="계속 편집"
      onOk={() => editing?.resolveConflict(true)}
    >
      <p className={styles.modalNote}>최신 내용을 불러온 뒤 수정 내용을 다시 반영하세요.</p>
    </Modal>
  );
}

/** 수정본 저장 blocked by a newer version (reference `saveRev` conflict modal). */
export function RevisionConflictModal({ revision }: { revision: RevisionEditing }) {
  const conflict = revision.conflict;
  return (
    <Modal
      open={conflict !== null}
      onClose={() => revision.resolveConflict(false)}
      title="다른 사용자가 먼저 저장했습니다"
      description={conflict?.message}
      okLabel="최신 버전 불러오기"
      onOk={() => revision.resolveConflict(true)}
    >
      <p className={styles.modalNoteMuted}>최신 버전을 불러온 뒤 수정 내용을 다시 반영하세요.</p>
    </Modal>
  );
}

const SCAN_OPTIONS: { value: ScanOutcome; label: string }[] = [
  { value: "SAFE", label: "정상" },
  { value: "FAILED", label: "검사 실패" },
  { value: "UNSAFE", label: "위험 파일" },
];

/**
 * Demo accounts only: picks the result of the attachment scan stub so the blocked flows can be
 * tried before a real antivirus is connected (sent as a request header the server honours only in
 * demo mode).
 */
export function ScanDemoPanel({ editing }: { editing: DraftEditing }) {
  return (
    <Panel className={styles.demoPanel} aria-label="첨부 검사 결과 선택">
      <PanelBody>
        <b>첨부 검사 결과 선택 (체험 계정)</b>
        <p className={styles.demoNote}>
          백신 검사 연동 전까지 체험 계정에서만 쓰는 설정입니다. 업로드할 파일의 검사 결과를 골라 등록 차단 흐름을
          확인합니다.
        </p>
        <Select
          aria-label="첨부 검사 결과"
          value={editing.scanOutcome}
          onChange={(e) => editing.setScanOutcome(e.target.value as ScanOutcome)}
          className={styles.demoSelect}
        >
          {SCAN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </PanelBody>
    </Panel>
  );
}
