import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader } from '@/components/marketing/site-header'
import { CtaFooter } from '@/components/marketing/cta-footer'
import {
  BANK_ADDRESS,
  BANK_NAME,
  BANK_PHONE,
  BANK_PHONE_TOLL_FREE,
} from '@/lib/bank-constants'

export const metadata: Metadata = {
  title: `Privacy Policy & Terms of Use | ${BANK_NAME}`,
  description: `Read how ${BANK_NAME} protects your information and the terms that govern use of our digital banking services.`,
}

const effectiveDate = 'September 18, 2026'

export default function LegalPage() {
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">
          Legal
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Privacy Policy &amp; Terms of Use
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Effective date: {effectiveDate}. Applies to all visitors and members of{' '}
          {BANK_NAME} digital banking services.
        </p>

        <nav className="mt-8 flex flex-wrap gap-2">
          <a
            href="#privacy"
            className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Privacy Policy
          </a>
          <a
            href="#terms"
            className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Terms of Use
          </a>
          <a
            href="#contact"
            className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Contact
          </a>
        </nav>

        <div className="prose-legal mt-12 space-y-12 text-sm leading-relaxed text-muted-foreground">
          <section id="privacy" className="scroll-mt-24">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              1. Privacy Policy
            </h2>
            <p className="mt-4">
              {BANK_NAME} (“we,” “us,” or “the Bank”) is committed to safeguarding
              the personal and financial information you entrust to us. This
              Privacy Policy explains what we collect, why we collect it, how we
              use and protect it, and the choices you have. By opening an account,
              signing in, or otherwise using our website and mobile experience,
              you acknowledge this Policy.
            </p>

            <h3 className="mt-8 text-base font-semibold text-foreground">
              1.1 Information we collect
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong className="text-foreground">Identity &amp; contact data</strong> —
                name, email address, phone number, mailing address, date of birth,
                and government identification details you submit for account
                opening or identity verification (KYC).
              </li>
              <li>
                <strong className="text-foreground">Account &amp; transaction data</strong> —
                account numbers, balances, transfer instructions, payment
                history, card activity, statements, and related ledger entries.
              </li>
              <li>
                <strong className="text-foreground">Authentication data</strong> —
                credentials handled through our secure authentication provider;
                one-time passcodes (OTPs) are hashed and are not stored in plain
                text.
              </li>
              <li>
                <strong className="text-foreground">Device &amp; usage data</strong> —
                IP address, browser type, approximate location derived from IP,
                pages viewed, and security event logs needed to protect your
                account.
              </li>
              <li>
                <strong className="text-foreground">Communications</strong> —
                messages you send through in-app support chat, email, or phone,
                and our responses.
              </li>
            </ul>

            <h3 className="mt-8 text-base font-semibold text-foreground">
              1.2 How we use information
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>To open, maintain, and service your deposit and credit products.</li>
              <li>To process transfers, payments, card transactions, and statements.</li>
              <li>To verify identity, prevent fraud, and comply with applicable law (including BSA/AML and sanctions screening where required).</li>
              <li>To authenticate sign-in, detect suspicious activity, and protect the integrity of our systems.</li>
              <li>To respond to support requests and send important service notices (e.g., security alerts, statement availability).</li>
              <li>To improve reliability, security, and usability of our digital banking experience.</li>
            </ul>
            <p className="mt-3">
              We do <strong className="text-foreground">not</strong> sell your personal
              information. We do not share it with third parties for their own
              independent marketing.
            </p>

            <h3 className="mt-8 text-base font-semibold text-foreground">
              1.3 How we share information
            </h3>
            <p className="mt-3">
              We may share information only as needed to operate the Bank and meet
              legal obligations, including with:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Service providers under contract who process data on our behalf
                (e.g., secure hosting, email delivery, identity verification),
                bound by confidentiality and security obligations.
              </li>
              <li>
                Payment networks, correspondent banks, and clearing systems when
                you initiate transfers or card transactions.
              </li>
              <li>
                Regulators, law enforcement, or courts when required by law,
                subpoena, or to protect rights, safety, or property.
              </li>
              <li>
                A successor entity in connection with a merger, acquisition, or
                reorganization, subject to equivalent privacy protections.
              </li>
            </ul>

            <h3 className="mt-8 text-base font-semibold text-foreground">
              1.4 Security
            </h3>
            <p className="mt-3">
              We use industry-standard safeguards designed to protect your data in
              transit and at rest, including encryption, access controls,
              session management, and monitoring for unauthorized access. No method
              of transmission or storage is 100% secure; you are responsible for
              keeping your password confidential and for securing devices you use
              to access online banking. Report suspected unauthorized access to us
              immediately.
            </p>

            <h3 className="mt-8 text-base font-semibold text-foreground">
              1.5 Retention
            </h3>
            <p className="mt-3">
              We retain account, transaction, and identity records for as long as
              your relationship continues and thereafter as required by law,
              regulation, audit, and dispute-resolution needs. When retention is
              no longer required, we delete or de-identify data in accordance with
              our records program.
            </p>

            <h3 className="mt-8 text-base font-semibold text-foreground">
              1.6 Your choices &amp; rights
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Update profile and contact details in Settings.</li>
              <li>Request access to or correction of certain personal data we hold about you, subject to law and security verification.</li>
              <li>Opt out of non-essential promotional communications (service and security messages will continue).</li>
              <li>Close your account; residual records may be retained as legally required.</li>
            </ul>

            <h3 className="mt-8 text-base font-semibold text-foreground">
              1.7 Cookies &amp; similar technologies
            </h3>
            <p className="mt-3">
              We use essential cookies and similar technologies to keep you signed
              in, maintain security, and measure basic site performance. You can
              control cookies through your browser; disabling essential cookies may
              prevent sign-in or core features from working.
            </p>

            <h3 className="mt-8 text-base font-semibold text-foreground">
              1.8 Children’s privacy
            </h3>
            <p className="mt-3">
              Our services are not directed to children under 13. We do not
              knowingly collect personal information from children under 13. If you
              believe we have done so, contact us and we will take appropriate
              steps to delete it.
            </p>

            <h3 className="mt-8 text-base font-semibold text-foreground">
              1.9 Changes to this Policy
            </h3>
            <p className="mt-3">
              We may update this Privacy Policy from time to time. The effective
              date at the top of this page will change when we do. Material changes
              may be communicated through the website, email, or in-app notice.
              Continued use after the effective date constitutes acceptance of the
              updated Policy.
            </p>
          </section>

          <section id="terms" className="scroll-mt-24 border-t border-border pt-12">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              2. Terms of Use &amp; Member Agreement
            </h2>
            <p className="mt-4">
              These Terms of Use (“Terms”) govern access to and use of {BANK_NAME}
              websites, applications, and digital banking services. By creating an
              account, signing in, or using our services, you agree to these Terms
              and our Privacy Policy. If you do not agree, do not use the services.
            </p>

            <h3 className="mt-8 text-base font-semibold text-foreground">
              2.1 Eligibility &amp; accounts
            </h3>
            <p className="mt-3">
              You must be legally capable of entering a binding agreement and
              provide accurate, complete information during application and on an
              ongoing basis. You are responsible for all activity under your
              credentials. We may decline, suspend, or close accounts where we
              reasonably believe information is inaccurate, risk is elevated, or
              use violates these Terms or law.
            </p>

            <h3 className="mt-8 text-base font-semibold text-foreground">
              2.2 Products &amp; digital banking
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Checking, savings, retirement, and credit products are subject to
                product-specific disclosures, approval, and applicable account
                agreements.
              </li>
              <li>
                Credit limits, if any, are set at our discretion upon approval and
                may be adjusted based on risk, usage, and policy.
              </li>
              <li>
                Balances, available credit, and transaction history shown in the
                dashboard reflect posted activity; pending items may not appear
                immediately.
              </li>
              <li>
                Debit and credit card features (including physical card orders)
                may require completed identity verification (KYC).
              </li>
            </ul>

            <h3 className="mt-8 text-base font-semibold text-foreground">
              2.3 Transfers &amp; payments
            </h3>
            <p className="mt-3">
              You authorize us to process the transfers and payments you initiate.
              You are responsible for the accuracy of recipient details, amounts,
              and timing. Some outbound transfers may be reviewed before posting.
              We are not responsible for delays or losses caused by incorrect
              instructions, intermediary institutions, or circumstances beyond our
              reasonable control.
            </p>

            <h3 className="mt-8 text-base font-semibold text-foreground">
              2.4 Acceptable use
            </h3>
            <p className="mt-3">You agree not to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Use the services for unlawful, fraudulent, or deceptive purposes.</li>
              <li>Attempt to gain unauthorized access to systems, accounts, or data.</li>
              <li>Interfere with security, availability, or integrity of the platform.</li>
              <li>Misrepresent your identity or affiliation.</li>
              <li>Scrape, reverse engineer, or abuse automated access in ways that harm the service or other members.</li>
            </ul>

            <h3 className="mt-8 text-base font-semibold text-foreground">
              2.5 Electronic communications
            </h3>
            <p className="mt-3">
              You consent to receive disclosures, statements, alerts, and notices
              electronically (email, in-app, or website). You may request paper
              copies where required by law. Keep your email address current.
            </p>

            <h3 className="mt-8 text-base font-semibold text-foreground">
              2.6 Intellectual property
            </h3>
            <p className="mt-3">
              The Bank’s name, logos, software, content, and design are owned by
              {BANK_NAME} or its licensors. You receive a limited, non-exclusive,
              non-transferable license to use the digital banking interface for
              personal or authorized business banking only. You may not copy,
              modify, or distribute our materials without prior written consent.
            </p>

            <h3 className="mt-8 text-base font-semibold text-foreground">
              2.7 Disclaimers
            </h3>
            <p className="mt-3">
              Services are provided on an “as available” basis. While we strive for
              continuous, accurate operation, we do not warrant uninterrupted
              access, error-free displays, or that all third-party networks will
              process every transaction without delay. Nothing on the website is
              investment, tax, or legal advice.
            </p>

            <h3 className="mt-8 text-base font-semibold text-foreground">
              2.8 Limitation of liability
            </h3>
            <p className="mt-3">
              To the fullest extent permitted by law, {BANK_NAME} and its
              officers, employees, and agents are not liable for indirect,
              incidental, special, consequential, or punitive damages, or for loss
              of profits, data, or goodwill, arising from use of the services.
              Where liability cannot be excluded, it is limited to the fees you
              paid us for the service giving rise to the claim in the twelve (12)
              months preceding the event, or one hundred U.S. dollars (US $100),
              whichever is greater—except where a different limit is required by
              consumer protection or banking law.
            </p>

            <h3 className="mt-8 text-base font-semibold text-foreground">
              2.9 Indemnity
            </h3>
            <p className="mt-3">
              You agree to indemnify and hold harmless {BANK_NAME} from claims,
              losses, and expenses (including reasonable attorneys’ fees) arising
              from your misuse of the services, violation of these Terms, or
              infringement of third-party rights, except to the extent caused by
              our willful misconduct.
            </p>

            <h3 className="mt-8 text-base font-semibold text-foreground">
              2.10 Governing law
            </h3>
            <p className="mt-3">
              These Terms are governed by the laws of the State of Florida and
              applicable federal banking laws of the United States, without regard
              to conflict-of-law principles. Courts located in Florida shall have
              exclusive jurisdiction over disputes, subject to mandatory
              arbitration or consumer rights that cannot be waived.
            </p>

            <h3 className="mt-8 text-base font-semibold text-foreground">
              2.11 Changes &amp; termination
            </h3>
            <p className="mt-3">
              We may modify these Terms by posting an updated version with a new
              effective date. Continued use after changes constitutes acceptance.
              We may suspend or terminate access for violation of these Terms,
              risk, or legal requirements. Provisions that by nature should
              survive (including privacy, liability limits, and indemnity) will
              survive termination.
            </p>
          </section>

          <section id="contact" className="scroll-mt-24 border-t border-border pt-12">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              3. Contact us
            </h2>
            <p className="mt-4">
              Questions about privacy, these Terms, or your data rights:
            </p>
            <div className="mt-4 rounded-xl border border-border bg-card p-5 text-foreground">
              <p className="font-semibold">{BANK_NAME}</p>
              <p className="mt-1 text-sm text-muted-foreground">{BANK_ADDRESS}</p>
              <p className="mt-2 text-sm">
                Phone: {BANK_PHONE}
                {BANK_PHONE_TOLL_FREE ? ` · Toll-free: ${BANK_PHONE_TOLL_FREE}` : ''}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                You may also use in-app Chat support while signed in.
              </p>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              {BANK_NAME}. Member FDIC. Equal Housing Lender. This page is provided
              for transparency and does not replace product-specific account
              agreements or required regulatory disclosures delivered at account
              opening.
            </p>
            <p className="mt-4">
              <Link
                href="/"
                className="text-sm font-medium text-primary hover:underline"
              >
                ← Back to home
              </Link>
            </p>
          </section>
        </div>
      </main>
      <CtaFooter />
    </div>
  )
}
