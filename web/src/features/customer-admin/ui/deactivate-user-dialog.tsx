"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorDetails, Field, KeyValueList, Modal, Select, Textarea, toast } from "@/shared/ui";
import { memberApi, type DeactivationImpact, type Member } from "@/entities/user";
import {
  blockingItems,
  deactivationProblem,
  handoverRequests,
  needsSubstitute,
  substituteCandidates,
} from "../model/deactivation";
import { invalidateUserData } from "../model/invalidate";
import { useServerError } from "../model/server-error";
import styles from "./admin.module.css";

export interface DeactivateUserDialogProps {
  open: boolean;
  onClose: () => void;
  customerId: number;
  member: Member | null;
  /** Loaded before opening (a request in 확인 요청·승인 대기 refuses with a toast instead). */
  impact: DeactivationImpact | null;
  members: Member[];
}

/** `{이름} 비활성화` (reference `deact` + J:212): impact, substitute and handover, server refusal details. */
export function DeactivateUserDialog(props: DeactivateUserDialogProps) {
  if (!props.open || !props.member || !props.impact) return null;
  return <DeactivateBody {...props} member={props.member} impact={props.impact} />;
}

function DeactivateBody({
  onClose,
  customerId,
  member,
  impact,
  members,
}: DeactivateUserDialogProps & { member: Member; impact: DeactivationImpact }) {
  const id = useId();
  const client = useQueryClient();
  const [substituteId, setSubstituteId] = useState("");
  const [handover, setHandover] = useState("");
  const server = useServerError("비활성화하지 못했습니다");
  const candidates = substituteCandidates(members, member.user.id);
  const handing = needsSubstitute(impact);
  const approvalWaiting = impact.reviewing.filter((r) => r.status === "APPROVAL_WAITING");
  const ids = (list: { id: string }[]) => list.map((r) => r.id).join(", ") || "없음";

  const submit = async () => {
    const substitute = candidates.find((m) => String(m.user.id) === substituteId);
    const problem = deactivationProblem(impact, substitute, handover);
    if (problem) {
      toast(problem);
      return false;
    }
    server.clear();
    try {
      await memberApi.deactivate(customerId, member.user.id, {
        substituteUserId: handing && substitute ? substitute.user.id : null,
        handover: handing ? handover.trim() : "",
      });
    } catch (error) {
      return server.fail(error);
    }
    await invalidateUserData(client);
    return undefined;
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${member.user.name} 비활성화`}
      description="이력이 있는 사용자는 삭제하지 않고 비활성 상태로 보존합니다."
      okLabel="비활성화"
      okVariant="warn"
      onOk={submit}
    >
      <KeyValueList
        items={[
          { label: "진행 중 검수", value: ids(handoverRequests(impact)) },
          { label: "대표 검수자", value: impact.leadProjects.map((p) => p.name).join(", ") || "없음" },
          {
            label: "승인 대기 이후",
            value: (
              <>
                {ids(approvalWaiting)} <span className={styles.smallFaint}>담당자 변경 없이 기록 보존</span>
              </>
            ),
          },
          ...blockingItems(impact),
        ]}
      />
      {handing ? (
        <div className={styles.mt14}>
          <Field label="대체자" required htmlFor={`${id}-sub`} error={server.field("substituteUserId")}>
            <Select id={`${id}-sub`} value={substituteId} onChange={(e) => setSubstituteId(e.target.value)}>
              <option value="">선택</option>
              {candidates.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="인수인계 내용" required htmlFor={`${id}-ho`} error={server.field("handover")}>
            <Textarea
              id={`${id}-ho`}
              rows={3}
              className={styles.ta}
              value={handover}
              onChange={(e) => setHandover(e.target.value)}
            />
          </Field>
        </div>
      ) : null}
      <ErrorDetails message={server.inline.message} items={server.inline.items} />
    </Modal>
  );
}
