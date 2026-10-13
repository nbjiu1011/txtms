package com.txtms.domain.project.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.txtms.domain.project.entity.ProjectTemplate;
import com.txtms.domain.project.service.ProjectTemplateRules.TemplateInput;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

/** Operator-set Alimtalk templates of a project (contract §12). */
class ProjectTemplateRulesTest {

    private static BusinessException templatesFail(List<TemplateInput> input) {
        return catchThrowableOfType(BusinessException.class, () -> ProjectTemplateRules.templates(input));
    }

    @Test
    void templatesAreTrimmedAndKeepTheirOrder() {
        assertThat(ProjectTemplateRules.templates(List.of(new TemplateInput(" HB_B-2 ", " 청구 안내 "),
                new TemplateInput("HB_A", "적립 안내")))).containsExactly(new ProjectTemplate("HB_B-2", "청구 안내"),
                        new ProjectTemplate("HB_A", "적립 안내"));
        assertThat(ProjectTemplateRules.templates(List.of())).isEmpty();
    }

    @Test
    void invalidTemplatesAreRefused() {
        assertThat(templatesFail(null).getMessage()).isEqualTo("템플릿 목록을 보내세요");
        List<TemplateInput> withNull = new ArrayList<>();
        withNull.add(null);
        assertThat(templatesFail(withNull).getMessage()).isEqualTo("템플릿 코드를 입력하세요");
        assertThat(templatesFail(List.of(new TemplateInput("A", " "))).getMessage()).isEqualTo("템플릿 이름을 입력하세요");
        assertThat(templatesFail(List.of(new TemplateInput("HB 01", "x"))).getMessage())
                .isEqualTo("템플릿 코드는 영문, 숫자, _, -만 쓸 수 있습니다");
        assertThat(templatesFail(List.of(new TemplateInput("A".repeat(51), "x"))).getMessage())
                .isEqualTo("템플릿 코드는 최대 50자입니다");
        assertThat(templatesFail(List.of(new TemplateInput("A", "가".repeat(101)))).getMessage())
                .isEqualTo("템플릿 이름은 최대 100자입니다");
        BusinessException dup = templatesFail(List.of(new TemplateInput("hb_a", "x"), new TemplateInput("HB_A", "y")));
        assertThat(dup.getMessage()).isEqualTo("템플릿 코드 HB_A이(가) 중복됩니다");
        assertThat(dup.getFieldErrors().getFirst().field()).isEqualTo("templates.1.code");
        BusinessException tooMany = templatesFail(Collections.nCopies(101, new TemplateInput("A", "x")));
        assertThat(tooMany.getCode()).isEqualTo(ErrorCode.LIMIT_EXCEEDED);
    }

    @Test
    void auditLabels() {
        assertThat(ProjectTemplateRules.templateLabel(List.of())).isEqualTo("없음");
        assertThat(ProjectTemplateRules.templateLabel(List.of(new ProjectTemplate("A", "a"),
                new ProjectTemplate("B", "b")))).isEqualTo("A, B");
    }
}
