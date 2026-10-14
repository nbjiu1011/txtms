"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorDetails, KeyValueList, toast } from "@/shared/ui";
import { Button, ConfirmModal, Field, Modal, Select, useServerError } from "@/shared/common";
import { opsApi } from "@/entities/ops";
import type { Project } from "@/entities/project";
import { CONTENT_TYPE_LABEL, type ContentType, type ContentTypeSetting } from "@/entities/request";
import { invalidateOps } from "../model/invalidate";
import styles from "./ops.module.css";

export interface SampleRequestDialogProps {
  open: boolean;
  onClose: () => void;
  customer: { id: number; name: string };
  /** Projects of the customer (only active ones are offered). */
  projects: Project[];
  contentTypes: ContentTypeSetting[];
}

/** 샘플 요청·콘텐츠 생성 (reference `seedSample`, sample customers only). */
export function SampleRequestDialog(props: SampleRequestDialogProps) {
  if (!props.open) return null;
  return <SampleBody {...props} />;
}

function SampleBody({ onClose, customer, projects, contentTypes }: SampleRequestDialogProps) {
  const id = useId();
  const client = useQueryClient();
  const active = projects.filter((p) => p.active);
  const types = contentTypes.filter((t) => t.active);
  const [projectId, setProjectId] = useState(String(active[0]?.id ?? ""));
  const [type, setType] = useState<string>(types[0]?.type ?? "");
  const server = useServerError("샘플 요청을 만들지 못했습니다");

  const submit = async () => {
    if (!active.length) return server.reject("사용 중인 프로젝트가 없습니다");
    server.clear();
    try {
      await opsApi.createSample(customer.id, { projectId: Number(projectId), type: type as ContentType });
    } catch (error) {
      return server.fail(error);
    }
    await invalidateOps(client);
    toast("샘플 요청을 만들었습니다");
    return undefined;
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="샘플 요청·콘텐츠 생성"
      description="시연과 교육용 데이터입니다. 실적 집계에서 제외하고 샘플 초기화로만 지웁니다."
      okLabel="생성"
      onOk={submit}
    >
      <div className={styles.grid2}>
        <Field label="프로젝트" htmlFor={`${id}-p`} error={server.field("projectId")}>
          <Select id={`${id}-p`} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {active.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="콘텐츠 유형" htmlFor={`${id}-t`} error={server.field("type")}>
          <Select id={`${id}-t`} value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => (
              <option key={t.type} value={t.type}>
                {CONTENT_TYPE_LABEL[t.type]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className={styles.smallMuted}>
        작성 중 샘플 요청 1건을 만듭니다. 요청자 역할 사용자가 없으면 운영 담당자 이름으로 기록됩니다.
      </p>
      <ErrorDetails message={server.inline.message} items={server.inline.items} />
    </Modal>
  );
}

export interface ClearSamplesDialogProps {
  open: boolean;
  onClose: () => void;
  customer: { id: number; name: string };
  sampleCount: number;
  realCount: number;
}

/** `{고객사}의 샘플 데이터만 초기화할까요?` (reference `seedClear`): deletes the customer's sample requests only. */
export function ClearSamplesDialog({ open, onClose, customer, sampleCount, realCount }: ClearSamplesDialogProps) {
  const client = useQueryClient();
  const server = useServerError("샘플을 지우지 못했습니다");
  if (!open) return null;
  const submit = async () => {
    server.clear();
    try {
      await opsApi.clearSamples(customer.id);
    } catch (error) {
      return server.fail(error);
    }
    await invalidateOps(client);
    toast(`샘플 ${sampleCount}건을 지웠습니다`);
    return undefined;
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`${customer.name}의 샘플 데이터만 초기화할까요?`}
      description="실제 운영 요청, 완료 묶음, 업무 이력은 지우지 않습니다."
      okLabel="샘플 초기화"
      okVariant="warn"
      onOk={submit}
    >
      <KeyValueList
        items={[
          { label: "삭제 대상", value: `샘플 요청 ${sampleCount}건` },
          { label: "보존", value: `운영 요청 ${realCount}건과 완료 묶음, 업무 이력 전체` },
        ]}
      />
      <ErrorDetails message={server.inline.message} items={server.inline.items} />
    </Modal>
  );
}

/**
 * 시연 데이터 초기화 (reference J:219, profile): resets the requests of the sample customers to the demo
 * seed after a confirm (warn trigger and OK). Real customers are not touched.
 */
export function SampleResetButton() {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const server = useServerError("시연 데이터를 초기화하지 못했습니다");
  const submit = async () => {
    server.clear();
    try {
      const result = await opsApi.sampleReset();
      toast(`샘플 고객사 요청 ${result.deletedRequests}건을 지우고 시드 요청 ${result.restoredRequests}건을 복원했습니다`);
    } catch (error) {
      return server.fail(error);
    }
    await client.invalidateQueries();
    return undefined;
  };
  return (
    <>
      <Button variant="warn" onClick={() => setOpen(true)}>
        시연 데이터 초기화
      </Button>
      <ConfirmModal
        open={open}
        onClose={() => {
          server.clear();
          setOpen(false);
        }}
        title="샘플 고객사의 시연 데이터를 초기화할까요?"
        description="기본 체험 고객사의 시연 요청만 초기화합니다. 실제 고객사 데이터는 유지됩니다."
        confirmLabel="초기화"
        onConfirm={submit}
      >
        <ErrorDetails message={server.inline.message} items={server.inline.items} />
      </ConfirmModal>
    </>
  );
}
