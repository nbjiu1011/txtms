"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Banner, Checkbox, ErrorDetails, Field, Input, Modal, Select, toast } from "@/shared/ui";
import type { Customer } from "@/entities/customer";
import { projectApi, projectKeys, type Project } from "@/entities/project";
import type { UserSummary } from "@/entities/user";
import { initialProjectForm, projectBody, projectFormProblem, type ProjectForm } from "../model/project-form";
import { useServerError } from "../model/server-error";
import styles from "./admin.module.css";

export interface ProjectEditDialogProps {
  open: boolean;
  onClose: () => void;
  customer: Pick<Customer, "id" | "name" | "approvalEnabled">;
  /** null = 프로젝트 추가 */
  project: Project | null;
  /** Users of the customer (active ones are the candidates). */
  users: UserSummary[];
  /** Requests in progress (작성 중·최종 제외) of the edited project — stop warning. */
  inProgress: number;
}

/** 프로젝트 추가 / 프로젝트 편집 (reference `projEdit`). */
export function ProjectEditDialog(props: ProjectEditDialogProps) {
  if (!props.open) return null;
  return <ProjectEditBody {...props} />;
}

function ProjectEditBody({ onClose, customer, project, users, inProgress }: ProjectEditDialogProps) {
  const id = useId();
  const client = useQueryClient();
  const [form, setForm] = useState<ProjectForm>(() => initialProjectForm(project));
  const server = useServerError("프로젝트를 저장하지 못했습니다");
  const candidates = users.filter((u) => u.active);
  const set = (patch: Partial<ProjectForm>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    const problem = projectFormProblem(form, project, customer.approvalEnabled);
    if (problem) {
      toast(problem);
      return false;
    }
    server.clear();
    try {
      const body = projectBody(form, customer.approvalEnabled);
      if (project) await projectApi.update(project.id, body);
      else await projectApi.create(customer.id, body);
    } catch (error) {
      return server.fail(error);
    }
    await client.invalidateQueries({ queryKey: projectKeys.all });
    return undefined;
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={project ? "프로젝트 편집" : "프로젝트 추가"}
      okLabel="저장"
      onOk={submit}
    >
      <Field label="프로젝트 이름" required htmlFor={`${id}-name`} error={server.field("name")}>
        <Input id={`${id}-name`} value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label="대표 검수자" required htmlFor={`${id}-lead`} error={server.field("leadUserId")}>
        <Select id={`${id}-lead`} value={form.leadUserId} onChange={(e) => set({ leadUserId: e.target.value })}>
          <option value="">선택</option>
          {candidates.map((u) => (
            <option key={u.id} value={u.id}>
              {`${u.name}  ${u.dept}`}
            </option>
          ))}
        </Select>
      </Field>
      {customer.approvalEnabled ? (
        <>
          <div className={styles.lbl} id={`${id}-ap`}>
            승인자 (한 명 이상)
          </div>
          <div className={styles.pick} role="group" aria-labelledby={`${id}-ap`}>
            {candidates.map((u) => (
              <label key={u.id}>
                <input
                  type="checkbox"
                  checked={form.approverIds.includes(u.id)}
                  onChange={(e) =>
                    set({
                      approverIds: e.target.checked
                        ? [...form.approverIds, u.id]
                        : form.approverIds.filter((x) => x !== u.id),
                    })
                  }
                />
                {u.name}
                <span className={styles.w}>{u.dept}</span>
              </label>
            ))}
          </div>
          {server.field("approverIds") ? <ErrorDetails items={[server.field("approverIds") ?? ""]} /> : null}
        </>
      ) : (
        <p className={styles.smallMuted}>이 고객사는 승인 단계를 쓰지 않습니다.</p>
      )}
      <Checkbox label="사용 중" checked={form.active} onChange={(e) => set({ active: e.target.checked })} />
      {project && !form.active && inProgress > 0 ? (
        <div className={styles.bannerTop}>
          <Banner tone="danger">진행 중인 요청이 있습니다. 중지 전에 담당자와 인수인계를 확인하세요.</Banner>
        </div>
      ) : null}
      <ErrorDetails message={server.inline.message} items={server.inline.items} />
    </Modal>
  );
}
