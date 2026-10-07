"use client";

import { useState } from "react";
import { isApiError } from "@/shared/api";
import { Avatar, Banner, Checkbox, ListItem, Modal, Panel, Tag, toast } from "@/shared/ui";
import { requestApi, type RequestDetail } from "@/entities/request";
import type { UserDirectory } from "@/entities/user";
import { coReviewerOpinions, coReviewerRole } from "../model/complete-check";
import { handleWorkflowError, modalResult } from "../model/workflow-error";
import styles from "./workflow.module.css";

const FINAL_INVALID = "최종 콘텐츠의 필수값과 연결값을 확인하세요";

export interface CompleteDialogProps {
  open: boolean;
  onClose: () => void;
  request: RequestDetail;
  meId: number;
  approvalEnabled: boolean;
  users: UserDirectory;
  rowVersion: () => number;
  onDone: (detail: RequestDetail) => void;
  onStale: () => void;
}

/**
 * 검수 완료 (primary reviewer): 공동 검수 결과 (current reviewers, then earlier opinion authors),
 * 대상 버전, a required confirmation, then `POST complete`. A final-content validation failure
 * lists the server's details.
 */
export function CompleteDialog(props: CompleteDialogProps) {
  const [invalid, setInvalid] = useState<string[] | null>(null);
  return (
    <>
      {props.open ? <CompleteBody {...props} onInvalid={setInvalid} /> : null}
      <Modal open={invalid !== null} onClose={() => setInvalid(null)} title={FINAL_INVALID} okLabel="확인" onOk={() => undefined}>
        <ul className={styles.missing}>
          {invalid?.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

function CompleteBody(props: CompleteDialogProps & { onInvalid: (items: string[]) => void }) {
  const { onClose, request: r, meId, approvalEnabled, users, rowVersion, onDone, onStale, onInvalid } = props;
  const [confirmed, setConfirmed] = useState(false);
  const approvers = r.eligibleApproverIds.map((id) => users.name(id)).join(", ");
  const locked = r.contents.filter((c) => c.lock && c.lock.userId !== meId);

  const submit = async () => {
    try {
      const detail = await requestApi.complete(r.id, rowVersion());
      toast(approvalEnabled ? "승인 대기로 넘겼습니다" : "검수를 완료했습니다");
      onDone(detail);
      return undefined;
    } catch (error) {
      if (isApiError(error) && error.code === "VALIDATION_FAILED" && error.details.length > 0) {
        onInvalid(error.details);
        return undefined;
      }
      return modalResult(handleWorkflowError(error, onStale));
    }
  };

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="검수를 완료할까요?"
      description={
        approvalEnabled
          ? `완료하면 승인 대기로 바뀌고 ${approvers}에게 알립니다.`
          : "승인 단계를 쓰지 않는 고객사라 검수 완료가 최종 완료입니다."
      }
      okLabel={approvalEnabled ? "검수 완료하고 승인 요청" : "검수 완료"}
      okVariant="ok"
      okDisabled={!confirmed}
      onOk={submit}
    >
      <div className={styles.lbl}>공동 검수 결과</div>
      <Panel className={styles.listPanel} aria-label="공동 검수 결과">
        {r.coReviewers.map((c) => {
          const user = users.get(c.userId);
          const role = coReviewerRole(c);
          return (
            <ListItem
              key={c.userId}
              leading={<Avatar name={users.name(c.userId)} color={user?.avatarColor} size={22} />}
              title={`${users.name(c.userId)}${role ? ` ${role}` : ""}`}
              meta={coReviewerOpinions(c)}
            />
          );
        })}
      </Panel>
      <div className={styles.lbl}>대상 버전</div>
      <Panel className={styles.listPanel} aria-label="대상 버전">
        {r.contents.map((c) => (
          <ListItem
            key={c.key}
            leading={<Tag variant="fill">{c.key}</Tag>}
            title={c.title}
            trailing={
              <span className={styles.versions}>
                v{c.version}
                {c.files.map((f) => ` ${f.name} v${f.version}`).join("")}
              </span>
            }
          />
        ))}
      </Panel>
      {locked.length ? (
        <Banner tone="danger" className={styles.lockWarn}>
          {locked.map((c) => `${c.key} ${users.name(c.lock?.userId)}님 편집 중`).join(", ")}. 완료하면 저장되지 않은 편집은
          반영되지 않습니다.
        </Banner>
      ) : null}
      <Checkbox
        label="공동 검수 결과와 대상 버전을 확인했습니다"
        checked={confirmed}
        onChange={(e) => setConfirmed(e.target.checked)}
      />
    </Modal>
  );
}
