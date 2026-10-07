package com.txtms.domain.request.validation;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.txtms.global.config.AppProperties;

/** Validator beans configured from {@code app.content}, {@code app.attachment} and {@code app.sms}. */
@Configuration(proxyBeanMethods = false)
public class ValidationConfig {

    @Bean
    PayloadNormalizer payloadNormalizer(AppProperties properties) {
        AppProperties.Content c = properties.content();
        return new PayloadNormalizer(new PayloadNormalizer.Caps(c.maxTextLength(), c.maxButtons(), c.maxCards()));
    }

    @Bean
    SubmitValidator submitValidator(AppProperties properties) {
        return new SubmitValidator(limits(properties));
    }

    @Bean
    BulkRowValidator bulkRowValidator(AppProperties properties) {
        return new BulkRowValidator(limits(properties));
    }

    static SubmitValidator.Limits limits(AppProperties properties) {
        AppProperties.Content c = properties.content();
        AppProperties.Attachment a = properties.attachment();
        return new SubmitValidator.Limits(c.alimtalkBodyMax(), c.maxButtons(), c.buttonNameMax(), c.smsBytesMax(),
                a.maxCount(), a.maxTotalSize().toBytes(), properties.sms().customerCenterLine(),
                properties.sms().optOutLine());
    }
}
