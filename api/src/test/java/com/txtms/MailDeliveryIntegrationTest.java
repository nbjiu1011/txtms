package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import jakarta.mail.Address;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.transaction.PlatformTransactionManager;

import com.txtms.domain.mail.MailContent;
import com.txtms.domain.mail.MailDispatcher;
import com.txtms.domain.mail.MailKind;
import com.txtms.domain.mail.MailProperties;
import com.txtms.domain.mail.OutboundEmail;
import com.txtms.domain.mail.OutboundEmailRepository;
import com.txtms.global.config.AppProperties;
import com.txtms.support.IntegrationTestBase;

/**
 * SMTP delivery of the outbox (contract §23) against the test database, with a fake SMTP server. The test mails are
 * queued in the year 2000 and the dispatcher's clock stands there too, so only these mails are due (the shared
 * database holds other tests' mails, which must stay untouched).
 */
class MailDeliveryIntegrationTest extends IntegrationTestBase {

    private static final Instant T0 = Instant.parse("2000-01-01T00:00:00Z");
    private static final MailProperties PROPS = new MailProperties("noreply@tagoplus.co.kr", "TX TMS",
            List.of("@tagoplus.co.kr"), true, 20, List.of(Duration.ofMinutes(1), Duration.ofMinutes(5)));

    @Autowired
    private OutboundEmailRepository repository;

    @Autowired
    private AppProperties app;

    @Autowired
    private PlatformTransactionManager transactions;

    /** Records accepted messages; refuses recipients starting with "fail". */
    private static final class FakeSmtp extends JavaMailSenderImpl {
        final List<MimeMessage> accepted = new ArrayList<>();

        @Override
        public void send(MimeMessage... messages) {
            for (MimeMessage m : messages) {
                try {
                    Address to = m.getAllRecipients()[0];
                    if (((InternetAddress) to).getAddress().startsWith("fail")) {
                        throw new MailSendException("550 mailbox unavailable");
                    }
                } catch (MessagingException e) {
                    throw new IllegalStateException(e);
                }
                accepted.add(m);
            }
        }
    }

    private MailDispatcher dispatcher(String host, FakeSmtp smtp, Instant now) {
        StaticListableBeanFactory beans = new StaticListableBeanFactory(Map.of("mailSender", smtp));
        return new MailDispatcher(repository, beans.getBeanProvider(JavaMailSender.class), PROPS, app, host,
                Clock.fixed(now, ZoneOffset.UTC), transactions);
    }

    private final List<Long> queued = new ArrayList<>();

    private long queue(String to) {
        long id = repository.save(new OutboundEmail(MailKind.INVITATION, null, to, "TX TMS 초대", "초대 링크입니다.", T0,
                true)).getId();
        queued.add(id);
        return id;
    }

    /** A mail left PENDING in the year 2000 would be due for the next test's dispatcher. */
    @AfterEach
    void removeQueuedMails() {
        repository.deleteAllById(queued);
        queued.clear();
    }

    private OutboundEmail reload(long id) {
        return repository.findById(id).orElseThrow();
    }

    @Test
    void sendsAllowedMailsSkipsOthersAndRetriesFailures() throws Exception {
        long ok = queue("kim@tagoplus.co.kr");
        long other = queue("jihoon.park@hanbitcard.co.kr");
        long failing = queue("fail@tagoplus.co.kr");
        FakeSmtp smtp = new FakeSmtp();
        Instant now = T0.plusSeconds(1);

        assertThat(dispatcher("smtp.test", smtp, now).dispatchDue()).isEqualTo(1);

        OutboundEmail sent = reload(ok);
        assertThat(sent.getStatus()).isEqualTo("SENT");
        assertThat(sent.getSentAt()).isEqualTo(now);
        MimeMessage message = smtp.accepted.getFirst();
        InternetAddress from = (InternetAddress) message.getFrom()[0];
        assertThat(from.getAddress()).isEqualTo("noreply@tagoplus.co.kr");
        assertThat(from.getPersonal()).isEqualTo("TX TMS");
        assertThat(message.getSubject()).isEqualTo("TX TMS 초대");
        assertThat(message.getContent()).isEqualTo("초대 링크입니다.");

        // demo mode (it profile): a recipient outside the allow list is never sent
        assertThat(reload(other).getStatus()).isEqualTo("SKIPPED");

        OutboundEmail retry = reload(failing);
        assertThat(retry.getStatus()).isEqualTo("PENDING");
        assertThat(retry.getAttempts()).isEqualTo(1);
        assertThat(retry.getNextAttemptAt()).isEqualTo(now.plus(Duration.ofMinutes(1)));
        assertThat(retry.getLastError()).contains("550 mailbox unavailable");

        // not due before its retry time; then the last allowed attempt fails it for good
        assertThat(dispatcher("smtp.test", smtp, now.plusSeconds(30)).dispatchDue()).isZero();
        assertThat(reload(failing).getAttempts()).isEqualTo(1);
        dispatcher("smtp.test", smtp, now.plus(Duration.ofMinutes(1))).dispatchDue();
        dispatcher("smtp.test", smtp, now.plus(Duration.ofMinutes(10))).dispatchDue();
        assertThat(reload(failing).getStatus()).isEqualTo("FAILED");
        assertThat(reload(failing).getAttempts()).isEqualTo(3);
        assertThat(smtp.accepted).hasSize(1);
    }

    @Test
    void aTemplatedMailIsSentAsTextAndHtml() throws Exception {
        long id = repository.save(new OutboundEmail(MailKind.INVITATION, null, "kim@tagoplus.co.kr",
                new MailContent("TX TMS 초대", "초대 링크입니다.", "<p>초대 링크입니다.</p>"), T0, true)).getId();
        queued.add(id);
        FakeSmtp smtp = new FakeSmtp();
        dispatcher("smtp.test", smtp, T0.plusSeconds(1)).dispatchDue();

        assertThat(reload(id).getStatus()).isEqualTo("SENT");
        MimeMessage message = smtp.accepted.getFirst();
        message.saveChanges();
        assertThat(message.getContentType()).startsWith("multipart/mixed");
        java.io.ByteArrayOutputStream raw = new java.io.ByteArrayOutputStream();
        message.writeTo(raw);
        String wire = raw.toString(java.nio.charset.StandardCharsets.UTF_8);
        assertThat(wire).contains("multipart/alternative", "text/plain", "text/html");
    }

    @Test
    void withoutSmtpNothingIsSentAndMailsWait() {
        long id = queue("kim@tagoplus.co.kr");
        MailDispatcher off = dispatcher("", new FakeSmtp(), T0.plusSeconds(1));
        assertThat(off.configured()).isFalse();
        assertThat(off.dispatchDue()).isZero();
        assertThat(reload(id).getStatus()).isEqualTo("PENDING");
        // the former outbox-only behaviour: every mail is queued as waiting
        assertThat(off.queueAsDeliverable("jihoon.park@hanbitcard.co.kr")).isTrue();
    }

    @Test
    void withSmtpTheDemoAllowListDecidesAtQueueTime() {
        MailDispatcher on = dispatcher("smtp.test", new FakeSmtp(), T0);
        assertThat(on.configured()).isTrue();
        assertThat(on.queueAsDeliverable("kim@tagoplus.co.kr")).isTrue();
        assertThat(on.queueAsDeliverable("jihoon.park@hanbitcard.co.kr")).isFalse();
    }

    @Test
    void theV9MigrationAddedTheDeliveryColumns() {
        List<String> columns = jdbc.queryForList("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'outbound_emails'""", String.class);
        assertThat(columns).contains("attempts", "next_attempt_at", "last_error");
    }
}
