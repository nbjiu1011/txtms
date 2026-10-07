import { http } from "@/shared/api";
import type { Me, MePatch } from "../model/types";

/** `GET/PATCH /api/me` (contract §1). Email and roles are not editable. */
export const meApi = {
  get: () => http.get<Me>("/me"),
  patch: (body: MePatch) => http.patch<Me>("/me", body),
};
