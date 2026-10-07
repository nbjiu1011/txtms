import type {
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/shared/lib";
import styles from "./form.module.css";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Appends the red ` *` required mark. */
  required?: boolean;
}

/** `.fld > label` / `.lbl` — 13px/500 sub. */
export function Label({ required, className, ...rest }: LabelProps) {
  return <label className={cn(styles.lbl, required && styles.req, className)} {...rest} />;
}

export function Hint({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn(styles.hint, className)} {...rest} />;
}

export function ErrorMessage({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span role="alert" className={cn(styles.emsg, className)} {...rest} />;
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
    <div className={cn(styles.fld, className)}>
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
  return <input ref={ref} className={cn(styles.control, className)} {...rest} />;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  ref?: Ref<HTMLSelectElement>;
}

/** `.sel` — native select. */
export function Select({ className, ref, ...rest }: SelectProps) {
  return <select ref={ref} className={cn(styles.control, className)} {...rest} />;
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
}

/** `.ta` — textarea (min-h 120, lh 1.6, vertical resize). */
export function Textarea({ className, ref, ...rest }: TextareaProps) {
  return <textarea ref={ref} className={cn(styles.control, styles.ta, className)} {...rest} />;
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  labelClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

/** `.chk` — inline checkbox with label (navy accent). */
export function Checkbox({ label, labelClassName, className, ref, ...rest }: CheckboxProps) {
  return (
    <label className={cn(styles.chk, labelClassName)}>
      <input ref={ref} type="checkbox" className={className} {...rest} />
      {label}
    </label>
  );
}
