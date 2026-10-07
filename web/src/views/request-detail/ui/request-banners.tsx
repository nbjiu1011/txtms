import { Fragment } from "react";
import { Banner, Button } from "@/shared/ui";
import type { RequestAction } from "@/entities/request";
import type { BannerModel } from "../model/banners";

export interface RequestBannersProps {
  banners: BannerModel[];
  performable: ReadonlySet<RequestAction>;
  onAnswer: () => void;
  onShowResult: () => void;
  onDecideRecall: (approve: boolean) => void;
}

/** Stacked status banners above every sub tab (reference `vBanners`). */
export function RequestBanners({ banners, performable, onAnswer, onShowResult, onDecideRecall }: RequestBannersProps) {
  return (
    <>
      {banners.map((b) => (
        <Banner key={b.key} tone={b.tone} title={b.title} actions={actionsOf(b)}>
          {b.lines.map((line, i) => (
            <Fragment key={i}>
              {i > 0 ? <br /> : null}
              {line}
            </Fragment>
          ))}
        </Banner>
      ))}
    </>
  );

  function actionsOf(b: BannerModel) {
    if (b.action === "answer") {
      return (
        <Button size="sm" onClick={onAnswer}>
          답변하기
        </Button>
      );
    }
    if (b.action === "showResult") {
      return (
        <Button size="sm" onClick={onShowResult}>
          완료 결과 보기
        </Button>
      );
    }
    if (b.action === "decideRecall" && performable.has("DECIDE_RECALL")) {
      return (
        <div>
          <Button size="sm" onClick={() => onDecideRecall(false)}>
            거절
          </Button>{" "}
          <Button size="sm" variant="pri" onClick={() => onDecideRecall(true)}>
            회수 승인
          </Button>
        </div>
      );
    }
    return undefined;
  }
}
