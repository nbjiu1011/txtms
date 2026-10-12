package com.txtms.global.common;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.safety.Safelist;

/**
 * Server-side allow-list of rich text written with the web editor (Quill 2 output, contract §18). Everything outside
 * the list — other tags, attributes, event handlers, scripts, unsafe URLs, CSS other than text colors — is removed, so
 * the stored HTML can be rendered as is.
 */
public final class RichText {

    /** Sanitized HTML, its visible text and whether it shows an image. */
    public record Result(String html, String text, boolean hasImage) {
    }

    private static final Safelist SAFELIST = new Safelist()
            .addTags("p", "br", "strong", "em", "u", "s", "span", "ol", "ul", "li", "a", "img")
            .addAttributes(":all", "class")
            .addAttributes("span", "style")
            .addAttributes("li", "data-list")
            .addAttributes("a", "href")
            .addAttributes("img", "src", "alt")
            .addProtocols("a", "href", "http", "https", "mailto")
            .addProtocols("img", "src", "https", "data")
            .addEnforcedAttribute("a", "target", "_blank")
            .addEnforcedAttribute("a", "rel", "noopener noreferrer");

    private static final Pattern CLASS = Pattern.compile(
            "ql-(ui|font-(serif|monospace)|size-(small|large|huge)|align-(center|right|justify)|indent-[1-8])");
    private static final Pattern COLOR_VALUE = Pattern.compile(
            "#[0-9a-fA-F]{3,8}|rgba?\\(\\s*[0-9.]+%?(\\s*,\\s*[0-9.]+%?){2,3}\\s*\\)");
    private static final Pattern DATA_IMAGE = Pattern.compile(
            "data:image/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}");

    private RichText() {
    }

    /** Text that is not HTML (does not start with a tag) — the plain bodies written before the editor. */
    public static boolean isHtml(String value) {
        return value != null && value.stripLeading().startsWith("<");
    }

    public static Result sanitize(String raw) {
        Document.OutputSettings out = new Document.OutputSettings().prettyPrint(false);
        String cleaned = Jsoup.clean(raw == null ? "" : raw, "", SAFELIST, out);
        Document doc = Jsoup.parseBodyFragment(cleaned);
        doc.outputSettings(out);
        Element body = doc.body();
        for (Element e : body.select("[class]")) {
            List<String> kept = new ArrayList<>();
            for (String c : e.classNames()) {
                if (CLASS.matcher(c).matches()) {
                    kept.add(c);
                }
            }
            if (kept.isEmpty()) {
                e.removeAttr("class");
            } else {
                e.attr("class", String.join(" ", kept));
            }
        }
        for (Element e : body.select("span[style]")) {
            String style = colors(e.attr("style"));
            if (style.isEmpty()) {
                e.removeAttr("style");
            } else {
                e.attr("style", style);
            }
        }
        for (Element e : body.select("li[data-list]")) {
            String list = e.attr("data-list");
            if (!list.equals("ordered") && !list.equals("bullet")) {
                e.removeAttr("data-list");
            }
        }
        for (Element img : body.select("img")) {
            String src = img.attr("src");
            if (src.isEmpty() || src.startsWith("data:") && !DATA_IMAGE.matcher(src).matches()) {
                img.remove();
            }
        }
        return new Result(body.html(), body.text(), !body.select("img").isEmpty());
    }

    /** Keeps the {@code color} and {@code background-color} declarations with plain hex / rgb values. */
    private static String colors(String style) {
        List<String> kept = new ArrayList<>();
        for (String declaration : style.split(";")) {
            int colon = declaration.indexOf(':');
            if (colon < 0) {
                continue;
            }
            String property = declaration.substring(0, colon).trim().toLowerCase(Locale.ROOT);
            String value = declaration.substring(colon + 1).trim();
            if ((property.equals("color") || property.equals("background-color"))
                    && COLOR_VALUE.matcher(value).matches()) {
                kept.add(property + ": " + value);
            }
        }
        return String.join("; ", kept);
    }
}
