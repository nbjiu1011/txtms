"use client";

import { useEffect } from "react";
import { useCustomers, type Customer } from "@/entities/customer";
import { defaultProjectId, useWorkContextStore, type Me } from "@/entities/me";
import { useCustomerProjects, type Project } from "@/entities/project";

export interface WorkContext {
  customers: Customer[];
  projects: Project[];
  customer: Customer | null;
  project: Project | null;
  customerId: number | null;
  projectId: number | null;
  projectsLoading: boolean;
}

/**
 * Loads accessible customers/projects and keeps the selected context valid:
 * an unknown customer falls back to the user's own (or the first one), an unknown project to the
 * first project the user is a member of (or the first listed).
 */
export function useWorkContext(me: Me): WorkContext {
  const customerId = useWorkContextStore((s) => s.customerId);
  const projectId = useWorkContextStore((s) => s.projectId);
  const customersQuery = useCustomers();
  const customers = customersQuery.data;
  const projectsQuery = useCustomerProjects(customerId);
  const projects = projectsQuery.data;

  useEffect(() => {
    if (!customers || customers.length === 0) return;
    if (customerId !== null && customers.some((c) => c.id === customerId)) return;
    const fallback = customers.find((c) => c.id === me.customerId) ?? customers[0];
    useWorkContextStore.getState().setCustomer(fallback.id, defaultProjectId(me, fallback.id));
  }, [customers, customerId, me]);

  useEffect(() => {
    if (!projects || customerId === null) return;
    if (projectId !== null && projects.some((p) => p.id === projectId)) return;
    const member = defaultProjectId(me, customerId);
    const next = projects.find((p) => p.id === member) ?? projects[0] ?? null;
    if ((next?.id ?? null) !== projectId) useWorkContextStore.getState().setProject(next?.id ?? null);
  }, [projects, projectId, customerId, me]);

  return {
    customers: customers ?? [],
    projects: projects ?? [],
    customer: customers?.find((c) => c.id === customerId) ?? null,
    project: projects?.find((p) => p.id === projectId) ?? null,
    customerId,
    projectId,
    projectsLoading: projectsQuery.isPending && customerId !== null,
  };
}
