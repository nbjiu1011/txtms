package com.txtms.domain.ops.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.customer.entity.NotifyChannel;
import com.txtms.domain.ops.dto.OpsDtos.Kpis;
import com.txtms.domain.ops.dto.OpsDtos.OpsCustomer;
import com.txtms.domain.ops.dto.OpsDtos.Todo;
import com.txtms.domain.user.dto.UserSummary;

/** Operator dashboard aggregation (screens-a §5.3). */
class OpsDashboardRulesTest {

    private static final UserSummary ADMIN = new UserSummary(9, "관리자", null, "a@x.co.kr", true, "#000000");

    private static OpsCustomer customer(long id, boolean active, boolean admin, long projects,
            List<ContentType> unassigned) {
        return new OpsCustomer(id, "고객" + id, "c" + id + ".co.kr", id % 2 == 0, active, false, NotifyChannel.IN_APP,
                3, Instant.EPOCH, null, null, projects, 3, 5, 1, 2, 0, admin, admin ? List.of(ADMIN) : List.of(),
                unassigned);
    }

    @Test
    void kpisCountActiveCustomersOnly() {
        List<OpsCustomer> rows = List.of(
                customer(1, true, true, 2, List.of()),
                customer(2, true, false, 1, List.of(ContentType.SMS)),
                customer(3, false, false, 0, List.of(ContentType.SMS, ContentType.RCS)),
                customer(4, true, true, 1, List.of(ContentType.FREEFORM)));
        assertThat(OpsDashboardRules.kpis(rows)).isEqualTo(new Kpis(3, 1, 2));
        assertThat(OpsDashboardRules.kpis(List.of())).isEqualTo(new Kpis(0, 0, 0));
    }

    @Test
    void todosAreGroupedByKindWithRoutesForActiveCustomers() {
        List<OpsCustomer> rows = List.of(
                customer(1, true, false, 0, List.of(ContentType.ALIMTALK, ContentType.SMS)),
                customer(2, true, false, 1, List.of()),
                customer(3, false, false, 0, List.of(ContentType.SMS)),
                customer(4, true, true, 1, List.of(ContentType.RCS)));
        List<Todo> todos = OpsDashboardRules.todos(rows);
        assertThat(todos).extracting(Todo::kind, Todo::customerId).containsExactly(
                org.assertj.core.groups.Tuple.tuple("INVITE_ADMIN", 1L),
                org.assertj.core.groups.Tuple.tuple("INVITE_ADMIN", 2L),
                org.assertj.core.groups.Tuple.tuple("CREATE_PROJECT", 1L),
                org.assertj.core.groups.Tuple.tuple("ASSIGN_DATASETS", 1L),
                org.assertj.core.groups.Tuple.tuple("ASSIGN_DATASETS", 4L));
        Todo invite = todos.get(0);
        assertThat(invite.label()).isEqualTo("고객사 관리자 초대");
        assertThat(invite.route()).isEqualTo("opsSetup");
        assertThat(invite.sub()).isNull();
        assertThat(invite.count()).isNull();
        assertThat(todos.get(2).label()).isEqualTo("초기 프로젝트 생성");
        Todo assign = todos.get(3);
        assertThat(assign.label()).isEqualTo("유효 데이터셋 2개 조합 배정");
        assertThat(assign.route()).isEqualTo("opsStandards");
        assertThat(assign.sub()).isEqualTo("assign");
        assertThat(assign.count()).isEqualTo(2);
        assertThat(assign.customerName()).isEqualTo("고객1");
        assertThat(assign.customerDomain()).isEqualTo("c1.co.kr");
    }

    @Test
    void noTodosWhenSetupIsComplete() {
        assertThat(OpsDashboardRules.todos(List.of(customer(1, true, true, 1, List.of())))).isEmpty();
    }
}
