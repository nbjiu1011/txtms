package com.txtms.domain.request.dto.response;

import com.txtms.global.config.AppProperties;

/** {@code GET /api/channel-specs}: the configured channel specification (warnings only, never blocking). */
public record ChannelSpecResponse(Alimtalk alimtalk, Sms sms) {

    public record Alimtalk(int bodyMaxChars, int buttonsMax, int buttonNameMaxChars) {
    }

    public record Sms(int smsMaxBytes, int lmsMaxBytes, String encoding) {
    }

    public static ChannelSpecResponse of(AppProperties.ChannelSpec spec) {
        AppProperties.ChannelSpec.Alimtalk a = spec.alimtalk();
        AppProperties.ChannelSpec.Sms s = spec.sms();
        return new ChannelSpecResponse(new Alimtalk(a.bodyMaxChars(), a.buttonsMax(), a.buttonNameMaxChars()),
                new Sms(s.smsMaxBytes(), s.lmsMaxBytes(), s.encoding()));
    }
}
