package com.txtms.domain.demo;

import java.util.List;

/** Demo accounts offered on the login screen, in display order. */
public final class DemoPersonas {

    public record Persona(String email, String roleLabel, String description) {
    }

    public static final List<Persona> LOGIN_SCREEN = List.of(
            new Persona("seoyeon.kim@hanbitcard.co.kr", "요청자", "한빛카드, 카드 혜택 알림"),
            new Persona("jihoon.park@hanbitcard.co.kr", "검수자 (회수 처리 주담당)", "한빛카드"),
            new Persona("dohyun.lee@hanbitcard.co.kr", "검수자 + 대표 검수자", "한빛카드, 배정과 실적"),
            new Persona("gaeul.han@hanbitcard.co.kr", "검수자 (편집 잠금 보유)", "한빛카드"),
            new Persona("mina.choi@hanbitcard.co.kr", "승인자", "한빛카드, 승인 단계 사용"),
            new Persona("minho.kang@hanbitcard.co.kr", "고객사 관리자", "한빛카드, 프로젝트·사용자·공지"),
            new Persona("woojin.jung@txtms.io", "솔루션 운영 담당자", "고객사 등록, 초기 설정, 교정 기준"),
            new Persona("jia.moon@dodamlife.com", "요청자", "도담생명, 승인 단계 미사용"),
            new Persona("taeo.yoon@dodamlife.com", "검수자 + 대표 검수자", "도담생명"));

    private DemoPersonas() {
    }
}
