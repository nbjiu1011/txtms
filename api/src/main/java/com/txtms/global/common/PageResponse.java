package com.txtms.global.common;

import java.util.List;
import java.util.function.Function;

/** Contract page shape: {@code { content, page: { number, size, totalElements, totalPages } }}. */
public record PageResponse<T>(List<T> content, PageMeta page) {

    public record PageMeta(int number, int size, long totalElements, int totalPages) {
    }

    /** Pages an in-memory, already sorted list. */
    public static <S, T> PageResponse<T> slice(List<S> all, PageQuery query, Function<List<S>, List<T>> mapper) {
        int from = (int) Math.min((long) query.page() * query.size(), all.size());
        int to = Math.min(from + query.size(), all.size());
        List<T> content = mapper.apply(all.subList(from, to));
        int totalPages = (int) Math.ceil(all.size() / (double) query.size());
        return new PageResponse<>(content, new PageMeta(query.page(), query.size(), all.size(), totalPages));
    }
}
