package com.txtms.domain.request.validation;

import java.util.Map;
import java.util.regex.Pattern;

/**
 * The single link rule for submit, XLSX rows and LINK variables: after replacing {@code #{key}} tokens with the
 * current variable values the link must be an absolute http or https URL with a host.
 */
public final class Links {

    private static final Pattern ABSOLUTE = Pattern.compile("^([A-Za-z][A-Za-z0-9+.-]*):(.*)$", Pattern.DOTALL);
    private static final Pattern HTTP = Pattern.compile("(?i)^https?://[^\\s/?#]+([/?#]\\S*)?$");

    private Links() {
    }

    public static boolean valid(String link, Map<String, String> variables) {
        if (link == null || link.isBlank()) {
            return false;
        }
        return HTTP.matcher(VariableTokens.resolve(link.trim(), variables)).matches();
    }

    /** Parses as a URL at all (any scheme). Used to tell "not a link" from "not http/https". */
    public static boolean parsable(String link) {
        return link != null && ABSOLUTE.matcher(link.trim()).matches() && !link.trim().contains(" ");
    }
}
