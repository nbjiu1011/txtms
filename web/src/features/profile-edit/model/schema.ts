import * as z from "zod/mini";

export const PROFILE_NAME_MAX = 50;
export const PROFILE_DEPT_MAX = 100;

/** Keys = `PATCH /api/me` body keys (same limits as the server). */
export const profileSchema = z.object({
  name: z
    .string()
    .check(
      z.trim(),
      z.minLength(1, "이름을 입력하세요"),
      z.maxLength(PROFILE_NAME_MAX, `이름은 ${PROFILE_NAME_MAX}자 이하로 입력하세요`),
    ),
  dept: z.string().check(z.trim(), z.maxLength(PROFILE_DEPT_MAX, `소속은 ${PROFILE_DEPT_MAX}자 이하로 입력하세요`)),
});
export type ProfileValues = z.infer<typeof profileSchema>;
