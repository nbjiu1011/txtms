"use client";

import { kstDateKey } from "@/shared/lib";
import { Modal } from "@/shared/ui";
import { exportBundle, type BundleExportKind } from "../model/export-bundle";

export interface BundleExportDialogProps {
  /** Open confirmation, or null. */
  kind: BundleExportKind | null;
  requestId: string;
  requestTitle: string;
  itemCount: number;
  completedAt: string;
  onClose: () => void;
}

/** Export confirmations of the 완료 결과 tab (reference `exportX` / `exportF`). */
export function BundleExportDialog({ kind, requestId, requestTitle, itemCount, completedAt, onClose }: BundleExportDialogProps) {
  const run = async (k: BundleExportKind) => ((await exportBundle(requestId, k)) ? undefined : false);
  return (
    <>
      <Modal
        open={kind === "xlsx"}
        title="요청 전체 XLSX 반출"
        okLabel="파일 받기"
        onClose={onClose}
        onOk={() => run("xlsx")}
      >
        <p>
          {requestTitle} · 콘텐츠 {itemCount}건 · {kstDateKey(completedAt)} (KST)
        </p>
      </Modal>
      <Modal open={kind === "zip"} title="첨부 최종본 ZIP" okLabel="묶음 받기" onClose={onClose} onOk={() => run("zip")}>
        <p>최종 파일과 완료 버전 명세를 함께 다운로드합니다.</p>
      </Modal>
    </>
  );
}
