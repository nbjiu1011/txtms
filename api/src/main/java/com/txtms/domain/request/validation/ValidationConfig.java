package com.txtms.domain.request.validation;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.txtms.global.config.AppProperties;

/**
 * Validator beans configured from {@code app.content}, {@code app.channel-spec}, {@code app.attachment} and
 * {@code app.sms}.
 */
@Configuration(proxyBeanMethods = false)
public class ValidationConfig {

    @Bean
    PayloadNormalizer payloadNormalizer(AppProperties properties) {
        AppProperties.Content c = properties.content();
        return new PayloadNormalizer(new PayloadNormalizer.Caps(c.maxTextLength(), c.maxButtons(), c.maxCards()));
    }

    @Bean
    ChannelSpecCheck channelSpecCheck(AppProperties properties) {
        AppProperties.ChannelSpec spec = properties.channelSpec();
        return new ChannelSpecCheck(new ChannelSpecCheck.Spec(spec.alimtalk().bodyMaxChars(),
                spec.alimtalk().buttonsMax(), spec.alimtalk().buttonNameMaxChars(), spec.sms().smsMaxBytes(),
                spec.sms().lmsMaxBytes()), properties.sms().customerCenterLine(), properties.sms().optOutLine());
    }

    @Bean
    SubmitValidator submitValidator(AppProperties properties, ChannelSpecCheck channelSpecCheck) {
        AppProperties.Attachment a = properties.attachment();
        return new SubmitValidator(new SubmitValidator.Limits(a.maxCount(), a.maxTotalSize().toBytes()),
                channelSpecCheck);
    }

    @Bean
    BulkRowValidator bulkRowValidator(ChannelSpecCheck channelSpecCheck) {
        return new BulkRowValidator(channelSpecCheck);
    }
}
