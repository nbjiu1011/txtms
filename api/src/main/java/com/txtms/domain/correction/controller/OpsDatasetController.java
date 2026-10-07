package com.txtms.domain.correction.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.txtms.domain.correction.dto.DatasetDtos.AssignBody;
import com.txtms.domain.correction.dto.DatasetDtos.AssignmentResponse;
import com.txtms.domain.correction.dto.DatasetDtos.CreateDatasetBody;
import com.txtms.domain.correction.dto.DatasetDtos.DatasetDetailResponse;
import com.txtms.domain.correction.dto.DatasetDtos.DatasetResponse;
import com.txtms.domain.correction.service.DatasetService;
import com.txtms.global.security.AuthUser;

/** Operator correction datasets and their assignment to customers × content types (contract §12). */
@RestController
public class OpsDatasetController {

    private final DatasetService datasets;

    public OpsDatasetController(DatasetService datasets) {
        this.datasets = datasets;
    }

    @GetMapping("/api/ops/datasets")
    public List<DatasetResponse> list(@AuthenticationPrincipal AuthUser auth) {
        return datasets.list(auth);
    }

    @GetMapping("/api/ops/datasets/{id}")
    public DatasetDetailResponse detail(@AuthenticationPrincipal AuthUser auth, @PathVariable long id) {
        return datasets.detail(auth, id);
    }

    @PostMapping(path = "/api/ops/datasets", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public DatasetResponse create(@AuthenticationPrincipal AuthUser auth, @RequestBody CreateDatasetBody body) {
        return datasets.create(auth, body == null ? null : body.scope(), body == null ? null : body.rules());
    }

    @PostMapping(path = "/api/ops/datasets", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public DatasetResponse upload(@AuthenticationPrincipal AuthUser auth,
            @RequestParam(value = "scope", required = false) String scope,
            @RequestParam(value = "file", required = false) MultipartFile file) {
        return datasets.createFromXlsx(auth, scope, file);
    }

    @GetMapping("/api/ops/dataset-assignments")
    public List<AssignmentResponse> assignments(@AuthenticationPrincipal AuthUser auth) {
        return datasets.assignments(auth);
    }

    @PutMapping("/api/ops/customers/{id}/dataset-assignments/{type}")
    public AssignmentResponse assign(@AuthenticationPrincipal AuthUser auth, @PathVariable long id,
            @PathVariable String type, @RequestBody AssignBody body) {
        return datasets.assign(auth, id, type, body == null ? null : body.datasetId());
    }

    @DeleteMapping("/api/ops/customers/{id}/dataset-assignments/{type}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unassign(@AuthenticationPrincipal AuthUser auth, @PathVariable long id, @PathVariable String type) {
        datasets.unassign(auth, id, type);
    }

    @PostMapping("/api/ops/customers/{id}/dataset-assignments/{type}/confirm")
    public AssignmentResponse confirm(@AuthenticationPrincipal AuthUser auth, @PathVariable long id,
            @PathVariable String type) {
        return datasets.confirm(auth, id, type);
    }
}
