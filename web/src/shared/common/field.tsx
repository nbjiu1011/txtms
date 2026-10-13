import type {
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  Ref,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/shared/lib";
import { CONTROL_CLASS, TEXTAREA_CLASS } from "./control";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Appends the red ` *` required mark. */
  required?: boolean;
}

/** `.fld > label` / `.lbl` — 13px/500 sub. */
export function Label({ required, className, ...rest }: LabelProps) {
  return (
    <label
      className={cn(
        "text-[13px] font-medium text-sub",
        required && "after:text-danger after:content-['_*']",
        className,
      )}
      {...rest}
    />
  );
}

export function Hint({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("text-[12px] text-faint", className)} {...rest} />;
}

export function ErrorMessage({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span role="alert" className={cn("text-[12px] text-danger", className)} {...rest} />;
}

export interface FieldProps {
  label?: ReactNode;
  /** id of the control the label points to. */
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** `.fld` — label, control, hint and error message stacked with a 5px gap. */
export function Field({ label, htmlFor, required, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn("mb-3.5 flex flex-col gap-[5px]", className)}>
      {label ? (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      ) : null}
      {children}
      {hint ? <Hint id={htmlFor ? `${htmlFor}-hint` : undefined}>{hint}</Hint> : null}
      {error ? <ErrorMessage id={htmlFor ? `${htmlFor}-error` : undefined}>{error}</ErrorMessage> : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
}

/** `.in` — text input (min-h 34, focus ring). */
export function Input({ className, ref, ...rest }: InputProps) {
  return <input ref={ref} className={cn(CONTROL_CLASS, className)} {...rest} />;
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
}

/** `.ta` — textarea (min-h 120, lh 1.6, vertical resize). */
export function Textarea({ className, ref, ...rest }: TextareaProps) {
  return <textarea ref={ref} className={cn(CONTROL_CLASS, TEXTAREA_CLASS, className)} {...rest} />;
}
