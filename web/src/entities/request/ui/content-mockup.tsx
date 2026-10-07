import { ReadOnlyBox } from "@/shared/ui";
import { normalizePayload } from "../model/payload";
import { isShortSms, smsBytes, smsFullText } from "../model/sms";
import type { AlimtalkPayload, ContentPayload, ContentType, RcsPayload, SmsPayload } from "../model/types";
import { RequestImage } from "./request-image";
import { VariableText } from "./variable-text";
import styles from "./content-mockup.module.css";

export interface ContentMockupProps {
  type: ContentType;
  payload: ContentPayload;
  /** Content type setting `mockEnabled` (자유입력형 has no mockup). */
  mockEnabled: boolean;
  customerName: string;
  /** Approved template name of `templateCode` (알림톡). */
  templateName?: string | null;
  /** Variable values for substitution; unknown tokens stay chips. */
  values?: ReadonlyMap<string, string>;
  /** Request of the contents: RCS card images are loaded from it (omit to show only the alt text). */
  requestId?: string;
}

const NOTE = "표시 형태 확인용 화면입니다. 채널 등록, 심사 통과, 발송 성공을 확인하지 않습니다.";

/** Channel mockups of a content (알림톡 bubble, SMS bubble, RCS carousel) — reference `mockHTML`. */
export function ContentMockup(props: ContentMockupProps) {
  const { type, mockEnabled } = props;
  if (!mockEnabled) {
    return (
      <ReadOnlyBox className={styles.small}>
        자유입력형은 목업을 제공하지 않습니다. 파일 내용은 다운로드해 확인합니다.
      </ReadOnlyBox>
    );
  }
  const payload = normalizePayload(type, props.payload);
  return (
    <>
      <div className={styles.phone}>
        {type === "ALIMTALK" ? <Alimtalk {...props} payload={payload as AlimtalkPayload} /> : null}
        {type === "SMS" ? <Sms {...props} payload={payload as SmsPayload} /> : null}
        {type === "RCS" ? <Rcs {...props} payload={payload as RcsPayload} /> : null}
      </div>
      <p className={styles.note}>{NOTE}</p>
    </>
  );
}

function Alimtalk({ payload, customerName, templateName, values }: ContentMockupProps & { payload: AlimtalkPayload }) {
  return (
    <div className={styles.phoneIn}>
      <div className={styles.topT}>{customerName} 알림톡</div>
      <div className={styles.kk}>
        <div className={styles.kkH}>{templateName || "템플릿을 선택하세요"}</div>
        <div className={styles.kkB}>
          <VariableText text={payload.body} values={values} />
        </div>
        {payload.buttons.map((b, i) => (
          <div key={i} className={styles.kkBtn}>
            {b.name || "버튼명"}
          </div>
        ))}
      </div>
    </div>
  );
}

function Sms({ payload, values }: ContentMockupProps & { payload: SmsPayload }) {
  const bytes = smsBytes(payload);
  return (
    <div className={`${styles.phoneIn} ${styles.sms}`}>
      <div className={styles.topT}>
        {payload.sender || "발신번호 미선택"} {isShortSms(bytes) ? "SMS" : "LMS"}
      </div>
      <div className={styles.bubble}>
        <VariableText text={smsFullText(payload)} values={values} />
      </div>
    </div>
  );
}

function Rcs({ payload, values, requestId }: ContentMockupProps & { payload: RcsPayload }) {
  return (
    <div className={styles.phoneIn}>
      <div className={styles.topT}>RCS 카드 {payload.cards.length}장</div>
      <div className={styles.rcsRow}>
        {payload.cards.map((card, i) => {
          const label = card.imageKey ? card.imageAlt || "이미지" : "이미지 없음";
          return (
            <div key={i} className={styles.rcsCard}>
              <div className={styles.rcsImg}>
                {card.imageKey && requestId ? (
                  <RequestImage requestId={requestId} imageKey={card.imageKey} alt={card.imageAlt} fallback={label} />
                ) : (
                  label
                )}
              </div>
              <b>{card.title || "제목"}</b>
              <p>
                <VariableText text={card.body} values={values} />
              </p>
              {card.buttonName ? <div className={styles.kkBtn}>{card.buttonName}</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
