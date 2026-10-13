import type { Notice, NoticeScope, NoticeUpsert } from "@/entities/notice";
import { firstMissing } from "@/shared/lib";
import { isRichTextEmpty } from "@/shared/ui/rich-text";

export interface NoticeForm {
  scope: NoticeScope;
  projectId: string;
  title: string;
  body: string;
  /** New notices only: publish at once or save unpublished. */
  published: boolean;
}

/** Edit: the notice (customer scope keeps the first project selected); new: project scope, current project. */
export function initialNoticeForm(notice: Notice | null, currentProjectId: number | null, firstProjectId: number | null): NoticeForm {
  if (notice) {
    return {
      scope: notice.scope,
      projectId: String(notice.projectId ?? firstProjectId ?? ""),
      title: notice.title,
      body: notice.body,
      published: notice.published,
    };
  }
  return {
    scope: "PROJECT",
    projectId: String(currentProjectId ?? firstProjectId ?? ""),
    title: "",
    body: "",
    published: true,
  };
}

/** Title and a body with visible text or an image (the editor's empty document counts as empty). */
export function noticeFormProblem(form: NoticeForm): string | null {
  return firstMissing([
    [form.title, "제목"],
    [isRichTextEmpty(form.body) ? "" : form.body, "내용"],
  ]);
}

/** Edits leave out `published`: the publish state changes only through 게시 / 게시 중지. */
export function noticeBody(form: NoticeForm): NoticeUpsert {
  return {
    scope: form.scope,
    projectId: form.scope === "PROJECT" && form.projectId ? Number(form.projectId) : null,
    title: form.title.trim(),
    body: form.body,
  };
}

export function newNoticeBody(form: NoticeForm): NoticeUpsert {
  return { ...noticeBody(form), published: form.published };
}

export const NOTICE_CREATED_TOAST = "공지를 게시했습니다";
export const NOTICE_SAVED_UNPUBLISHED_TOAST = "공지를 미게시로 저장했습니다. 게시하면 사용자에게 보입니다";
export const NOTICE_UPDATED_TOAST = "공지를 수정했습니다. 이전 내용은 이력으로 남습니다";
