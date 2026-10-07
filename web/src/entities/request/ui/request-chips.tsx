import { StatusChip, TypeChip } from "@/shared/ui";
import { CONTENT_TYPE_LABEL, CONTENT_TYPE_TONE, REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE } from "../model/labels";
import type { ContentType, RequestStatus } from "../model/types";

export function RequestStatusChip({ status }: { status: RequestStatus }) {
  return <StatusChip tone={REQUEST_STATUS_TONE[status]}>{REQUEST_STATUS_LABEL[status]}</StatusChip>;
}

export interface ContentTypeChipProps {
  type: ContentType;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ContentTypeChip({ type, showLabel, size }: ContentTypeChipProps) {
  return <TypeChip tone={CONTENT_TYPE_TONE[type]} label={CONTENT_TYPE_LABEL[type]} showLabel={showLabel} size={size} />;
}
