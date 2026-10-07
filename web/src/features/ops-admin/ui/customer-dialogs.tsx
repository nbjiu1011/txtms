"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Checkbox,
  ErrorDetails,
  Field,
  Input,
  KeyValueList,
  Modal,
  Tag,
  Textarea,
  toast,
  useServerError,
} from "@/shared/ui";
import { opsApi, type OpsCustomer } from "@/entities/ops";
import {
  CUSTOMER_CREATED_TOAST,
  EMPTY_CUSTOMER_FORM,
  customerBody,
  customerFormProblem,
  deactivateProblem,
  domainPreview,
  type CustomerForm,
} from "../model/customer-form";
import { invalidateOps } from "../model/invalidate";
import styles from "./ops.module.css";

export interface CreateCustomerDialogProps {
  open: boolean;
  onClose: () => void;
  /** Known customers (the reference refuses a duplicate domain before calling the server). */
  customers: Pick<OpsCustomer, "name" | "domain">[];
  /** Called after the lists were refreshed (the caller continues to 초기 설정). */
  onCreated: (customer: OpsCustomer) => void;
}

/** 고객사 생성 (reference `opsCustNew` + J:215 default project). */
export function CreateCustomerDialog(props: CreateCustomerDialogProps) {
  if (!props.open) return null;
  return <CreateCustomerBody {...props} />;
}

function CreateCustomerBody({ onClose, customers, onCreated }: CreateCustomerDialogProps) {
  const id = useId();
  const client = useQueryClient();
  const [form, setForm] = useState<CustomerForm>(EMPTY_CUSTOMER_FORM);
  const server = useServerError("고객사를 만들지 못했습니다");
  const set = (patch: Partial<CustomerForm>) => {
    for (const key of Object.keys(patch)) server.clearField(key);
    setForm((f) => ({ ...f, ...patch }));
  };
  const preview = domainPreview(form.domain);

  const submit = async () => {
    const problem = customerFormProblem(form, customers);
    if (problem) return server.reject(problem.message, problem.field);
    server.clear();
    let created: OpsCustomer;
    try {
      created = await opsApi.createCustomer(customerBody(form));
    } catch (error) {
      return server.fail(error);
    }
    await invalidateOps(client);
    toast(CUSTOMER_CREATED_TOAST);
    onCreated(created);
    return undefined;
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="고객사 생성"
      description="승인 단계 사용 여부는 도입 시 확정하며 운영 중에는 바꿀 수 없습니다."
      okLabel="생성"
      onOk={submit}
    >
      <Field label="고객사 이름" required htmlFor={`${id}-name`} error={server.field("name")}>
        <Input id={`${id}-name`} value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field
        label="회사 도메인"
        required
        htmlFor={`${id}-domain`}
        hint={preview}
        error={server.field("domain")}
      >
        <Input
          id={`${id}-domain`}
          placeholder="example.co.kr"
          autoComplete="off"
          value={form.domain}
          onChange={(e) => set({ domain: e.target.value })}
        />
      </Field>
      <Checkbox
        labelClassName={styles.chkRow}
        label="승인 단계 사용 (최종 상태를 승인 완료로 둡니다)"
        checked={form.approvalEnabled}
        onChange={(e) => set({ approvalEnabled: e.target.checked })}
      />
      <ErrorDetails message={server.inline.message} items={server.inline.items} />
    </Modal>
  );
}

export interface DeactivateCustomerDialogProps {
  open: boolean;
  onClose: () => void;
  customer: OpsCustomer | null;
}

/** `{고객사} 비활성화` (reference `opsCustDeact`): impact, required reason, refusal while work remains. */
export function DeactivateCustomerDialog(props: DeactivateCustomerDialogProps) {
  if (!props.open || !props.customer) return null;
  return <DeactivateBody {...props} customer={props.customer} />;
}

function DeactivateBody({ onClose, customer }: DeactivateCustomerDialogProps & { customer: OpsCustomer }) {
  const id = useId();
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const server = useServerError("비활성화하지 못했습니다");
  const live = customer.activeRequestCount;

  const submit = async () => {
    const problem = deactivateProblem(reason, live);
    if (problem) return server.reject(problem, problem.startsWith("비활성 사유") ? "reason" : undefined);
    server.clear();
    try {
      await opsApi.deactivateCustomer(customer.id, reason.trim());
    } catch (error) {
      return server.fail(error);
    }
    await invalidateOps(client);
    toast("비활성 처리했습니다. 데이터는 보존됩니다");
    return undefined;
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${customer.name} 비활성화`}
      description="물리 삭제는 1차 범위가 아닙니다. 이력과 완료본은 비활성 상태로 보존합니다."
      okLabel="비활성화"
      okVariant="warn"
      onOk={submit}
    >
      <KeyValueList
        items={[
          {
            label: "진행 중 요청",
            value: (
              <>
                {live}건 {live ? <Tag variant="hot">업무가 남아 있습니다</Tag> : null}
              </>
            ),
          },
          { label: "사용자", value: `${customer.userCount}명 (관리자 ${customer.admins.length}명)` },
          {
            label: "완료 요청",
            value: (
              <>
                {customer.completedRequestCount}건 <span className={styles.smallFaint}>보존</span>
              </>
            ),
          },
        ]}
      />
      <Field label="비활성 사유" required htmlFor={`${id}-why`} error={server.field("reason")}>
        <Textarea id={`${id}-why`} rows={3} className={styles.ta} value={reason} onChange={(e) => {
            server.clearField("reason");
            setReason(e.target.value);
          }} />
      </Field>
      <ErrorDetails message={server.inline.message} items={server.inline.items} />
    </Modal>
  );
}
