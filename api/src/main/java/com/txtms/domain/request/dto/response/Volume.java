package com.txtms.domain.request.dto.response;

import java.util.List;

/** Review volume: text characters of contents without attachments, and attachment review amounts per unit. */
public record Volume(int chars, List<FileVolume> files) {

    public record FileVolume(com.txtms.domain.request.entity.FileUnit unit, int amount) {
    }
}
