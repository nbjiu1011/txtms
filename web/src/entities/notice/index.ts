export { NOTICE_SCOPES, NOTICE_SCOPE_LABEL } from "./model/types";
export type { Notice, NoticeLog, NoticeScope, NoticeSummary, NoticeUpsert } from "./model/types";
export { noticeScopeText } from "./model/scope-label";
export { noticeApi, noticeKeys, useManagedNotices, useNotice, useNotices } from "./api/notice-queries";
