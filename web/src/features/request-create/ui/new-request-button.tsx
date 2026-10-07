"use client";

import { Button, Icon } from "@/shared/ui";
import { useRequestCreate, type OpenRequestTab } from "../model/use-request-create";

export interface NewRequestButtonProps {
  projectId: number;
  onOpenRequest: OpenRequestTab;
}

/** `+새 요청` (requesters): creates a draft in the project and opens it on the 요청 정보 tab. */
export function NewRequestButton({ projectId, onOpenRequest }: NewRequestButtonProps) {
  const { create, pending } = useRequestCreate(onOpenRequest);
  return (
    <Button variant="pri" aria-disabled={pending || undefined} onClick={() => void create(projectId)}>
      <Icon name="plus" />새 요청
    </Button>
  );
}
