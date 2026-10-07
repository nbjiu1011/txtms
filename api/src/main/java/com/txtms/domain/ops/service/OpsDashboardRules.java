package com.txtms.domain.ops.service;

import java.util.ArrayList;
import java.util.List;

import com.txtms.domain.ops.dto.OpsDtos.Kpis;
import com.txtms.domain.ops.dto.OpsDtos.OpsCustomer;
import com.txtms.domain.ops.dto.OpsDtos.Todo;

/**
 * Operator dashboard aggregation (pure, screens-a §5.3 / prototype {@code vOpsHome}). Only active customers count
 * and get setup steps. Steps are grouped by kind like the prototype: every customer without an admin first, then
 * every customer without a project, then every customer with unassigned datasets (customer order inside a group).
 */
public final class OpsDashboardRules {

    public static final String INVITE_ADMIN = "INVITE_ADMIN";
    public static final String CREATE_PROJECT = "CREATE_PROJECT";
    public static final String ASSIGN_DATASETS = "ASSIGN_DATASETS";
    public static final String ROUTE_SETUP = "opsSetup";
    public static final String ROUTE_STANDARDS = "opsStandards";
    public static final String SUB_ASSIGN = "assign";

    private OpsDashboardRules() {
    }

    public static Kpis kpis(List<OpsCustomer> customers) {
        List<OpsCustomer> active = customers.stream().filter(OpsCustomer::active).toList();
        return new Kpis(active.size(),
                (int) active.stream().filter(c -> !c.adminAssigned()).count(),
                (int) active.stream().filter(c -> !c.unassignedDatasetTypes().isEmpty()).count());
    }

    public static List<Todo> todos(List<OpsCustomer> customers) {
        List<OpsCustomer> active = customers.stream().filter(OpsCustomer::active).toList();
        List<Todo> todos = new ArrayList<>();
        active.stream().filter(c -> !c.adminAssigned())
                .forEach(c -> todos.add(todo(INVITE_ADMIN, "고객사 관리자 초대", ROUTE_SETUP, null, c, null)));
        active.stream().filter(c -> c.projectCount() == 0)
                .forEach(c -> todos.add(todo(CREATE_PROJECT, "초기 프로젝트 생성", ROUTE_SETUP, null, c, null)));
        active.stream().filter(c -> !c.unassignedDatasetTypes().isEmpty()).forEach(c -> {
            int n = c.unassignedDatasetTypes().size();
            todos.add(todo(ASSIGN_DATASETS, "유효 데이터셋 " + n + "개 조합 배정", ROUTE_STANDARDS, SUB_ASSIGN, c, n));
        });
        return todos;
    }

    private static Todo todo(String kind, String label, String route, String sub, OpsCustomer c, Integer count) {
        return new Todo(kind, label, route, sub, c.id(), c.name(), c.domain(), c.approvalEnabled(), count);
    }
}
