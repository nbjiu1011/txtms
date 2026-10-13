"use client";

import { Empty } from "@/shared/ui";
import { Drawer } from "@/shared/common";
import { CONTENT_TYPE_LABEL, useWritingGuide, type ContentType } from "@/entities/request";
import styles from "./guide.module.css";

export interface GuideDrawerProps {
  type: ContentType;
  open: boolean;
  onClose: () => void;
}

/** Read-only writing guide (reference `guide` drawer). Proposing a standard is Phase 2. */
export function GuideDrawer({ type, open, onClose }: GuideDrawerProps) {
  const guide = useWritingGuide(type, open);
  return (
    <Drawer open={open} title={`${CONTENT_TYPE_LABEL[type]} 작성 가이드`} onClose={onClose}>
      <p className={styles.note}>읽기 전용입니다. 확인이나 체크는 다음 단계로 넘어가는 조건이 아닙니다.</p>
      {guide.isPending ? (
        <Empty plain title="가이드를 불러오는 중입니다" />
      ) : guide.isError ? (
        <Empty plain title="가이드를 불러오지 못했습니다" description={guide.error.message} />
      ) : (
        <>
          <h4 className={styles.h}>원칙</h4>
          <p className={styles.principles}>{guide.data.principles}</p>
          <h4 className={styles.h}>권장 표현</h4>
          {guide.data.goodExpressions.map((g, i) => (
            <div key={i} className={styles.proof}>
              <div className={styles.pw}>
                <del>{g.avoid}</del> <ins>{g.prefer}</ins>
              </div>
            </div>
          ))}
          <h4 className={styles.h}>체크리스트</h4>
          {guide.data.checklist.map((item, i) => (
            <label key={i} className={styles.chk}>
              <input type="checkbox" />
              {item}
            </label>
          ))}
        </>
      )}
    </Drawer>
  );
}
