import * as z from "zod/mini";

/** Keys = `PATCH /api/me` body keys. */
export const profileSchema = z.object({
  name: z.string().check(z.trim(), z.minLength(1, "이름을 입력하세요")),
  dept: z.string().check(z.trim()),
});
export type ProfileValues = z.infer<typeof profileSchema>;
