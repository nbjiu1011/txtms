import type { Notice, NoticeScope, NoticeUpsert } from "@/entities/notice";
import { firstMissing } from "@/shared/lib";
import { isRichTextEmpty } from "@/shared/ui/rich-text";

export interface NoticeForm {
  scope: NoticeScope;
  projectId: string;
  title: string;
  body: string;
}

/** Edit: the notice (customer scope keeps the first project selected); new: project scope, current project. */
export function initialNoticeForm(notice: Notice | null, currentProjectId: number | null, firstProjectId: number | null): NoticeForm {
  if (notice) {
    return {
      scope: notice.scope,
      projectId: String(notice.projectId ?? firstProjectId ?? ""),
      title: notice.title,
      body: notice.body,
    };
  }
  return { scope: "PROJECT", projectId: String(currentProjectId ?? firstProjectId ?? ""), title: "", body: "" };
}

/** Title and a body with visible text or an image (the editor's empty document counts as empty). */
export function noticeFormProblem(form: NoticeForm): string | null {
  return firstMissing([
    [form.title, "제목"],
    [isRichTextEmpty(form.body) ? "" : form.body, "내용"],
  ]);
}

export function noticeBody(form: NoticeForm): NoticeUpsert {
  return {
    scope: form.scope,
    projectId: form.scope === "PROJECT" && form.projectId ? Number(form.projectId) : null,
    title: form.title.trim(),
    body: form.body,
  };
}

export const NOTICE_CREATED_TOAST = "공지를 게시했습니다";
export const NOTICE_UPDATED_TOAST = "공지를 수정했습니다. 이전 내용은 이력으로 남습니다";
