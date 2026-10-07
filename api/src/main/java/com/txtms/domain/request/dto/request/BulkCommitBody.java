package com.txtms.domain.request.dto.request;

import java.util.List;

import tools.jackson.databind.JsonNode;

public record BulkCommitBody(List<Row> rows, Long rowVersion) {

    public record Row(String title, JsonNode payload) {
    }
}
