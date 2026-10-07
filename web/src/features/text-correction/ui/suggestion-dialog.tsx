"use client";

import { useState } from "react";
import { isApiError } from "@/shared/api";
import { Field, Input, Modal, Textarea, toast } from "@/shared/ui";
import { correctionApi } from "@/entities/correction";
import type { GroupState } from "../model/run";
import styles from "./correction.module.css";

export const SUGGESTION_SENT = "건의를 보냈습니다";
export const SUGGESTION_REQUIRED = "건의 이유을(를) 입력하세요";
const MAX_BODY = 2000;
const MAX_SUGGESTED = 200;

export interface SuggestionTarget {
  contentKey: string;
  group: GroupState;
}

export interface SuggestionDialogProps {
  requestId: string;
  target: SuggestionTarget | null;
  onClose: () => void;
}

/** ④ 건의하기 popup: the matched text with its current options and the required reason. */
export function SuggestionDialog(props: SuggestionDialogProps) {
  if (!props.target) return null;
  return <SuggestionBody {...props} target={props.target} />;
}

function SuggestionBody({ requestId, target, onClose }: SuggestionDialogProps & { target: SuggestionTarget }) {
  const [body, setBody] = useState("");
  const [suggested, setSuggested] = useState("");
  const { group, contentKey } = target;
  const options = group.options.map((o) => o.recommended ?? `(${o.descriptionLabel} · 설명만)`);
  return (
    <Modal
      open
      onClose={onClose}
      title="교정 건의하기"
      description="데이터셋 담당자에게 이 교정 결과에 대한 의견을 보냅니다."
      okLabel="건의 보내기"
      okVariant="pri"
      onOk={async () => {
        const text = body.trim();
        if (!text) {
          toast(SUGGESTION_REQUIRED);
          return false;
        }
        try {
          await correctionApi.suggest(requestId, {
            contentKey,
            matchedText: group.matchedText,
            ruleIds: group.options.map((o) => o.ruleId),
            body: text,
            ...(suggested.trim() ? { suggestedExpr: suggested } : {}),
          });
          toast(SUGGESTION_SENT);
          return undefined;
        } catch (error) {
          toast(isApiError(error) ? error.message : "건의를 보내지 못했습니다");
          return false;
        }
      }}
    >
      <div className={styles.match}>
        <div>
          {contentKey} · 기존 표현 <del>{group.matchedText}</del>
        </div>
        <div>권장 표현 {options.join(" / ")}</div>
      </div>
      <Field label="건의 이유" required htmlFor="correction-suggestion">
        <Textarea
          id="correction-suggestion"
          rows={4}
          maxLength={MAX_BODY}
          placeholder="오탐, 더 나은 권장 표현 등 건의할 내용을 적어 주세요"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </Field>
      {/* reference `correctionSuggestion`: an optional 제안 표현 next to the reason */}
      <Field label="제안 표현" htmlFor="correction-suggested">
        <Input
          id="correction-suggested"
          maxLength={MAX_SUGGESTED}
          value={suggested}
          onChange={(e) => setSuggested(e.target.value)}
        />
      </Field>
    </Modal>
  );
}
