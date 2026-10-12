package com.txtms.domain.user.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.user.dto.DeactivationImpact;
import com.txtms.domain.user.dto.MemberBodies.DeactivateBody;
import com.txtms.domain.user.dto.MemberBodies.EmailBody;
import com.txtms.domain.user.dto.MemberBodies.InvitationBody;
import com.txtms.domain.user.dto.MemberBodies.ProjectRolesBody;
import com.txtms.domain.user.dto.MemberResponse;
import com.txtms.domain.user.service.MemberAdminService;
import com.txtms.domain.user.service.UserDeactivationService;
import com.txtms.global.common.PageQuery;
import com.txtms.global.common.PageResponse;
import com.txtms.global.security.AuthUser;

/** User and role management of the customer admin (contract §11). */
@RestController
@RequestMapping("/api/customers/{customerId}")
public class MemberAdminController {

    private final MemberAdminService members;
    private final UserDeactivationService deactivation;

    public MemberAdminController(MemberAdminService members, UserDeactivationService deactivation) {
        this.members = members;
        this.deactivation = deactivation;
    }

    @GetMapping("/members")
    public PageResponse<MemberResponse> members(@AuthenticationPrincipal AuthUser auth, @PathVariable long customerId,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return members.members(auth, customerId, PageQuery.of(page, size));
    }

    @PutMapping("/users/{userId}/project-roles")
    public MemberResponse projectRoles(@AuthenticationPrincipal AuthUser auth, @PathVariable long customerId,
            @PathVariable long userId, @RequestBody(required = false) ProjectRolesBody body) {
        return members.updateRoles(auth, customerId, userId, body);
    }

    @PostMapping("/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    public MemberResponse invite(@AuthenticationPrincipal AuthUser auth, @PathVariable long customerId,
            @RequestBody(required = false) InvitationBody body) {
        return members.invite(auth, customerId, body);
    }

    @PostMapping("/users/{userId}/invitation/reissue")
    public ResponseEntity<Void> reissue(@AuthenticationPrincipal AuthUser auth, @PathVariable long customerId,
            @PathVariable long userId) {
        members.reissue(auth, customerId, userId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/users/{userId}/email")
    public MemberResponse email(@AuthenticationPrincipal AuthUser auth, @PathVariable long customerId,
            @PathVariable long userId, @RequestBody(required = false) EmailBody body) {
        return members.changeEmail(auth, customerId, userId, body);
    }

    @GetMapping("/users/{userId}/deactivation-impact")
    public DeactivationImpact impact(@AuthenticationPrincipal AuthUser auth, @PathVariable long customerId,
            @PathVariable long userId) {
        return deactivation.impact(auth, customerId, userId);
    }

    @PostMapping("/users/{userId}/deactivate")
    public ResponseEntity<Void> deactivate(@AuthenticationPrincipal AuthUser auth, @PathVariable long customerId,
            @PathVariable long userId, @RequestBody(required = false) DeactivateBody body) {
        deactivation.deactivate(auth, customerId, userId, body);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/users/{userId}/reactivate")
    public ResponseEntity<Void> reactivate(@AuthenticationPrincipal AuthUser auth, @PathVariable long customerId,
            @PathVariable long userId) {
        deactivation.reactivate(auth, customerId, userId);
        return ResponseEntity.noContent().build();
    }
}
