import { type StatusTone } from "@/shared/ui";

/** Who does a step. Each actor has its own accent in the flow (always shown with its name). */
export type FlowActor = "requester" | "lead" | "reviewer" | "primary" | "approver" | "admin" | "operator" | "system";

export const ACTOR_LABEL: Record<FlowActor, string> = {
  requester: "요청자",
  lead: "대표 검수자",
  reviewer: "배정 검수자",
  primary: "주담당",
  approver: "승인자",
  admin: "고객사 관리자",
  operator: "솔루션 운영",
  system: "시스템",
};

export interface FlowStep {
  text: string;
  actor?: FlowActor;
}

export interface FlowStage {
  no: number;
  title: string;
  owner: FlowActor;
  /** Optional stage (approval is used only by customers that switch it on). */
  optional?: boolean;
  statuses: { label: string; tone: StatusTone }[];
  steps: FlowStep[];
  /** What happens when the stage hands over to the next one. */
  handoff: string;
}

/** One request from writing to completion (product plan v1.7.8, client feedback ① ③ applied). */
export const FLOW_STAGES: readonly FlowStage[] = [
  {
    no: 1,
    title: "요청 작성",
    owner: "requester",
    statuses: [
      { label: "작성 중", tone: "draft" },
      { label: "배정 대기", tone: "wait" },
    ],
    steps: [
      { text: "제목 · 유형 · 희망 납기 · 목적 입력" },
      { text: "알림톡 · 문자 · RCS · 자유입력 콘텐츠 작성, 자동 저장" },
      { text: "텍스트 교정 (선택)" },
      { text: "제출 검증 후 검수 요청" },
    ],
    handoff: "대표 검수자에게 배정 요청",
  },
  {
    no: 2,
    title: "검수 배정",
    owner: "lead",
    statuses: [{ label: "배정 대기", tone: "wait" }],
    steps: [
      { text: "검수자 1명 이상 배정" },
      { text: "주담당 1명 지정 (1명이면 자동)" },
      { text: "확정 납기 · 긴급도 결정" },
    ],
    handoff: "요청자 · 배정 검수자에게 알림",
  },
  {
    no: 3,
    title: "검수",
    owner: "reviewer",
    statuses: [
      { label: "검수 중", tone: "review" },
      { label: "확인 요청", tone: "ask" },
    ],
    steps: [
      { text: "문안 편집 · 파일 수정본 · 검수 의견 · 교정", actor: "reviewer" },
      { text: "확인 요청 → 요청자 답변", actor: "requester" },
      { text: "공동 검수 결과 확인 후 검수 완료", actor: "primary" },
    ],
    handoff: "승인 단계를 쓰면 승인자에게, 아니면 완료",
  },
  {
    no: 4,
    title: "승인",
    owner: "approver",
    optional: true,
    statuses: [{ label: "승인 대기", tone: "appr" }],
    steps: [
      { text: "승인 단계를 쓰는 고객사만" },
      { text: "적격 승인자 1명이 승인 → 최종 완료" },
      { text: "수정 요청 → 검수 중으로 (차수 +1)" },
    ],
    handoff: "승인되면 완료",
  },
  {
    no: 5,
    title: "완료 · 활용",
    owner: "requester",
    statuses: [{ label: "완료", tone: "done" }],
    steps: [
      { text: "완료 묶음 고정 (버전 · 변수 값)", actor: "system" },
      { text: "문안 복사 · XLSX · 첨부 ZIP 내려받기" },
      { text: "수정이 필요하면 후속 요청 → 작성 중" },
    ],
    handoff: "완료본은 콘텐츠 보관함에서 검색",
  },
];

export interface FlowLoop {
  title: string;
  path: string;
  actor: FlowActor;
}

/** Ways a request goes back or skips a stage. */
export const FLOW_LOOPS: readonly FlowLoop[] = [
  { title: "배정 전 취소", path: "배정 대기 → 작성 중 (차수 유지)", actor: "requester" },
  { title: "확인 요청", path: "검수 중 → 확인 요청 → 답변 후 검수 중 (문안을 고치면 차수 +1)", actor: "reviewer" },
  { title: "회수", path: "요청자가 회수 요청 → 주담당이 승인하면 작성 중", actor: "primary" },
  { title: "검수자 · 주담당 변경", path: "검수 중에만, 변경 사유와 인수인계 필수", actor: "lead" },
  { title: "승인자 수정 요청", path: "승인 대기 → 검수 중, 같은 검수자가 재검수 (차수 +1)", actor: "approver" },
  { title: "승인 단계 미사용", path: "주담당의 검수 완료가 곧 최종 완료", actor: "system" },
];

export interface SetupStep {
  actor: FlowActor;
  title: string;
  items: string[];
}

/** Before the first request: who prepares the customer and the project. */
export const SETUP_STEPS: readonly SetupStep[] = [
  {
    actor: "operator",
    title: "고객사 준비",
    items: ["고객사 생성 · 승인 단계 사용 여부", "초기 프로젝트 · 첫 관리자 초대", "콘텐츠 유형 · 교정 데이터셋 배정"],
  },
  {
    actor: "admin",
    title: "프로젝트 · 사용자",
    items: ["프로젝트 · 대표 검수자 지정", "사용자 초대 · 프로젝트별 역할 부여", "변수 · 공지 · 고객사 설정"],
  },
  {
    actor: "requester",
    title: "업무 시작",
    items: ["요청자가 첫 요청을 작성", "대표 검수자 · 검수자 · 승인자가 이어서 처리", "진행 상황은 대시보드 · 알림으로"],
  },
];
