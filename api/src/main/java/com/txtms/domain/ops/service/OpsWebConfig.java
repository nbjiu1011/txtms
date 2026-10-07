package com.txtms.domain.ops.service;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Registers the operator gate for {@code /api/ops/**}. */
@Configuration(proxyBeanMethods = false)
public class OpsWebConfig implements WebMvcConfigurer {

    private final OpsAccessInterceptor interceptor;

    public OpsWebConfig(OpsAccessInterceptor interceptor) {
        this.interceptor = interceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(interceptor).addPathPatterns("/api/ops/**");
    }
}
