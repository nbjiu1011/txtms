import { describe, expect, it } from "vitest";
import type { CorrectionGroup, CorrectionResult } from "@/entities/correction";
import {
  BLOCKED_MESSAGE,
  CHANGED_MESSAGE,
  commitReplacement,
  countRuns,
  createRun,
  currentText,
  planApply,
  planRestore,
  replaceText,
  type CorrectionRun,
} from "./run";

type Fields = Record<string, string>;

/** Builds a group the way the server reports it (positions found in `text`). */
function group(field: string, text: string, matched: string, recommended: (string | null)[], from = 0): CorrectionGroup {
  const start = text.indexOf(matched, from);
  if (start < 0) throw new Error(`${matched} not in ${text}`);
  const end = start + matched.length;
  return {
    id: `${field}:${start}:${end}`,
    field,
    start,
    end,
    matchedText: matched,
    options: recommended.map((r, i) => ({ ruleId: `R${i}`, recommended: r, descriptionLabel: `라벨${i}`, description: `설명${i}` })),
  };
}

function result(groups: CorrectionGroup[]): CorrectionResult {
  return { contentKey: "C1", checkedAt: "", datasetLabel: "알림톡 v4", variablesRevision: 1, groups };
}

/** Applies (option index) or restores (null) on the fields and returns the new state. */
function act(run: CorrectionRun, fields: Fields, groupId: string, option: number | null): [CorrectionRun, Fields] {
  const g = run.groups.find((x) => x.id === groupId);
  if (!g) throw new Error(groupId);
  const planned = option === null ? planRestore(run, groupId, fields[g.field]) : planApply(run, groupId, option, fields[g.field]);
  if (!planned.ok) throw new Error(planned.message);
  const next = { ...fields, [g.field]: replaceText(fields[g.field], planned.replacement) };
  return [commitReplacement(run, planned.replacement, JSON.stringify(next)), next];
}

/** Every group's range must hold exactly what the group says is in place. */
function expectAligned(run: CorrectionRun, fields: Fields) {
  for (const g of run.groups) {
    expect(fields[g.field].slice(g.start, g.end)).toBe(currentText(g));
  }
}

describe("apply / swap / restore offsets (actions §6.6)", () => {
  it("scenario 2: 가입 대상 → 가입대상 → 가입 가능한 분 (shorter, then longer) keeps later indexes", () => {
    const body = "가입 대상인지 아닌지 확인하고 할수 있습니다";
    let fields: Fields = { body };
    let run = createRun(result([group("body", body, "가입 대상", ["가입대상", "가입 가능한 분"]), group("body", body, "할수", ["할 수"])]), "");
    const [first, later] = run.groups.map((g) => g.id);

    [run, fields] = act(run, fields, first, 0);
    expect(fields.body).toBe("가입대상인지 아닌지 확인하고 할수 있습니다");
    expectAligned(run, fields);

    // direct swap (no restore in between): before = the applied text
    [run, fields] = act(run, fields, first, 1);
    expect(fields.body).toBe("가입 가능한 분인지 아닌지 확인하고 할수 있습니다");
    expectAligned(run, fields);

    [run, fields] = act(run, fields, later, 0);
    expect(fields.body).toBe("가입 가능한 분인지 아닌지 확인하고 할 수 있습니다");
    expectAligned(run, fields);

    [run, fields] = act(run, fields, first, null);
    expect(fields.body).toBe("가입 대상인지 아닌지 확인하고 할 수 있습니다");
    expectAligned(run, fields);
    expect(run.groups[0]).toMatchObject({ start: 0, end: 5, applied: null });
  });

  it("scenario 8: 수령인 → 받는 사람 → 받는 분 (both longer, different lengths)", () => {
    const body = "수령인 성함";
    let fields: Fields = { body };
    let run = createRun(result([group("body", body, "수령인", ["받는 사람", "받는 분"]), group("body", body, "성함", ["이름"])]), "");
    const [g, after] = run.groups.map((x) => x.id);
    [run, fields] = act(run, fields, g, 0);
    [run, fields] = act(run, fields, g, 1);
    expect(fields.body).toBe("받는 분 성함");
    expectAligned(run, fields);
    [run, fields] = act(run, fields, after, 0);
    expect(fields.body).toBe("받는 분 이름");
    [run, fields] = act(run, fields, g, null);
    expect(fields.body).toBe("수령인 이름");
    expectAligned(run, fields);
  });

  it("scenario 12: 소요됩니다 → 필요합니다 → 걸립니다 → 복원 returns 소요됩니다", () => {
    const body = "카드 발송은 영업일 기준 일주일 이상 소요됩니다.\n신청자 본인이 카드를 직접 수령하면 사용 등록없이 바로 사용이 가능합니다.";
    let fields: Fields = { body };
    let run = createRun(
      result([group("body", body, "소요됩니다", ["필요합니다", "걸립니다"]), group("body", body, "이 가능합니다", ["을 할 수 있습니다", "를 할 수 있습니다"])]),
      "",
    );
    const [g, later] = run.groups.map((x) => x.id);
    [run, fields] = act(run, fields, g, 0);
    [run, fields] = act(run, fields, g, 1);
    expect(fields.body).toContain("일주일 이상 걸립니다.");
    expectAligned(run, fields);
    [run, fields] = act(run, fields, later, 0);
    expectAligned(run, fields);
    [run, fields] = act(run, fields, g, null);
    expect(fields.body).toBe(body.replace("이 가능합니다", "을 할 수 있습니다"));
    expectAligned(run, fields);
  });

  it("shifts only later groups of the same field; earlier groups and other fields stay", () => {
    const body = "할수 있는 수령인 확인";
    const name = "수령인 확인";
    let fields: Fields = { body, "buttons.0.name": name };
    let run = createRun(
      result([
        group("body", body, "할수", ["할 수"]),
        group("body", body, "수령인", ["받는 분"]),
        group("buttons.0.name", name, "수령인", ["받는 분"]),
      ]),
      "",
    );
    const [first, second, button] = run.groups;
    [run, fields] = act(run, fields, second.id, 0);
    expect(run.groups[0]).toMatchObject({ start: first.start, end: first.end });
    expect(run.groups[2]).toMatchObject({ start: button.start, end: button.end });
    [run, fields] = act(run, fields, first.id, 0);
    expect(fields.body).toBe("할 수 있는 받는 분 확인");
    expect(run.groups[1].start).toBe(second.start + 1);
    expect(fields["buttons.0.name"]).toBe(name);
    expectAligned(run, fields);
    expect(countRuns([run])).toEqual({ results: 3, applied: 2 });
  });

  it("partial overlaps: applying one disables the other, which never moves and works after restore", () => {
    const body = "첫번째 보장 받겠지만 할수";
    let fields: Fields = { body };
    let run = createRun(
      result([
        group("body", body, "첫번째 보장", ["첫 보장"]),
        group("body", body, "보장 받겠지만", ["보장받겠지만"]),
        group("body", body, "할수", ["할 수"]),
      ]),
      "",
    );
    const [a, b, c] = run.groups;
    expect(run.conflicts[a.id]).toEqual([b.id]);
    [run, fields] = act(run, fields, a.id, 0);
    expect(fields.body).toBe("첫 보장 받겠지만 할수");
    expect(planApply(run, b.id, 0, fields.body)).toEqual({ ok: false, message: BLOCKED_MESSAGE });
    expect(run.groups[1]).toMatchObject({ start: b.start, end: b.end });
    expect(fields.body.slice(run.groups[2].start, run.groups[2].end)).toBe("할수");

    [run, fields] = act(run, fields, a.id, null);
    expect(fields.body).toBe(body);
    expect(run.groups[1]).toMatchObject({ start: b.start, end: b.end });
    [run, fields] = act(run, fields, b.id, 0);
    expect(fields.body).toBe("첫번째 보장받겠지만 할수");
    [run, fields] = act(run, fields, c.id, 0);
    expect(fields.body).toBe("첫번째 보장받겠지만 할 수");
    expectAligned(run, fields);
  });

  it("refuses when the text at the range changed, and restores always to the original", () => {
    const body = "할수 있습니다";
    const run = createRun(result([group("body", body, "할수", ["할 수"])]), "");
    expect(planApply(run, run.groups[0].id, 0, "갈수 있습니다")).toEqual({ ok: false, message: CHANGED_MESSAGE });
    expect(planRestore(run, run.groups[0].id, body).ok).toBe(false);
    const [applied, fields] = act(run, { body }, run.groups[0].id, 0);
    const restore = planRestore(applied, applied.groups[0].id, fields.body);
    expect(restore.ok && restore.replacement).toMatchObject({ before: "할 수", after: "할수", applied: null });
  });

  it("does not apply a description-only option", () => {
    const body = "처리됩니다";
    const run = createRun(result([group("body", body, "처리", [null])]), "");
    expect(planApply(run, run.groups[0].id, 0, body).ok).toBe(false);
  });
});
