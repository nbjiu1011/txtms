import { describe, expect, it } from "vitest";
import {
  BLANK_CARD,
  MAX_ALIMTALK_BUTTONS,
  addAlimtalkButton,
  blankPayload,
  getPayloadField,
  isBlankContent,
  removeAlimtalkButton,
  setPayloadField,
  setRcsCardCount,
} from "./payload-edit";
import type { AlimtalkPayload, RcsPayload } from "./types";

const alimtalk = (buttons: number): AlimtalkPayload => ({
  templateCode: "HB_POINT_01",
  body: "본문",
  buttons: Array.from({ length: buttons }, (_, i) => ({ name: `버튼${i}`, link: `https://x/${i}` })),
});

describe("alimtalk buttons", () => {
  it("adds an empty button until the limit of 5", () => {
    let p = alimtalk(0);
    for (let i = 0; i < 7; i++) p = addAlimtalkButton(p);
    expect(p.buttons).toHaveLength(MAX_ALIMTALK_BUTTONS);
    expect(p.buttons[0]).toEqual({ name: "", link: "" });
  });

  it("returns the same payload at the limit", () => {
    const full = alimtalk(5);
    expect(addAlimtalkButton(full)).toBe(full);
  });

  it("removes the button at the index without mutating", () => {
    const p = alimtalk(3);
    const next = removeAlimtalkButton(p, 1);
    expect(next.buttons.map((b) => b.name)).toEqual(["버튼0", "버튼2"]);
    expect(p.buttons).toHaveLength(3);
    expect(removeAlimtalkButton(p, 9)).toBe(p);
  });
});

describe("rcs card count", () => {
  const two: RcsPayload = {
    cards: [
      { title: "a", body: "A", imageKey: "img1", imageAlt: "alt", buttonName: "", buttonLink: "" },
      { title: "b", body: "B", imageKey: null, imageAlt: "", buttonName: "", buttonLink: "" },
    ],
  };

  it("appends blank cards and keeps existing ones", () => {
    const next = setRcsCardCount(two, 4);
    expect(next.cards).toHaveLength(4);
    expect(next.cards[0]).toBe(two.cards[0]);
    expect(next.cards[3]).toEqual(BLANK_CARD);
  });

  it("truncates trailing cards and clamps to 1–5", () => {
    expect(setRcsCardCount(two, 1).cards.map((c) => c.title)).toEqual(["a"]);
    expect(setRcsCardCount(two, 0).cards).toHaveLength(1);
    expect(setRcsCardCount(two, 9).cards).toHaveLength(5);
  });
});

describe("payload paths", () => {
  it("reads and writes nested paths immutably", () => {
    const p = alimtalk(2);
    expect(getPayloadField(p, "buttons.1.name")).toBe("버튼1");
    const next = setPayloadField(p, "buttons.1.name", "새 이름");
    expect(next.buttons[1].name).toBe("새 이름");
    expect(next.buttons[0]).toBe(p.buttons[0]);
    expect(p.buttons[1].name).toBe("버튼1");
    expect(setPayloadField(p, "body", "x").body).toBe("x");
  });

  it("ignores paths that do not exist", () => {
    const p = alimtalk(1);
    expect(setPayloadField(p, "buttons.4.name", "x")).toEqual(p);
    expect(setPayloadField(p, "nope", "x")).toEqual(p);
    expect(getPayloadField(p, "buttons.3.name")).toBeUndefined();
  });
});

describe("blank content", () => {
  it("is blank only with the empty payload of its type and no files", () => {
    expect(isBlankContent("SMS", { payload: blankPayload("SMS"), files: [] })).toBe(true);
    expect(isBlankContent("RCS", { payload: blankPayload("RCS"), files: [] })).toBe(true);
    expect(isBlankContent("ALIMTALK", { payload: { ...blankPayload("ALIMTALK"), body: "x" } as AlimtalkPayload, files: [] })).toBe(false);
    expect(
      isBlankContent("FREEFORM", {
        payload: blankPayload("FREEFORM"),
        files: [
          {
            id: 1, name: "a.pdf", ext: "pdf", unit: "PAGE", sizeBytes: 1, totalAmount: 1, reviewAmount: 1,
            rangeNote: "", version: 1, scanStatus: "SAFE", versions: [],
          },
        ],
      }),
    ).toBe(false);
  });
});
