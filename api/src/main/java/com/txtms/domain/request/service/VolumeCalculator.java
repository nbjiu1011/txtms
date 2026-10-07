package com.txtms.domain.request.service;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.request.dto.response.Volume;
import com.txtms.domain.request.entity.FileUnit;

import tools.jackson.databind.JsonNode;

/**
 * Review volume of a request.
 * <ul>
 * <li>{@code chars}: body length of contents without attachments (spaces and line breaks included, titles and
 * buttons excluded, variables unresolved). RCS sums card bodies; other types use {@code body} or {@code text}.
 * Length counts UTF-16 code units.</li>
 * <li>{@code files}: sum of actual review amounts per unit; units are never added together.</li>
 * </ul>
 */
public final class VolumeCalculator {

    private VolumeCalculator() {
    }

    /** One content's input: its payload and the review amount of each attachment. */
    public record ContentInput(JsonNode payload, List<FileInput> files) {
    }

    public record FileInput(FileUnit unit, Integer reviewAmount) {
    }

    public static Volume compute(ContentType type, List<ContentInput> contents) {
        int chars = 0;
        Map<FileUnit, Integer> units = new EnumMap<>(FileUnit.class);
        for (ContentInput c : contents) {
            if (c.files().isEmpty()) {
                chars += bodyLength(type, c.payload());
            }
            for (FileInput f : c.files()) {
                units.merge(f.unit(), f.reviewAmount() == null ? 0 : f.reviewAmount(), Integer::sum);
            }
        }
        List<Volume.FileVolume> files = new ArrayList<>();
        units.forEach((unit, amount) -> files.add(new Volume.FileVolume(unit, amount)));
        return new Volume(chars, files);
    }

    static int bodyLength(ContentType type, JsonNode payload) {
        if (payload == null) {
            return 0;
        }
        if (type == ContentType.RCS) {
            int sum = 0;
            for (JsonNode card : payload.path("cards")) {
                sum += card.path("body").asString("").length();
            }
            return sum;
        }
        String body = payload.path("body").asString("");
        if (body.isEmpty()) {
            body = payload.path("text").asString("");
        }
        return body.length();
    }
}
