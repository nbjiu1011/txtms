/** Project variables — contract §7. */
export const VARIABLE_TYPES = ["TEXT", "NUMBER", "DATE", "LINK"] as const;
export type VariableType = (typeof VARIABLE_TYPES)[number];

export const VARIABLE_TYPE_LABEL: Record<VariableType, string> = {
  TEXT: "텍스트",
  NUMBER: "숫자",
  DATE: "날짜",
  LINK: "링크",
};

export interface Variable {
  id: number;
  projectId: number;
  key: string;
  description: string;
  type: VariableType;
  value: string;
  active: boolean;
  inUse: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export type VariableSnapshot = Partial<Pick<Variable, "key" | "description" | "type" | "value" | "active">>;

export interface VariableLog {
  at: string;
  actorId: number;
  action: string;
  before: VariableSnapshot | null;
  after: VariableSnapshot | null;
}

export type VariableCreate = Pick<Variable, "key" | "description" | "type" | "value">;
export type VariablePatch = Partial<Pick<Variable, "key" | "description" | "type" | "value" | "active">>;
