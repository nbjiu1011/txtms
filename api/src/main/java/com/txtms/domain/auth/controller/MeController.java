package com.txtms.domain.auth.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.auth.dto.AuthDtos.UpdateMeRequest;
import com.txtms.domain.auth.dto.MeResponse;
import com.txtms.domain.auth.service.MeService;
import com.txtms.global.security.AuthUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/me")
public class MeController {

    private final MeService meService;

    public MeController(MeService meService) {
        this.meService = meService;
    }

    @GetMapping
    public MeResponse me(@AuthenticationPrincipal AuthUser user) {
        return meService.me(user);
    }

    /** Only name and department can be changed by the user. */
    @PatchMapping
    public MeResponse update(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody UpdateMeRequest request) {
        return meService.update(user, request);
    }
}
