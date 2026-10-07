import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http, queryKeys } from "@/shared/api";
import type { NotificationList } from "../model/types";

export const notificationKeys = {
  all: queryKeys.all("notifications"),
  list: () => queryKeys.list("notifications", {}),
};

export function fetchNotifications(): Promise<NotificationList> {
  return http.get<NotificationList>("/notifications");
}

/** Latest notifications of the current user (max 100) with the unread count. */
export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: fetchNotifications,
    enabled,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => http.post<void>(`/notifications/${id}/read`),
    onSuccess: () => client.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => http.post<void>("/notifications/read-all"),
    onSuccess: () => client.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
