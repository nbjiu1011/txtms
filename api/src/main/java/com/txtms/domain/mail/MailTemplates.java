package com.txtms.domain.mail;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.springframework.stereotype.Component;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

/**
 * Renders the mail templates in {@code resources/templates/mail} (contract §23): {@code {name}.html} for the HTML
 * part and {@code {name}.txt} for the plain-text part, which is also what the outbox listing shows. Values are
 * escaped in the HTML ({@code th:text}) and inserted as they are in the text ({@code [(...)]}).
 */
@Component
public class MailTemplates {

    /** One mail of the service: its template name. */
    public enum Template {
        INVITATION("invitation"),
        PASSWORD_RESET("password-reset"),
        EMAIL_CHANGE("email-change"),
        REMINDER("reminder");

        private final String file;

        Template(String file) {
            this.file = file;
        }
    }

    /** One engine per mode, so a name such as {@code mail/layout} (fragments) resolves to the right file. */
    private final TemplateEngine html = engine(TemplateMode.HTML, ".html");
    private final TemplateEngine text = engine(TemplateMode.TEXT, ".txt");

    private static TemplateEngine engine(TemplateMode mode, String suffix) {
        ClassLoaderTemplateResolver r = new ClassLoaderTemplateResolver();
        r.setPrefix("templates/");
        r.setSuffix(suffix);
        r.setTemplateMode(mode);
        r.setCharacterEncoding(StandardCharsets.UTF_8.name());
        r.setCacheable(true);
        TemplateEngine engine = new TemplateEngine();
        engine.setTemplateResolver(r);
        return engine;
    }

    /** The subject plus both parts of a mail. */
    public MailContent render(Template template, String subject, Map<String, Object> model) {
        Context context = new Context();
        context.setVariables(model);
        context.setVariable("subject", subject);
        String name = "mail/" + template.file;
        return new MailContent(subject, normalize(text.process(name, context)), html.process(name, context));
    }

    /** A checkout may give the template files CRLF; the stored body keeps the former LF form. */
    private static String normalize(String text) {
        return text.replace("\r\n", "\n").stripTrailing();
    }
}
