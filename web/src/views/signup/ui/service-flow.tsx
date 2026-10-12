import { cn } from "@/shared/lib";
import { StatusChip } from "@/shared/ui";
import { ACTOR_LABEL, FLOW_LOOPS, FLOW_STAGES, SETUP_STEPS, type FlowActor } from "../model/flow";
import styles from "./service-flow.module.css";

function ActorTag({ actor, strong }: { actor: FlowActor; strong?: boolean }) {
  return (
    <span className={cn(styles.actor, styles[actor], strong && styles.strong)}>
      {ACTOR_LABEL[actor]}
    </span>
  );
}

/** Setup lane: operator → customer admin → project roles. */
export function SetupLane() {
  return (
    <ol className={styles.setup}>
      {SETUP_STEPS.map((step, i) => (
        <li key={step.title} className={cn(styles.setupStep, styles[step.actor])}>
          <div className={styles.setupHead}>
            <span className={styles.setupNo}>준비 {i + 1}</span>
            <ActorTag actor={step.actor} strong />
          </div>
          <b className={styles.setupTitle}>{step.title}</b>
          <ul className={styles.list}>
            {step.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/** One request from writing to completion: five stages with owner, statuses, steps and hand-over. */
export function ServiceFlow() {
  return (
    <>
      <ol className={styles.stages}>
        {FLOW_STAGES.map((stage) => (
          <li
            key={stage.no}
            className={cn(styles.stage, styles[stage.owner], stage.optional && styles.optional)}
          >
            <div className={styles.stageHead}>
              <span className={styles.stageNo} aria-hidden="true">
                {stage.no}
              </span>
              <h3 className={styles.stageTitle}>
                {stage.title}
                {stage.optional ? <span className={styles.optionalTag}>선택</span> : null}
              </h3>
            </div>
            <div className={styles.owner}>
              <span className={styles.ownerLabel}>담당</span>
              <ActorTag actor={stage.owner} strong />
            </div>
            <div className={styles.statuses} aria-label="요청 상태">
              {stage.statuses.map((s) => (
                <StatusChip key={s.label} tone={s.tone}>
                  {s.label}
                </StatusChip>
              ))}
            </div>
            <ul className={styles.steps}>
              {stage.steps.map((step) => (
                <li key={step.text}>
                  <span>{step.text}</span>
                  {step.actor && step.actor !== stage.owner ? <ActorTag actor={step.actor} /> : null}
                </li>
              ))}
            </ul>
            <p className={styles.handoff}>{stage.handoff}</p>
          </li>
        ))}
      </ol>

      <h3 className={styles.loopTitle}>되돌아가거나 건너뛰는 흐름</h3>
      <ul className={styles.loops}>
        {FLOW_LOOPS.map((loop) => (
          <li key={loop.title} className={cn(styles.loop, styles[loop.actor])}>
            <div className={styles.loopHead}>
              <b>{loop.title}</b>
              <ActorTag actor={loop.actor} />
            </div>
            <span className={styles.loopPath}>{loop.path}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
