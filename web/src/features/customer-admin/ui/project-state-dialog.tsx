"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api";
import { toast } from "@/shared/ui";
import { Modal, useServerError } from "@/shared/common";
import { auditKeys } from "@/entities/audit";
import { projectApi, projectKeys, type Project } from "@/entities/project";

const refresh = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: projectKeys.all }),
    client.invalidateQueries({ queryKey: auditKeys.logsAll }),
  ]);

/** 사용 (resume a stopped project) runs at once; a refusal shows the server's message. */
export function useProjectResume() {
  const client = useQueryClient();
  return async (project: Project) => {
    try {
      await projectApi.update(project.id, { active: true });
      toast("프로젝트를 다시 사용합니다");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "프로젝트 상태를 바꾸지 못했습니다");
    }
    await refresh(client);
  };
}

export interface ProjectConfirm {
  project: Project;
  action: "stop" | "delete";
}

const CONFIRM = {
  stop: {
    title: "프로젝트를 사용 중지할까요?",
    description:
      "사용 중지한 프로젝트에서는 새 요청을 만들 수 없습니다. 요청·변수·이력은 그대로 보존되고 언제든 다시 사용할 수 있습니다.",
    ok: "사용 중지",
    done: "프로젝트를 사용 중지했습니다",
    fail: "프로젝트를 사용 중지하지 못했습니다",
  },
  delete: {
    title: "프로젝트를 삭제할까요?",
    description: "요청·공지·변수 이력이 없는 프로젝트만 삭제할 수 있습니다. 구성원 지정도 함께 지워지고 되돌릴 수 없습니다.",
    ok: "삭제",
    done: "프로젝트를 삭제했습니다",
    fail: "프로젝트를 삭제하지 못했습니다",
  },
} as const;

export interface ProjectConfirmDialogProps {
  confirm: ProjectConfirm | null;
  onClose: () => void;
}

/** 사용 중지 / 삭제 confirmation (contract §24); a refusal keeps the dialog open with the server's message. */
export function ProjectConfirmDialog({ confirm, onClose }: ProjectConfirmDialogProps) {
  if (!confirm) return null;
  return <ProjectConfirmBody key={`${confirm.action}-${confirm.project.id}`} confirm={confirm} onClose={onClose} />;
}

function ProjectConfirmBody({ confirm, onClose }: { confirm: ProjectConfirm; onClose: () => void }) {
  const client = useQueryClient();
  const text = CONFIRM[confirm.action];
  const server = useServerError(text.fail);
  const { project, action } = confirm;
  return (
    <Modal
      open
      onClose={onClose}
      title={text.title}
      description={
        action === "stop" && (project.activeRequestCount ?? 0) > 0
          ? `진행 중인 요청이 ${project.activeRequestCount}건 있습니다. 요청을 완료하거나 담당자와 정리한 뒤 중지하세요.`
          : text.description
      }
      okLabel={text.ok}
      okVariant="warn"
      onOk={async () => {
        try {
          await (action === "stop" ? projectApi.update(project.id, { active: false }) : projectApi.remove(project.id));
        } catch (error) {
          return server.fail(error);
        }
        await refresh(client);
        toast(text.done);
        return undefined;
      }}
    />
  );
}
