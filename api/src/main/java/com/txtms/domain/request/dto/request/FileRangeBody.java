package com.txtms.domain.request.dto.request;

/** Attachment amounts. Null amounts mean "not entered yet" (submit reports them). */
public record FileRangeBody(Integer totalAmount, Integer reviewAmount, String rangeNote) {
}
