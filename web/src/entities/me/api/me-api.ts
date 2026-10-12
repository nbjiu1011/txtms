import { http } from "@/shared/api";
import type { Me, MePatch, PasswordChangeBody } from "../model/types";

/** `GET/PATCH /api/me`, `PUT /api/me/password` (contract §1). Email and roles are not editable. */
export const meApi = {
  get: () => http.get<Me>("/me"),
  patch: (body: MePatch) => http.patch<Me>("/me", body),
  /** 204; the other sessions of the user end, this one stays signed in. */
  changePassword: (body: PasswordChangeBody) => http.put<void>("/me/password", body),
};
