package com.txtms.domain.auth.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.auth.dto.AuthDtos.ChangePasswordRequest;
import com.txtms.domain.auth.dto.AuthDtos.UpdateMeRequest;
import com.txtms.domain.auth.dto.MeResponse;
import com.txtms.domain.auth.service.AuthService;
import com.txtms.domain.auth.service.MeService;
import com.txtms.global.security.AuthUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/me")
public class MeController {

    private final MeService meService;
    private final AuthService authService;

    public MeController(MeService meService, AuthService authService) {
        this.meService = meService;
        this.authService = authService;
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

    /** Changes the own password; the other sessions of the user end, this one stays signed in. */
    @PutMapping("/password")
    public ResponseEntity<Void> changePassword(@AuthenticationPrincipal AuthUser user,
            @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(user, request.currentPassword(), request.newPassword());
        return ResponseEntity.noContent().build();
    }
}
