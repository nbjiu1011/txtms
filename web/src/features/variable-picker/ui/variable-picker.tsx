"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { isApiError } from "@/shared/api";
import { projectKeys } from "@/entities/project";
import { toast } from "@/shared/ui";
import { Button, ErrorMessage, Input, Popover, PopoverBody, PopoverHeader, PopoverItem, Select } from "@/shared/common";
import {
  VARIABLE_TYPES,
  VARIABLE_TYPE_OPTION_LABEL,
  createVariable,
  useProjectVariables,
  variableKeys,
} from "@/entities/variable";
import { variableRegisterSchema, type VariableRegisterValues } from "../model/register-schema";
import styles from "./variable-picker.module.css";

export interface VariablePickerProps {
  open: boolean;
  anchor: HTMLElement | null;
  onClose: () => void;
  projectId: number;
  projectName: string;
  /** Inserts `#{key}` into the field the user was editing. */
  onInsert: (key: string) => void;
}

const REGISTER_FIELDS = ["key", "type", "description", "value"] as const;

/**
 * 변수 삽입 popover (reference `varPick`, width 360): search the project's active variables by key or
 * description and insert one; any project member can register a new variable here (it is inserted
 * right away).
 */
export function VariablePicker({ open, anchor, onClose, projectId, projectName, onInsert }: VariablePickerProps) {
  const [query, setQuery] = useState("");
  const variables = useProjectVariables(projectId, open);
  const q = query.trim().toLowerCase();
  const rows = (variables.data ?? []).filter(
    (v) => v.active && (!q || `${v.key} ${v.description}`.toLowerCase().includes(q)),
  );
  const close = () => {
    setQuery("");
    onClose();
  };

  return (
    <Popover open={open} anchor={anchor} onClose={close} label="변수 삽입" width={360}>
      <PopoverHeader>
        <b>변수 삽입</b>
        <span className={styles.project}>{projectName}</span>
      </PopoverHeader>
      <div className={styles.search}>
        <Input
          autoFocus
          aria-label="변수 검색"
          placeholder="키워드로 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <PopoverBody className={styles.list}>
        {variables.isPending ? (
          <div className={styles.empty}>변수를 불러오는 중입니다</div>
        ) : variables.isError ? (
          <div className={styles.empty}>변수를 불러오지 못했습니다</div>
        ) : rows.length === 0 ? (
          <div className={styles.empty}>검색 결과가 없습니다</div>
        ) : (
          rows.map((v) => (
            <PopoverItem
              key={v.id}
              onClick={() => {
                onInsert(v.key);
                close();
              }}
            >
              <span className={styles.var}>{v.key}</span>
              <span className={styles.desc}>{v.description}</span>
              <span className={styles.value}>{v.value}</span>
            </PopoverItem>
          ))
        )}
      </PopoverBody>
      <RegisterForm
        projectId={projectId}
        onRegistered={(key) => {
          onInsert(key);
          close();
        }}
      />
    </Popover>
  );
}

function RegisterForm(props: { projectId: number; onRegistered: (key: string) => void }) {
  const client = useQueryClient();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VariableRegisterValues>({
    resolver: zodResolver(variableRegisterSchema),
    defaultValues: { key: "", type: "TEXT", description: "", value: "" },
  });

  const submit = handleSubmit(async (values) => {
    try {
      const created = await createVariable(props.projectId, values);
      await client.invalidateQueries({ queryKey: variableKeys.byProject(props.projectId) });
      // The project's `variablesRevision` moved on (correction results become stale).
      void client.invalidateQueries({ queryKey: projectKeys.detail(props.projectId) });
      toast(`${created.key} 변수를 등록했습니다. 프로젝트 구성원 모두 쓸 수 있습니다`);
      props.onRegistered(created.key);
    } catch (error) {
      if (!isApiError(error)) return toast("변수를 등록하지 못했습니다");
      let placed = false;
      for (const fe of error.fieldErrors) {
        const field = REGISTER_FIELDS.find((f) => f === fe.field);
        if (field) {
          setError(field, { message: fe.message });
          placed = true;
        }
      }
      if (error.code === "DUPLICATE") setError("key", { message: error.message });
      else if (!placed) toast(error.message);
    }
  });

  return (
    <form className={styles.register} onSubmit={submit} noValidate aria-label="새 변수 등록">
      <div className={styles.registerTitle}>새 변수 등록</div>
      <div className={styles.row}>
        <div className={styles.cell}>
          <Input
            placeholder="변수 키 (예: customer_name)"
            aria-label="변수 키"
            aria-invalid={errors.key ? true : undefined}
            {...register("key")}
          />
          {errors.key ? <ErrorMessage>{errors.key.message}</ErrorMessage> : null}
        </div>
        <div className={styles.cell}>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select
                aria-label="자료형"
                name={field.name}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                ref={field.ref}
              >
                {VARIABLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {VARIABLE_TYPE_OPTION_LABEL[t]}
                  </option>
                ))}
              </Select>
            )}
          />
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.cell}>
          <Input placeholder="설명" aria-label="설명" {...register("description")} />
          {errors.description ? <ErrorMessage>{errors.description.message}</ErrorMessage> : null}
        </div>
        <div className={styles.cell}>
          <Input
            placeholder="값"
            aria-label="값"
            aria-invalid={errors.value ? true : undefined}
            {...register("value")}
          />
          {errors.value ? <ErrorMessage>{errors.value.message}</ErrorMessage> : null}
        </div>
      </div>
      <div className={styles.actions}>
        <Button type="submit" size="sm" variant="pri" aria-disabled={isSubmitting || undefined}>
          등록
        </Button>
      </div>
    </form>
  );
}
