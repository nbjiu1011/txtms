import { downloadFile, isApiError } from "@/shared/api";
import { toast } from "@/shared/ui";
import { requestFilePaths } from "@/entities/request";

export type BundleExportKind = "xlsx" | "zip";

export const EXPORT_FAILED = "파일을 내려받지 못했습니다";

/** Server file names (used when the response carries no `Content-Disposition`). */
export function bundleExportFileName(requestId: string, kind: BundleExportKind): string {
  return kind === "xlsx" ? `${requestId}_완료본.xlsx` : `${requestId}_첨부_완료본.zip`;
}

/**
 * Downloads the completion bundle as XLSX (every item) or ZIP (final attachment versions + version
 * manifest) with the bearer token. On failure the server message is shown — e.g. a ZIP whose files
 * have no stored original answers 404 `{파일명}: 시연용 파일의 원본이 없습니다` — and false is returned so
 * the confirmation stays open (reference `exportF`).
 */
export async function exportBundle(requestId: string, kind: BundleExportKind): Promise<boolean> {
  const path = kind === "xlsx" ? requestFilePaths.bundleXlsx(requestId) : requestFilePaths.bundleZip(requestId);
  try {
    await downloadFile(path, bundleExportFileName(requestId, kind));
    return true;
  } catch (error) {
    toast(isApiError(error) && error.message ? error.message : EXPORT_FAILED);
    return false;
  }
}
