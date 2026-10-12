package com.txtms.domain.request.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.request.dto.response.ChannelSpecResponse;
import com.txtms.global.config.AppProperties;

/** Channel specification for the editor counters (any authenticated user; values come from configuration). */
@RestController
@RequestMapping("/api")
public class ChannelSpecController {

    private final ChannelSpecResponse spec;

    public ChannelSpecController(AppProperties properties) {
        this.spec = ChannelSpecResponse.of(properties.channelSpec());
    }

    @GetMapping("/channel-specs")
    public ChannelSpecResponse channelSpecs() {
        return spec;
    }
}
