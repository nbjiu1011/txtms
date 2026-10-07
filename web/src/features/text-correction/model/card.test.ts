import { describe, expect, it } from "vitest";
import type { CorrectionResult } from "@/entities/correction";
import { cardView } from "./card";
import { isExcluded, isStale, payloadSnapshot } from "./freshness";
import { commitReplacement, createRun, planApply } from "./run";

const opt = (recommended: string | null, label = "어려운 한자어", description = "설명") => ({
  ruleId: "R",
  recommended,
  descriptionLabel: label,
  description,
});

function run(): ReturnType<typeof createRun> {
  const result: CorrectionResult = {
    contentKey: "C1",
    checkedAt: "",
    datasetLabel: "알림톡 v4",
    variablesRevision: 3,
    excluded: false,
    groups: [
      { id: "body:0:2", field: "body", start: 0, end: 2, matchedText: "할수", options: [opt("할 수", "띄어쓰기", "의존 명사")] },
      {
        id: "body:3:6",
        field: "body",
        start: 3,
        end: 6,
        matchedText: "수령인",
        options: [opt("받는 사람", "한자어", "사람"), opt("받는 분", "높임", "분")],
      },
      { id: "body:7:9", field: "body", start: 7, end: 9, matchedText: "처리", options: [opt(null, "군더더기 표현", "삭제")] },
      { id: "body:5:8", field: "body", start: 5, end: 8, matchedText: "인 처", options: [opt("인처")] },
    ],
  };
  return createRun(result, "snap");
}

const editable = { editable: true, stale: false };

describe("card state (화면설계 ②–⑤)", () => {
  it("1:1 — one button, restore disabled until applied, enabled after", () => {
    const r = run();
    const view = cardView(r, r.groups[0], editable);
    expect(view).toMatchObject({ mode: "single", choices: [[0, "할 수"]], canApply: true, canRestore: false, label: "띄어쓰기" });
    const planned = planApply(r, r.groups[0].id, 0, "할수 수령인 처리");
    if (!planned.ok) throw new Error(planned.message);
    const applied = commitReplacement(r, planned.replacement, "next");
    expect(cardView(applied, applied.groups[0], editable)).toMatchObject({ applied: 0, canRestore: true });
  });

  it("1:N — select of options; label and description follow the applied option", () => {
    const r = run();
    expect(cardView(r, r.groups[1], editable)).toMatchObject({ mode: "multi", applied: null, label: "한자어", description: "사람" });
    const swapped = { ...r, groups: r.groups.map((g, i) => (i === 1 ? { ...g, applied: 1 } : g)) };
    expect(cardView(swapped, swapped.groups[1], editable)).toMatchObject({ applied: 1, label: "높임", description: "분", canApply: true });
  });

  it("description-only — no recommendation area, nothing to apply", () => {
    const r = run();
    expect(cardView(r, r.groups[2], editable)).toMatchObject({ mode: "describe", choices: [], canApply: false, canRestore: false });
  });

  it("read-only viewer and stale results disable apply and restore", () => {
    const r = run();
    const applied = { ...r, groups: r.groups.map((g, i) => (i === 0 ? { ...g, applied: 0, end: 3 } : g)) };
    expect(cardView(applied, applied.groups[0], { editable: false, stale: false })).toMatchObject({ canApply: false, canRestore: false });
    expect(cardView(applied, applied.groups[0], { editable: true, stale: true })).toMatchObject({ canApply: false, canRestore: false });
  });

  it("an applied overlapping group blocks the other card with a reason", () => {
    const r = run();
    const applied = { ...r, groups: r.groups.map((g) => (g.id === "body:3:6" ? { ...g, applied: 0, end: 8 } : g)) };
    const view = cardView(applied, applied.groups[3], editable);
    expect(view.canApply).toBe(false);
    expect(view.blockedReason).toContain("수령인");
  });
});

describe("freshness (contract §6)", () => {
  const payload = { templateCode: "", body: "할수", buttons: [] };

  it("is fresh with the same normalized payload whatever the key order", () => {
    const snap = payloadSnapshot("ALIMTALK", payload);
    expect(isStale({ snapshot: snap, variablesRevision: 3 }, payloadSnapshot("ALIMTALK", { buttons: [], body: "할수", templateCode: "" }), 3)).toBe(false);
  });

  it("is stale when the text or a link changed", () => {
    const snap = payloadSnapshot("ALIMTALK", payload);
    expect(isStale({ snapshot: snap, variablesRevision: 3 }, payloadSnapshot("ALIMTALK", { ...payload, body: "할 수" }), 3)).toBe(true);
    const link = payloadSnapshot("ALIMTALK", { ...payload, buttons: [{ name: "a", link: "https://x" }] });
    expect(isStale({ snapshot: link, variablesRevision: 3 }, payloadSnapshot("ALIMTALK", { ...payload, buttons: [{ name: "a", link: "https://y" }] }), 3)).toBe(true);
  });

  it("is stale when the project variables moved on, not for an older or unknown project copy", () => {
    const snap = payloadSnapshot("ALIMTALK", payload);
    expect(isStale({ snapshot: snap, variablesRevision: 3 }, snap, 4)).toBe(true);
    expect(isStale({ snapshot: snap, variablesRevision: 3 }, snap, 2)).toBe(false);
    expect(isStale({ snapshot: snap, variablesRevision: 3 }, snap, null)).toBe(false);
  });

  it("excludes only 자유입력형 with attachments", () => {
    expect(isExcluded("FREEFORM", 1)).toBe(true);
    expect(isExcluded("FREEFORM", 0)).toBe(false);
    expect(isExcluded("ALIMTALK", 1)).toBe(false);
  });
});
