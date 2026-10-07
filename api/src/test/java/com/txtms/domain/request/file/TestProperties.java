package com.txtms.domain.request.file;

import com.txtms.global.config.AppProperties;

/** Minimal AppProperties for unit tests. */
final class TestProperties {

    private TestProperties() {
    }

    static AppProperties withDemo(boolean demo) {
        return new AppProperties(null, null, null, null, null, null, null, new AppProperties.Demo(demo, null), null,
                null, null, null, null, null);
    }
}
