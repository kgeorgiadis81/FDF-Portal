---
name: owasp-security
description: |
  OWASP security procedures for FDF Management. Wraps the vendored OWASP Secure Agent Playbook
  (code-security-skills plugin). Use for code security review, API security review, secrets scanning,
  SCA dependency auditing, web security review, and secure engineering guidance.
  Trigger when performing any security-sensitive work: auth, authz, PII, SQL, APIs, uploads, passwords,
  JWT, OAuth, or dependency analysis.
license: MIT
---

# OWASP Security Procedures for FDF Management

This skill wraps the vendored OWASP Secure Agent Playbook code-security-skills.

**Vendor location**: `tooling/owasp-security-playbook/code-security-skills/`
**Source**: https://github.com/OWASP/secure-agent-playbook (commit 79fea6b9115b55687818f8c4073844ee9ba907a6)
**License**: See `tooling/owasp-security-playbook/code-security-skills/.claude-plugin/plugin.json`

## When to Use

Read and invoke the appropriate OWASP procedure whenever:
- Reviewing authentication or authorization code
- Reviewing API endpoints or middleware
- Scanning for accidentally committed secrets
- Auditing npm dependencies for vulnerabilities
- Reviewing web application security (OWASP Top 10)
- Designing secure file upload or storage handling
- Reviewing any code touching PII or data relating to minors

## Available Procedures

### Code Security Review
**Skill**: `tooling/owasp-security-playbook/code-security-skills/skills/code-review-security/SKILL.md`
**Play**: `tooling/owasp-security-playbook/code-security-skills/plays/code-review-security.md`

Use for: general security code review, PR security gates, pre-merge security checks.

### API Security Review
**Skill**: `tooling/owasp-security-playbook/code-security-skills/skills/api-security-review/SKILL.md`
**Play**: `tooling/owasp-security-playbook/code-security-skills/plays/api-security-review.md`

Use for: reviewing Express routes, middleware, authentication endpoints, authorization checks.

### Secrets Scan
**Skill**: `tooling/owasp-security-playbook/code-security-skills/skills/secrets-scan/SKILL.md`
**Play**: `tooling/owasp-security-playbook/code-security-skills/plays/secrets-scan.md`

Use for: detecting accidentally committed API keys, passwords, tokens, private keys.

### SCA Dependency Audit
**Skill**: `tooling/owasp-security-playbook/code-security-skills/skills/sca-audit/SKILL.md`
**Play**: `tooling/owasp-security-playbook/code-security-skills/plays/sca-audit.md`

Use for: npm dependency vulnerability analysis, `npm audit` triage, remediation planning.

### Web Security Review (OWASP Top 10)
**Skill**: `tooling/owasp-security-playbook/code-security-skills/skills/web-security-review/SKILL.md`
**Play**: `tooling/owasp-security-playbook/code-security-skills/plays/owasp-top10-web-review.md`

Use for: holistic OWASP Top 10 web application security review.

### Security Guidance
**Skill**: `tooling/owasp-security-playbook/code-security-skills/skills/security-guidance/SKILL.md`

Use for: general security design advice, threat modelling, secure architecture guidance.

### Securability Engineering
**Skill**: `tooling/owasp-security-playbook/code-security-skills/skills/securability-engineering/SKILL.md`
**Skill (review)**: `tooling/owasp-security-playbook/code-security-skills/skills/securability-engineering-review/SKILL.md`

Use for: secure-by-design implementation, security review of new features before build.

## Reference Data

ASVS (Application Security Verification Standard) controls:
`tooling/owasp-security-playbook/code-security-skills/data/asvs/`

FIASSE (Framework for Information and Application Security Standards Evaluation):
`tooling/owasp-security-playbook/code-security-skills/data/fiasse/`

## FDF-Specific Security Priorities

Given FDF stores personal data relating to minors, priority areas are:

1. **Authorization** — server-side enforcement, ownership checks (ASVS V4)
2. **Authentication** — credential security, session management (ASVS V2, V3)
3. **PII protection** — minimize exposure, prevent logging (ASVS V8)
4. **SQL injection** — parameterized queries (ASVS V5.3)
5. **Secrets management** — no secrets in version control (ASVS V14.2)
6. **Dependencies** — regular SCA audits (ASVS V14.1)

## How to Invoke

To perform a security review:
1. Read the relevant SKILL.md from the path above
2. Follow the procedure defined in that skill
3. Reference the plays for detailed step-by-step methodology
4. Document findings using: `tooling/owasp-security-playbook/code-security-skills/templates/finding.md`
5. Report using: `tooling/owasp-security-playbook/code-security-skills/templates/report.md`
