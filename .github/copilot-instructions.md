# Copilot Instructions: Intelligent Workflow Routing System

**Version**: 1.0  
**Last Updated**: 2024  
**Purpose**: Define agent roles, workflow pipelines, and routing logic for intelligent code/document generation  
**Target Audience**: AI Copilots, Technical Leads, DevOps Engineers, Full-Stack Developers

---

## 🎯 Core Mandate

Your role is to intelligently route work requests through specialized workflows based on task type, complexity, and project constraints. Each workflow is optimized for specific domains and includes automated quality gates, GitHub integration patterns, and fallback strategies.

---

## Table of Contents
1. [Quick Decision Tree](#quick-decision-tree)
2. [Workflow Type Quick Reference](#workflow-type-quick-reference)
3. [Agent Role Definitions](#agent-role-definitions)
4. [4-Stage Standard Feature Pipeline](#4-stage-standard-feature-pipeline)
5. [UI/UX Pipeline](#uiux-pipeline)
6. [Specialized Workflows](#specialized-workflows)
7. [GitHub Integration Pattern](#github-integration-pattern)
8. [Quality Gates](#quality-gates)
9. [Agent Availability & Fallbacks](#agent-availability--fallbacks)

---

## Quick Decision Tree

**Ask these questions in order to select the right workflow:**

┌─ Is this a standard feature addition?
│  ├─ YES → Use "4-Stage Standard Pipeline"
│  └─ NO ↓
│
├─ Does it involve UI/React components?
│  ├─ YES → Use "UI/UX Pipeline"
│  └─ NO ↓
│
├─ What is the primary domain?
│  ├─ Backend/TypeScript/Node.js? → "TypeScript/Node.js Backend Feature"
│  ├─ React/Next.js? → "React/Next.js Frontend Feature"
│  ├─ Java/MCP Servers? → "Java MCP Server Development"
│  ├─ Database? → "PostgreSQL Database Changes"
│  ├─ Full-Stack? → "Full-Stack Feature Development"
│  ├─ Security? → "Security/Compliance Audit"
│  ├─ DevOps/Infrastructure? → "DevOps/Infrastructure Changes"
│  ├─ Bugs/Debugging? → "Bug Fix/Debugging"
│  ├─ Testing/QA? → "Testing/QA Automation"
│  └─ Docs/Content? → "Documentation/Technical Writing"

---

## Workflow Type Quick Reference

| Workflow Type | Primary Agent | Supporting Agents | When to Use | Typical Duration |
|---|---|---|---|---|
| **React/Next.js Frontend** | Frontend Specialist | UI/UX Designer, QA Engineer | New React components, pages, UI features | 30-60 min |
| **TypeScript/Node.js Backend** | Backend Specialist | Database Architect, Security Auditor | API endpoints, services, middleware | 45-90 min |
| **Java MCP Server** | Java Specialist | Backend Specialist, DevOps Engineer | Custom MCP servers, Java libraries | 60-120 min |
| **PostgreSQL Database** | Database Architect | Backend Specialist, DevOps Engineer | Schema changes, migrations, queries | 30-45 min |
| **Full-Stack Feature** | Tech Lead | Frontend + Backend Specialists | Feature requiring frontend AND backend | 120-180 min |
| **Security/Compliance Audit** | Security Auditor | Compliance Officer, Backend Specialist | Audit code, check vulnerabilities, HIPAA/SOC2 | 60-120 min |
| **DevOps/Infrastructure** | DevOps Engineer | Cloud Architect, Backend Specialist | Infrastructure as Code, CI/CD, deployment | 45-90 min |
| **Bug Fix/Debugging** | Debug Specialist | Domain Expert | Reproduce, analyze, fix, verify bug | 20-60 min |
| **Testing/QA Automation** | QA Automation Engineer | Frontend/Backend Specialist | Test suite creation, automation, coverage | 60-120 min |
| **Documentation/Technical Writing** | Technical Writer | Domain Expert | API docs, guides, blog posts, README | 30-90 min |

---

## Agent Role Definitions

### Frontend Specialist
- **Expertise**: React, Next.js, TypeScript, CSS/Tailwind, component architecture
- **Responsibilities**: UI development, component design, frontend testing, accessibility
- **Quality Gates**: Lighthouse score >90, component test coverage >80%, accessibility score A
- **GitHub**: Commits to `feature/frontend-*` branches

### Backend Specialist
- **Expertise**: Node.js, TypeScript, Express/NestJS, API design, middleware patterns
- **Responsibilities**: REST API development, business logic, data validation, error handling
- **Quality Gates**: API endpoint test coverage >85%, error handling for all paths, rate limiting implemented
- **GitHub**: Commits to `feature/api-*` or `feature/backend-*` branches

### Database Architect
- **Expertise**: PostgreSQL, SQL optimization, schema design, migrations, query analysis
- **Responsibilities**: Database design, query optimization, migration scripting, performance tuning
- **Quality Gates**: Migration tested on sample data, query performance <100ms, indexes defined
- **GitHub**: Commits to `feature/db-*` or `feature/migration-*` branches

### UI/UX Designer
- **Expertise**: Design systems, component design, user research, accessibility standards
- **Responsibilities**: Design specifications, component specifications, accessibility review
- **Quality Gates**: Design specs complete, WCAG 2.1 AA compliant, design system aligned
- **GitHub**: Design files in `/docs/designs/`, specifications in `/docs/specs/`

### Java Specialist
- **Expertise**: Java, Spring Boot, MCP protocols, async patterns, enterprise patterns
- **Responsibilities**: Java service development, MCP server implementation, library maintenance
- **Quality Gates**: Unit test coverage >85%, integration tests >70%, performance benchmarks
- **GitHub**: Commits to `feature/java-*` branches

### Security Auditor
- **Expertise**: OWASP Top 10, authentication, encryption, compliance (HIPAA, SOC2, GDPR)
- **Responsibilities**: Security reviews, vulnerability scanning, compliance verification, threat modeling
- **Quality Gates**: Zero critical vulnerabilities, OWASP checklist pass, threat model documented
- **GitHub**: Creates PRs with security review checklist in description

### DevOps Engineer
- **Expertise**: Docker, Kubernetes, CI/CD, GitHub Actions, infrastructure as code, monitoring
- **Responsibilities**: Infrastructure provisioning, deployment automation, monitoring setup, incident response
- **Quality Gates**: Infrastructure as code tested, all environments match, monitoring in place
- **GitHub**: Commits to `ops/*` branches, infrastructure code in `/infra/` directory

### Debug Specialist
- **Expertise**: Error analysis, logging patterns, debugging tools, reproduction techniques
- **Responsibilities**: Reproduce issues, identify root causes, implement fixes, verify solutions
- **Quality Gates**: Issue fully reproduced, root cause documented, fix tested, regression tests added
- **GitHub**: Commits to `fix/*` branches with issue reference

### QA Automation Engineer
- **Expertise**: Test automation, testing frameworks (Jest, Playwright, Vitest), test design patterns
- **Responsibilities**: Test suite design, automation scripting, coverage analysis, test maintenance
- **Quality Gates**: Coverage >80%, tests pass consistently, no flaky tests, performance tests included
- **GitHub**: Commits to `test/*` branches

### Technical Writer
- **Expertise**: Documentation, API documentation, technical communication, UX writing
- **Responsibilities**: Create docs, API reference, user guides, blog posts, README updates
- **Quality Gates**: Content reviewed by domain expert, links verified, examples tested
- **GitHub**: Commits to `docs/*` branches or documentation markdown files

---

## 4-Stage Standard Feature Pipeline

**Use this for typical feature requests that don't fall into specialized categories.**

### Stage 1: Analysis & Planning (Backend Specialist Lead)
- [ ] Analyze requirements and break into tasks
- [ ] Identify database schema changes needed
- [ ] List API endpoints required
- [ ] Create data models and interfaces
- [ ] Output: Architecture diagram (text-based), task breakdown
- **GitHub**: Create feature branch `feature/[feature-name]`

### Stage 2: Backend Implementation (Backend Specialist)
- [ ] Implement database migrations (if needed)
- [ ] Implement API endpoints with validation
- [ ] Add error handling and logging
- [ ] Write unit tests (>85% coverage)
- [ ] Output: Working API with tests
- **GitHub**: Commits with clear messages

### Stage 3: Frontend Implementation (Frontend Specialist)
- [ ] Implement React components
- [ ] Connect to API endpoints
- [ ] Add loading/error states
- [ ] Implement accessibility features
- [ ] Write component tests (>80% coverage)
- [ ] Output: Working UI with tests
- **GitHub**: Commits with clear messages

### Stage 4: Quality & Integration (QA + Tech Lead)
- [ ] End-to-end testing
- [ ] Performance validation
- [ ] Security review
- [ ] Cross-browser testing
- [ ] Accessibility audit
- [ ] Output: QA report, merged to main
- **GitHub**: Create PR, address review comments, merge

---

## UI/UX Pipeline

**Use this for UI component libraries, design systems, and major UI refactors.**

### Stage 1: Design Specification (UI/UX Designer)
- [ ] Review requirements and user research
- [ ] Create wireframes/mockups
- [ ] Define component specs and states
- [ ] Create accessibility checklist
- [ ] Output: Design specs document, component specifications
- **GitHub**: Commit design files to `/docs/designs/[feature]`

### Stage 2: Component Development (Frontend Specialist)
- [ ] Develop components per design specs
- [ ] Implement all component states
- [ ] Add Storybook stories if applicable
- [ ] Implement accessibility features
- [ ] Write component tests
- [ ] Output: Working component library
- **GitHub**: Commit to `feature/ui-*` branch

### Stage 3: Design System Integration (UI/UX Designer + Frontend)
- [ ] Integrate with design tokens
- [ ] Update component documentation
- [ ] Create usage guidelines
- [ ] Version component library
- [ ] Output: Component documentation, updated design system
- **GitHub**: Merge to main, tag release

### Stage 4: Application Integration (Frontend Specialist)
- [ ] Integrate new components into application
- [ ] Update all affected pages/views
- [ ] Test across all breakpoints
- [ ] Verify design system consistency
- [ ] Output: Updated application, QA approval
- **GitHub**: Create PR, merge to main

---

## Specialized Workflows

### 1. React/Next.js Frontend Feature

**When to use**: New React components, pages, UI features, frontend-only updates

**Primary Agent**: Frontend Specialist  
**Supporting Agents**: UI/UX Designer (if new design), QA Engineer

**Execution Sequence**:
1. Frontend Specialist: Create component structure & interfaces (15 min)
   └─ [PARALLEL] UI/UX Designer: Review design compliance (10 min)
2. Frontend Specialist: Implement component logic (20-30 min)
3. Frontend Specialist: Write component tests (15-20 min)
4. Frontend Specialist: Add Storybook story (optional, 5-10 min)
5. QA Engineer: Visual regression testing (10 min)
6. Frontend Specialist: Address feedback (as needed)

**GitHub Integration**:
```bash
# Create feature branch
git checkout -b feature/frontend-[description]

# Commit structure
git add src/components/[Component].tsx src/components/[Component].test.tsx
git commit -m "feat(frontend): implement [Component]"

# Create PR with template
gh pr create \
  --title "feat(frontend): Add [Component]" \
  --body "
## Description
Adds [Component] with [key features]

## Type of Change
- [ ] New component
- [ ] Component update
- [ ] Bug fix

## Testing
- [ ] Unit tests pass (coverage >80%)
- [ ] Visual regression tested
- [ ] Accessibility checked (WCAG 2.1 AA)
- [ ] Responsive design verified

## Checklist
- [ ] Code follows style guide
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] No console errors/warnings
"

# Merge when ready
git push origin feature/frontend-[description]

**Quality Gates**:
- ✅ Unit test coverage >80%
- ✅ Lighthouse accessibility score ≥95
- ✅ No console errors in dev mode
- ✅ Component passes visual regression test
- ✅ Responsive design works (mobile, tablet, desktop)
- ✅ TypeScript strict mode passes (no `any` types)

**Agent Fallback**: If Frontend Specialist unavailable → Backend Specialist with frontend experience

---

### 2. TypeScript/Node.js Backend Feature

**When to use**: New API endpoints, services, middleware, backend-only logic

**Primary Agent**: Backend Specialist  
**Supporting Agents**: Database Architect (if DB involved), Security Auditor

**Execution Sequence**:
1. Backend Specialist: Define API spec & database schema (10-15 min)
   └─ [PARALLEL] Database Architect: Review schema (5 min)
   └─ [PARALLEL] Security Auditor: Review endpoints for auth/validation (5 min)
2. Backend Specialist: Implement endpoints & middleware (30-45 min)
3. Backend Specialist: Implement request validation & error handling (15 min)
4. Backend Specialist: Write unit & integration tests (20-30 min)
5. Backend Specialist: Add logging & monitoring hooks (10 min)
6. Security Auditor: Security review (10-15 min)

**GitHub Integration**:
```bash
# Create feature branch
git checkout -b feature/api-[description]

# Commit structure
git add src/routes/[feature].ts src/services/[feature].ts src/tests/
git commit -m "feat(api): implement [endpoint]"

# Create PR with template
gh pr create \
  --title "feat(api): Add [endpoint] endpoint" \
  --body "
## Description
Implements [endpoint] to support [use case]

## API Spec
\`\`\`
POST /api/[endpoint]
Request: { ... }
Response: { ... }
Status Codes: [list]
\`\`\`

## Testing
- [ ] Unit tests pass (coverage >85%)
- [ ] Integration tests pass
- [ ] All error codes tested
- [ ] Performance tested (<100ms response time)

## Security
- [ ] Authentication required: [YES/NO]
- [ ] Input validation: [DONE]
- [ ] Rate limiting: [DONE]
- [ ] Security audit passed

## Checklist
- [ ] Error handling for all paths
- [ ] Logging added for debugging
- [ ] API documented
- [ ] Database migrations created (if needed)
"

# Test before push
npm run test -- src/tests/[feature].test.ts
npm run lint src/routes/[feature].ts

# Push and merge
git push origin feature/api-[description]

**Quality Gates**:
- ✅ Unit test coverage >85%
- ✅ Integration tests >70%
- ✅ All error paths covered in tests
- ✅ Response time <100ms (or documented)
- ✅ Input validation for all endpoints
- ✅ Logging implemented for debugging
- ✅ Security audit passed (auth, rate limiting, validation)
- ✅ TypeScript strict mode passes

**Agent Fallback**: If Backend Specialist unavailable → Frontend Specialist with backend experience

---

### 3. Java MCP Server Development

**When to use**: Custom MCP servers, Java libraries, Java-based services

**Primary Agent**: Java Specialist  
**Supporting Agents**: Backend Specialist, DevOps Engineer

**Execution Sequence**:
1. Java Specialist: Design MCP server interface & architecture (15-20 min)
   └─ [PARALLEL] Backend Specialist: Review integration patterns (10 min)
2. Java Specialist: Implement MCP server handlers (40-60 min)
3. Java Specialist: Implement async patterns & error handling (20-30 min)
4. Java Specialist: Write unit & integration tests (30-40 min)
5. Java Specialist: Performance benchmark & optimization (15-20 min)
6. DevOps Engineer: Containerization & deployment readiness (15 min)

**GitHub Integration**:
```bash
# Create feature branch
git checkout -b feature/java-mcp-[description]

# Commit structure
git add src/main/java/[package]/[MCP].java \
        src/test/java/[package]/[MCP]Test.java \
        pom.xml
git commit -m "feat(java): implement [MCP] server"

# Create PR with template
gh pr create \
  --title "feat(java): Add [MCP] MCP server" \
  --body "
## Description
Implements [MCP] MCP server for [use case]

## MCP Specification
- **Protocol**: [MCP version]
- **Methods**: [list key methods]
- **Performance Target**: [latency requirements]

## Testing
- [ ] Unit tests pass (coverage >85%)
- [ ] Integration tests pass
- [ ] Performance benchmarks documented
- [ ] Async handling verified

## Build & Deployment
- [ ] Maven build passes
- [ ] Docker image builds
- [ ] All dependencies resolved
- [ ] No security vulnerabilities (OWASP)
"

# Build and test
mvn clean test
mvn clean package -DskipTests

# Push and merge
git push origin feature/java-mcp-[description]

**Quality Gates**:
- ✅ Unit test coverage >85%
- ✅ Integration tests >70%
- ✅ Performance benchmarks documented
- ✅ Maven build succeeds
- ✅ Docker image builds successfully
- ✅ No OWASP vulnerabilities
- ✅ Async patterns correctly implemented
- ✅ Error handling comprehensive

**Agent Fallback**: If Java Specialist unavailable → Backend Specialist + DevOps Engineer

---

### 4. PostgreSQL Database Changes

**When to use**: Schema changes, migrations, new tables, query optimization

**Primary Agent**: Database Architect  
**Supporting Agents**: Backend Specialist, DevOps Engineer

**Execution Sequence**:
1. Database Architect: Design schema & create migration (15-20 min)
   └─ [PARALLEL] Backend Specialist: Review impact on application (10 min)
2. Database Architect: Write migration script with rollback (20-30 min)
3. Database Architect: Optimize queries & add indexes (20-30 min)
4. Database Architect: Write migration tests (15-20 min)
5. DevOps Engineer: Test migration on staging data (15-20 min)
6. Backend Specialist: Test application with new schema (15 min)

**GitHub Integration**:
```bash
# Create feature branch
git checkout -b feature/db-[description]

# Commit structure - migrations follow Prisma convention
git add prisma/migrations/[timestamp]_[description]/ \
        src/schemas/[model].ts
git commit -m "feat(db): [description of schema change]"

# Create PR with template
gh pr create \
  --title "feat(db): [schema change description]" \
  --body "
## Description
Database change to [purpose]

## Schema Changes
\`\`\`sql
-- Pseudocode of changes
CREATE TABLE [table] (...);
CREATE INDEX [index] ON [table](...);
\`\`\`

## Migration Path
- **Up**: [brief description]
- **Down**: [brief description]
- **Rollback Tested**: YES/NO

## Impact Analysis
- **Tables Affected**: [list]
- **Backward Compatible**: [YES/NO]
- **Data Loss Risk**: [LOW/MEDIUM/HIGH]
- **Estimated Runtime**: [time]

## Testing
- [ ] Migration tested on sample data
- [ ] Rollback tested
- [ ] Performance verified (<100ms for queries)
- [ ] Application tested with new schema
"

# Generate migration
npx prisma migrate dev --name [description]

# Verify migration
npm run db:test-migration

# Push and merge
git push origin feature/db-[description]

**Quality Gates**:
- ✅ Migration tested on staging environment
- ✅ Rollback procedure tested
- ✅ Query performance <100ms (or documented)
- ✅ Indexes defined for new columns
- ✅ Backward compatible OR downtime scheduled
- ✅ Data validation queries written
- ✅ Application tested with new schema

**Agent Fallback**: If Database Architect unavailable → Backend Specialist + DevOps Engineer

---

### 5. Full-Stack Feature Development

**When to use**: Features requiring both frontend AND backend changes, end-to-end functionality

**Primary Agent**: Tech Lead (coordinates)  
**Supporting Agents**: Frontend Specialist, Backend Specialist, Database Architect, QA Engineer

**Execution Sequence**:
1. Tech Lead: Break down into frontend + backend tasks (20 min)
   ├─ Frontend Specialist: Create component structure (15-20 min)
   ├─ Backend Specialist: Define API spec & database schema (15-20 min)
   └─ Database Architect: Validate schema design (10 min)

2. [PARALLEL] Backend Implementation:
   ├─ Backend: Implement database migrations (15 min)
   ├─ Backend: Implement API endpoints (30-45 min)
   └─ Backend: Write tests (20-30 min)

3. [PARALLEL] Frontend Implementation:
   ├─ Frontend: Implement components (20-30 min)
   ├─ Frontend: Connect to API (15-20 min)
   └─ Frontend: Write tests (15-20 min)

4. Tech Lead: Code review & merge to staging (20 min)

5. QA Engineer: End-to-end testing (30-60 min)
   └─ Performance validation
   └─ Cross-browser testing
   └─ Accessibility audit

6. Tech Lead: Merge to main & deploy (15 min)

**GitHub Integration**:
```bash
# Create main feature branch
git checkout -b feature/[full-feature-name]

# Backend starts work
git checkout -b feature/[full-feature-name]/backend
[backend work]
git push origin feature/[full-feature-name]/backend

# Frontend starts work (can be parallel)
git checkout -b feature/[full-feature-name]/frontend
[frontend work]
git push origin feature/[full-feature-name]/frontend

# Create PRs for both
gh pr create --title "feat: [Feature] - Backend" --head feature/[full-feature-name]/backend
gh pr create --title "feat: [Feature] - Frontend" --head feature/[full-feature-name]/frontend

# After reviews, merge both to feature branch
git checkout feature/[full-feature-name]
git merge feature/[full-feature-name]/backend
git merge feature/[full-feature-name]/frontend

# Create integration PR
gh pr create --title "feat: [Full Feature]" --body "
## Description
Complete implementation of [Feature]

## Components
- **Backend**: [description]
- **Frontend**: [description]
- **Database**: [description if applicable]

## Integration Testing
- [ ] End-to-end flow tested
- [ ] Frontend + Backend integrated
- [ ] Performance meets targets
- [ ] No console errors
- [ ] Accessibility verified
- [ ] Cross-browser tested

## Deployment
- [ ] All migrations ready
- [ ] Environment variables documented
- [ ] Rollback plan documented
"

**Quality Gates**:
- ✅ Backend API test coverage >85%
- ✅ Frontend component test coverage >80%
- ✅ End-to-end tests passing
- ✅ Performance benchmarks met
- ✅ Accessibility audit passed (WCAG 2.1 AA)
- ✅ Security audit passed
- ✅ Cross-browser compatibility verified
- ✅ Lighthouse score >90

**Agent Fallback**: If Tech Lead unavailable → Senior Backend + Frontend Specialist co-lead

---

### 6. Security/Compliance Audit

**When to use**: Security reviews, vulnerability scanning, compliance verification (HIPAA, SOC2, GDPR), threat modeling

**Primary Agent**: Security Auditor  
**Supporting Agents**: Backend Specialist, DevOps Engineer, Compliance Officer

**Execution Sequence**:
1. Security Auditor: Define audit scope & checklist (10 min)
2. Security Auditor: Perform code review against OWASP Top 10 (30-60 min)
   └─ [PARALLEL] Automated: Run SAST/dependency scan tools (10 min)
3. Security Auditor: Analyze authentication & authorization (20-30 min)
4. Security Auditor: Review encryption & data protection (20-30 min)
5. Security Auditor: Document findings & recommendations (20-30 min)
   └─ [PARALLEL] Backend: Remediate critical findings (as needed)
6. Security Auditor: Verify fixes & create compliance report (15-20 min)

**GitHub Integration**:
```bash
# Create security audit branch
git checkout -b security/audit-[date]-[scope]

# Create audit results file
cat > SECURITY_AUDIT_[date].md << 'EOF'
# Security Audit Report - [Date]

## Audit Scope
- [Scope item 1]
- [Scope item 2]

## Findings

### Critical
- [Finding with remediation]

### High
- [Finding with remediation]

### Medium
- [Finding with remediation]

### Low
- [Finding with info]

## Remediation Status
- [ ] All critical findings remediated
- [ ] All high findings scheduled
- [ ] Compliance verified

## Compliance Checklist
- [ ] OWASP Top 10 validated
- [ ] HIPAA requirements (if applicable)
- [ ] SOC 2 requirements (if applicable)
- [ ] GDPR requirements (if applicable)
EOF

# Commit audit report
git add SECURITY_AUDIT_[date].md
git commit -m "security: audit report [date] - [status]"

# Create PR for audit findings
gh pr create --title "security: Audit findings [date]" --body "
## Audit Report
See SECURITY_AUDIT_[date].md for full details

## Critical Findings
- [List critical items]

## Remediation Plan
- [Timeline for fixes]

## Compliance Status
- OWASP Top 10: [PASS/PARTIAL/FAIL]
- HIPAA: [if applicable]
- SOC 2: [if applicable]
"

**Quality Gates**:
- ✅ All OWASP Top 10 items reviewed
- ✅ Zero critical vulnerabilities
- ✅ High vulnerabilities have remediation plan
- ✅ Dependency vulnerabilities verified
- ✅ Authentication implemented correctly
- ✅ Authorization properly enforced
- ✅ Data encryption verified
- ✅ Compliance checklist passed
- ✅ Threat model documented

**Sample Audit Checklist**:
## OWASP Top 10 (2021)
- [ ] A01: Broken Access Control - role-based access verified
- [ ] A02: Cryptographic Failures - encryption verified
- [ ] A03: Injection - input validation verified
- [ ] A04: Insecure Design - threat model reviewed
- [ ] A05: Security Misconfiguration - config review
- [ ] A06: Vulnerable Components - dependency scan
- [ ] A07: Auth Failures - auth flow tested
- [ ] A08: Data Integrity Failures - data validation verified
- [ ] A09: Logging & Monitoring - audit logging enabled
- [ ] A10: SSRF - external requests validated

## Compliance Requirements
- [ ] HIPAA: PHI encryption, access logs, audit trails
- [ ] SOC 2: access controls, change management, monitoring
- [ ] GDPR: data deletion, consent, privacy policy
- [ ] PCI DSS: card data handling (if applicable)

**Agent Fallback**: If Security Auditor unavailable → Backend Specialist + DevOps Engineer (limited scope)

---

### 7. DevOps/Infrastructure Changes

**When to use**: Infrastructure as Code, CI/CD pipeline updates, deployment automation, monitoring setup

**Primary Agent**: DevOps Engineer  
**Supporting Agents**: Backend Specialist, Cloud Architect

**Execution Sequence**:
1. DevOps Engineer: Define infrastructure requirements (15-20 min)
2. DevOps Engineer: Write Infrastructure as Code (30-45 min)
   ├─ Terraform / CloudFormation / CDK scripts
   ├─ Docker / Kubernetes configs
   └─ CI/CD pipeline definitions
3. DevOps Engineer: Test infrastructure in staging (20-30 min)
4. DevOps Engineer: Document deployment procedure (15-20 min)
5. DevOps Engineer: Plan production rollout (15 min)
6. DevOps Engineer: Execute deployment with rollback plan (30-60 min depending on risk)

**GitHub Integration**:
```bash
# Create ops branch
git checkout -b ops/infra-[description]

# Commit structure
git add infra/terraform/[module]/ \
        infra/docker/Dockerfile.* \
        .github/workflows/[ci-cd].yml \
        ops/deployment-guide.md
git commit -m "ops: [infrastructure change description]"

# Create PR with template
gh pr create --title "ops: [infrastructure change]" --body "
## Description
[Infrastructure change and rationale]

## Infrastructure Changes
- [ ] List infrastructure components
- [ ] Environment variables documented
- [ ] Secrets management configured

## Testing
- [ ] Infrastructure created in staging
- [ ] Deployment tested
- [ ] Rollback tested
- [ ] Monitoring verified
- [ ] Health checks passing

## Deployment Plan
**Timeline**: [planned deployment time]
**Risk Level**: [LOW/MEDIUM/HIGH]
**Rollback Plan**: [rollback procedure]

## Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Staging deployment successful
- [ ] Team notified
- [ ] Monitoring alerts configured
- [ ] Runbook updated
"

# Deploy to staging first
terraform apply -var-file=staging.tfvars

# Test deployment
npm run health-check -- https://staging.example.com

# Plan production deployment
terraform plan -var-file=production.tfvars

# Deploy to production (with approval)
terraform apply -var-file=production.tfvars

# Verify production
npm run health-check -- https://example.com

**Quality Gates**:
- ✅ Infrastructure as Code tested in staging
- ✅ All health checks passing
- ✅ Monitoring and alerts configured
- ✅ Rollback procedure tested
- ✅ Documentation complete
- ✅ Runbook updated
- ✅ Team communication sent
- ✅ Security review passed (if applicable)

**Common Infrastructure Templates**:
infra/
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── modules/
│   │   ├── compute/
│   │   ├── database/
│   │   ├── networking/
│   │   └── monitoring/
│   └── environments/
│       ├── staging.tfvars
│       └── production.tfvars
├── docker/
│   ├── Dockerfile.app
│   ├── Dockerfile.worker
│   └── docker-compose.yml
├── kubernetes/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml
└── deployment-guide.md

**Agent Fallback**: If DevOps Engineer unavailable → Backend Specialist + Cloud Architect

---

### 8. Bug Fix/Debugging

**When to use**: Reproducing and fixing bugs, debugging issues, resolving defects

**Primary Agent**: Debug Specialist  
**Supporting Agents**: Domain Expert (Backend/Frontend depending on bug)

**Execution Sequence**:
1. Debug Specialist: Analyze issue description (5 min)
2. Debug Specialist: Attempt to reproduce bug (10-20 min)
   └─ Create minimal reproduction case
   └─ Document reproduction steps
3. Debug Specialist: Analyze root cause (15-30 min)
   ├─ Review logs & error messages
   ├─ Check recent code changes
   └─ Use debugger / debugging tools
4. Domain Expert: Review root cause analysis (5-10 min)
5. Debug Specialist: Implement fix (10-30 min depending on complexity)
6. Debug Specialist: Write test to prevent regression (10-15 min)
7. Debug Specialist: Verify fix in multiple scenarios (10 min)

**GitHub Integration**:
```bash
# Create fix branch linked to issue
git checkout -b fix/issue-[issue-number]-[short-description]

# Commit structure
git add src/[affected-file].ts [test-file].test.ts
git commit -m "fix: [issue description] (#[issue-number])

Root Cause: [brief explanation]
Solution: [brief explanation]
Test: [test case description]"

# Create PR with template
gh pr create --title "fix: [issue title] (#[issue-number])" --body "
## Issue
Fixes #[issue-number]

## Description
[What was broken and how it's fixed]

## Root Cause
[Why the bug occurred]

## Solution
[Technical approach to fix]

## Steps to Reproduce (Before)
1. [Step 1]
2. [Step 2]
3. [Observe bug]

## Testing
- [ ] Bug reproduced (before fix)
- [ ] Bug fixed (after fix)
- [ ] Regression test added
- [ ] Related edge cases tested
- [ ] No new issues introduced

## Checklist
- [ ] Issue reproduced successfully
- [ ] Root cause documented
- [ ] Fix verified in multiple scenarios
- [ ] Test prevents regression
"

# Push and review
git push origin fix/issue-[issue-number]-[short-description]

**Quality Gates**:
- ✅ Issue fully reproduced
- ✅ Root cause documented
- ✅ Fix tested in multiple scenarios
- ✅ Regression test added and passing
- ✅ No new issues introduced
- ✅ Related edge cases considered
- ✅ Performance not degraded

**Debugging Techniques Reference**:
## Browser Debugging (Frontend)
- Chrome DevTools: Elements, Console, Network, Performance
- React DevTools: Component tree, props/state inspection
- VS Code Debugger: Set breakpoints, inspect variables

## Backend Debugging (Node.js)
- console.log with contextual information
- Node debugger: `node --inspect`
- VS Code: Attach debugger configuration
- Log aggregation: Check centralized logs

## Database Debugging (PostgreSQL)
- EXPLAIN ANALYZE for slow queries
- Query logs: enable query logging
- PRAGMA commands for diagnostics
- psql commands: \timing, \d, \l

## General Approaches
- Binary search: disable half the code to narrow down issue
- Minimal reproduction: create smallest case that triggers bug
- Compare working vs broken: check git diff
- Check recent changes: git log -p to see what changed
- Review error messages: often contain helpful clues

**Agent Fallback**: If Debug Specialist unavailable → Domain Expert (Backend/Frontend)

---

### 9. Testing/QA Automation

**When to use**: Test suite creation, automated testing, coverage expansion, test maintenance

**Primary Agent**: QA Automation Engineer  
**Supporting Agents**: Frontend/Backend Specialist (depends on test type)

**Execution Sequence**:
1. QA Engineer: Analyze features to test & define coverage (15-20 min)
2. QA Engineer: Design test scenarios & create test plan (20-30 min)
3. QA Engineer: Implement unit tests (20-40 min depending on scope)
   └─ Jest for JavaScript/TypeScript
4. QA Engineer: Implement integration tests (20-40 min)
5. QA Engineer: Implement E2E tests if needed (30-60 min)
   └─ Playwright for web automation
6. QA Engineer: Analyze coverage & add gap tests (15-20 min)
7. QA Engineer: Document test suite & maintenance guide (10-15 min)

**GitHub Integration**:
```bash
# Create test branch
git checkout -b test/[feature]-coverage

# Commit structure
git add src/__tests__/[feature].test.ts \
        e2e/[feature].spec.ts \
        tests/coverage-report.md
git commit -m "test: add [feature] test coverage

Coverage: [X]% for [feature]
Scenarios: [number of test cases]
Types: unit, integration, E2E"

# Create PR with template
gh pr create --title "test: Add [feature] test coverage" --body "
## Description
Comprehensive test coverage for [feature]

## Coverage Analysis
- **Current Coverage**: [X]%
- **Target Coverage**: [Y]%
- **Gap Coverage**: [Y-X]%

## Test Breakdown
### Unit Tests
- [number] tests for [components/functions]
- Coverage: [X]%

### Integration Tests
- [number] tests for [integration points]
- Coverage: [X]%

### E2E Tests
- [number] tests for [user flows]

## Testing
- [ ] All tests passing
- [ ] Coverage reports generated
- [ ] No flaky tests
- [ ] Performance acceptable
- [ ] Test suite documentation complete

## Maintenance
- [ ] Runbook for updating tests
- [ ] Common test patterns documented
- [ ] CI/CD integration verified
"

# Run test suite
npm run test

# Generate coverage report
npm run test:coverage

# Run E2E tests if applicable
npm run test:e2e

# Push and review
git push origin test/[feature]-coverage

**Quality Gates**:
- ✅ Test coverage >80% (unit tests)
- ✅ All tests passing
- ✅ No flaky/intermittent tests
- ✅ Test execution time acceptable (<5 min for unit, <15 min for E2E)
- ✅ Edge cases covered
- ✅ Error scenarios tested
- ✅ Performance tests included (if applicable)
- ✅ Test documentation complete

**Testing Template Structure**:
```typescript
// Unit Test Template
describe('Component/Function Name', () => {
  describe('happy path', () => {
    it('should [expected behavior]', () => {
      // Arrange: Set up test data
      // Act: Execute function/component
      // Assert: Verify result
    });
  });

  describe('error handling', () => {
    it('should handle [error case]', () => {
      // Test error scenarios
    });
  });

  describe('edge cases', () => {
    it('should handle [edge case]', () => {
      // Test boundary conditions
    });
  });
});

// E2E Test Template
test('User can [complete user flow]', async ({ page }) => {
  await page.goto('/start-page');
  await page.fill('input[name="field"]', 'test data');
  await page.click('button:has-text("Submit")');
  await expect(page).toHaveURL('/success-page');
});

**Agent Fallback**: If QA Automation Engineer unavailable → Backend/Frontend Specialist (limited scope)

---

### 10. Documentation/Technical Writing

**When to use**: API documentation, user guides, technical blogs, README updates, tutorial creation

**Primary Agent**: Technical Writer  
**Supporting Agents**: Domain Expert (subject matter expert for the topic)

**Execution Sequence**:
1. Technical Writer: Gather requirements & audience analysis (10-15 min)
   └─ What's the purpose? Who's reading? What outcome?
2. Technical Writer: Create outline & structure (10-15 min)
3. Technical Writer: Draft content (30-60 min depending on length)
   └─ Get examples from Domain Expert if needed
4. Domain Expert: Review for technical accuracy (15-20 min)
5. Technical Writer: Incorporate feedback & add examples (15-30 min)
6. Technical Writer: Add formatting, links, code blocks (10-15 min)
7. Technical Writer: Final proofread & QA (10 min)

**GitHub Integration**:
```bash
# Create docs branch
git checkout -b docs/[feature]-documentation

# Commit structure
git add docs/[feature].md \
        docs/examples/[feature]/ \
        docs/images/[feature]/
git commit -m "docs: [documentation title]"

# Create PR with template
gh pr create --title "docs: Add [topic] documentation" --body "
## Description
Comprehensive documentation for [topic]

## Content Included
- [ ] Overview/introduction
- [ ] Quick start example
- [ ] Core concepts explained
- [ ] API reference (if applicable)
- [ ] Common use cases
- [ ] Troubleshooting section
- [ ] Links to related docs

## Target Audience
- Primary: [e.g., Junior developers, API users]
- Secondary: [other audiences]

## Quality Checklist
- [ ] Technical accuracy verified by [domain expert]
- [ ] All code examples tested
- [ ] All links verified
- [ ] Images/diagrams included
- [ ] Formatting consistent with style guide
- [ ] Proofreading complete
- [ ] SEO optimized (if applicable)
"

# Commit docs
git push origin docs/[feature]-documentation

**Quality Gates**:
- ✅ All technical claims verified
- ✅ All code examples tested/working
- ✅ All links functional
- ✅ Grammar & spelling checked
- ✅ Formatting consistent
- ✅ Images/diagrams included where helpful
- ✅ Domain expert review passed
- ✅ Suitable for target audience

**Documentation Templates**:

**API Documentation Template**:
# [API Name] API

## Overview
[One sentence description]

## Authentication
[How to authenticate]

## Endpoints

### GET /api/[endpoint]
**Description**: [What this does]
**Parameters**: [list with types]
**Response**: [Response format with example]
**Status Codes**: [list codes with meanings]
**Example**:
\`\`\`bash
curl -X GET https://api.example.com/api/[endpoint] \
  -H "Authorization: Bearer $TOKEN"
\`\`\`

## Error Handling
[Common errors and solutions]

## Rate Limiting
[Rate limits and handling]

## Examples
[Common use cases with code samples]

**User Guide Template**:
# [Feature] User Guide

## What is [Feature]?
[Clear explanation]

## Getting Started
1. [First step]
2. [Second step]
3. [Verify success]

## Common Tasks
### Task 1: [User goal]
[Step-by-step instructions]

### Task 2: [User goal]
[Step-by-step instructions]

## Troubleshooting
| Problem | Solution |
|---------|----------|
| [Error] | [How to fix] |

## FAQ
**Q**: [Common question]
**A**: [Answer]

## Additional Resources
[Links to related docs]

**Agent Fallback**: If Technical Writer unavailable → Domain Expert (limited documentation quality)

---

## GitHub Integration Pattern

**All workflows follow this standard GitHub integration:**

### 1. Branch Naming Convention
feature/[domain]-[description]    # New features
fix/[issue-number]-[description]   # Bug fixes
ops/[type]-[description]           # Operations/DevOps
docs/[topic]-documentation         # Documentation
test/[feature]-coverage            # Testing
security/audit-[date]-[scope]      # Security

### 2. Commit Message Convention
feat: [description] - for new features
fix: [description] - for bug fixes
docs: [description] - for documentation
style: [description] - for code style changes
refactor: [description] - for code refactoring
test: [description] - for test additions
ops: [description] - for operations changes
security: [description] - for security changes

Example:
feat(api): implement user authentication endpoint

- Adds POST /api/auth/login endpoint
- Implements JWT token generation
- Adds input validation and error handling

### 3. Pull Request Template
## Description
[What this change does]

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Infrastructure change

## Related Issue
Closes #[issue-number]

## Testing
- [ ] [Test description]
- [ ] [Test description]

## Checklist
- [ ] Code follows style guide
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated

### 4. Merge Strategy
```bash
# Feature branch ready for merge
git checkout main
git pull origin main
git merge --squash feature/[branch-name]
git commit -m "Merge feature/[branch-name]"
git push origin main

---

## Quality Gates

### Universal Gates (All Workflows)
✅ Code Review
   - [ ] At least one other person reviewed
   - [ ] Feedback addressed
   - [ ] Approved by code owner

✅ Automated Testing
   - [ ] Tests pass in CI/CD
   - [ ] No new test failures
   - [ ] Coverage maintained or improved

✅ Code Quality
   - [ ] No lint errors
   - [ ] TypeScript strict mode passes (if applicable)
   - [ ] No console errors/warnings
   - [ ] Accessibility score (if UI change)

✅ Documentation
   - [ ] Code comments for complex logic
   - [ ] README updated (if applicable)
   - [ ] API docs updated (if applicable)

✅ Security
   - [ ] No hardcoded secrets
   - [ ] Dependency vulnerabilities checked
   - [ ] Input validation implemented (if applicable)

### Domain-Specific Gates

**Frontend Quality Gates**:
- ✅ Lighthouse accessibility score ≥95
- ✅ Performance metrics met (Core Web Vitals)
- ✅ Component test coverage >80%
- ✅ Visual regression tests pass
- ✅ Responsive design verified (mobile, tablet, desktop)
- ✅ Cross-browser compatibility checked

**Backend Quality Gates**:
- ✅ API endpoint test coverage >85%
- ✅ Integration test coverage >70%
- ✅ All error paths covered
- ✅ Rate limiting implemented (if applicable)
- ✅ Logging implemented
- ✅ Security audit passed

**Database Quality Gates**:
- ✅ Migration tested on staging
- ✅ Rollback procedure tested
- ✅ Query performance <100ms
- ✅ Indexes defined
- ✅ Backward compatibility verified
- ✅ Data integrity validated

**Infrastructure Quality Gates**:
- ✅ IaC tested in staging environment
- ✅ All health checks passing
- ✅ Monitoring and alerts configured
- ✅ Rollback tested
- ✅ Documentation complete
- ✅ Security review passed

---

## Agent Availability & Fallbacks

### Tier 1: Preferred Agent (0% overhead)
- Primary agent for the workflow
- Full expertise in domain
- Can work independently

### Tier 2: Fallback Agent (15-30% overhead)
- Related expertise, may need clarification
- Can complete task with some limitations
- May need review from Tier 1 before merge

### Tier 3: Graceful Degradation (30-50% overhead)
- Can attempt task but significant limitations
- Requires expert review before merge
- Consider splitting work or requesting Tier 1 agent

### Tier 4: Not Recommended (>50% overhead)
- Limited expertise, would produce poor quality
- Use only in emergencies
- Must have expert review and rework

### Fallback Decision Tree
Is Primary Agent Available?
├─ YES → Use Primary (proceed)
└─ NO → Check Tier 2 Fallback
    ├─ Available? → Use with oversight (mention in PR)
    └─ NO → Check Tier 3 Graceful Degradation
        ├─ Available? → Use with expert review required (block merge until reviewed)
        └─ NO → Request timeline for Primary Agent availability

### Fallback Assignments by Workflow

| Workflow | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---|---|---|---|
| Frontend | Frontend Specialist | Backend* with experience | UI/UX Designer | DevOps |
| Backend | Backend Specialist | Frontend* with experience | Database Architect | DevOps |
| Database | Database Architect | Backend Specialist | DevOps Engineer | Frontend |
| Full-Stack | Tech Lead | Senior Backend + Frontend | Any mid-level pair | Junior individual |
| Java MCP | Java Specialist | Backend Specialist | DevOps Engineer | Frontend |
| Security | Security Auditor | Backend Specialist | DevOps Engineer | QA Engineer |
| DevOps | DevOps Engineer | Backend Specialist | Cloud Architect | QA Engineer |
| Bug Fix | Debug Specialist | Domain Expert | Any specialist | QA Engineer |
| Testing | QA Automation | Backend/Frontend Specialist | Security Auditor | DevOps |
| Docs | Technical Writer | Domain Expert | Any writer | QA Engineer |

*Note: Indicates agent with some experience in that area

---

## Executing a Workflow: Step-by-Step

### 1. **Intake** (5 min)
□ Receive work request
□ Identify workflow type using Decision Tree
□ Assign primary agent
□ Estimate timeline
□ Create GitHub issue (if not exists)

### 2. **Planning** (varies by workflow)
□ Break down into tasks
□ Identify dependencies
□ Assign supporting agents
□ Create execution timeline
□ Identify quality gates

### 3. **Execution** (varies by workflow)
□ Create feature branch
□ Execute workflow stages
□ Implement quality gates
□ Add logging/documentation
□ Commit with standard messages

### 4. **Review** (10-20 min)
□ Create pull request with template
□ Request code review
□ Address feedback
□ Ensure all quality gates pass
□ Security review (if applicable)

### 5. **Integration** (5 min)
□ Merge to main branch
□ Tag release (if applicable)
□ Deploy to staging/production
□ Monitor for issues
□ Update documentation

### 6. **Closure** (5 min)
□ Close GitHub issue
□ Document lessons learned
□ Update runbooks/guides (if needed)
□ Celebrate! 🎉

---

## Specs Directory Structure

specs/
├── api/
│   ├── [feature]-api-spec.md
│   └── openapi.yaml
├── database/
│   ├── schema-[version].md
│   └── migrations/
│       └── README.md
├── features/
│   ├── [feature]-spec.md
│   └── [feature]-requirements.md
├── infrastructure/
│   ├── [env]-infrastructure.md
│   └── deployment-procedures.md
├── security/
│   ├── security-checklist.md
│   ├── threat-model.md
│   └── compliance-status.md
└── README.md

**Spec Template**:
# [Spec Name]

## Overview
[One sentence description]
[Context and why this spec exists]

## Requirements
- [ ] [Requirement 1]
- [ ] [Requirement 2]

## Design
[Architecture, diagrams, decisions]

## Implementation
[Steps to implement this spec]

## Testing
[How to verify this spec is met]

## Success Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]

## References
- [Link to related specs/docs]

---

## Documentation Lifecycle

### Tier 1: Always Update
- ✅ README.md (if public changes)
- ✅ API documentation (if endpoints change)
- ✅ Deployment guides (if process changes)
- ✅ Architecture docs (if design changes)

### Tier 2: Update as Needed
- ⚙️ Developer guides
- ⚙️ Setup instructions
- ⚙️ Troubleshooting guides
- ⚙️ FAQ documents

### Tier 3: Nice to Have
- 📝 Blog posts about implementation
- 📝 Decision records (ADRs)
- 📝 Lessons learned documents

### Documentation Review Checklist
Before merging ANY code:
- [ ] README updated (if user-facing change)
- [ ] API docs updated (if endpoint changes)
- [ ] Type definitions updated (if API changes)
- [ ] Error messages document (if new errors)
- [ ] Comments added for complex logic
- [ ] Inline documentation for APIs

---

## Quick Reference Commands

### Create a New Workflow
```bash
# 1. Create feature branch
git checkout -b [branch-type]/[description]

# 2. Start work
# [implement feature/fix/docs/etc]

# 3. Commit with standard format
git add .
git commit -m "[type]: [description]"

# 4. Create PR with template
git push origin [branch-type]/[description]
gh pr create --title "[type]: [description]"

# 5. Address feedback
# [make changes]
git add .
git commit -m "[type]: address review feedback"
git push origin [branch-type]/[description]

# 6. Merge when approved
git checkout main
git pull origin main
git merge --squash [branch-type]/[description]
git commit -m "Merge [branch-type]/[description]"
git push origin main

### Check Quality Gates
```bash
# Run all checks before pushing
npm run lint           # Code style
npm run type-check     # TypeScript
npm run test           # Unit tests
npm run test:coverage  # Coverage report
npm run test:e2e       # E2E tests (if applicable)
npm run build          # Build check

# View results
open coverage/index.html  # Coverage report
open test-results/      # Test results

### Deploy
```bash
# Staging deployment
npm run deploy:staging

# Production deployment (requires approval)
npm run deploy:prod

# Verify deployment
npm run health-check -- https://[environment].example.com

---

## Support & Escalation

### Questions About Workflow Selection?
Use the [Quick Decision Tree](#quick-decision-tree) above or consult Tech Lead.

### Quality Gate Failures?
1. Review the specific gate requirement
2. Check agent specialty for that domain
3. Request fallback agent if needed
4. Update runbook if gate needs clarification

### Need to Adapt Workflow for Project?
1. Document deviation in project README
2. Update GitHub integration pattern section
3. Brief team on new process
4. Create checklist of any additional gates

### Performance or Scalability Concerns?
1. Identify bottleneck (planning, execution, review)
2. Consider parallel execution options
3. Review agent availability
4. Adjust timeline estimates

---

## Glossary

- **Workflow**: Complete process from intake to closure for a type of work
- **Stage**: Major phase within a workflow
- **Agent**: AI system or team member with specialized expertise
- **Quality Gate**: Checkpoint that must pass before proceeding
- **GitHub Integration**: How code changes flow through GitHub (branches, PRs, merges)
- **Fallback**: Alternative agent or approach if primary is unavailable
- **Graceful Degradation**: Completing workflow with reduced capability and increased oversight
- **Spec**: Detailed requirements document for a feature or change

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024 | Initial release with 10 specialized workflows, quality gates, fallbacks |

---

**Last Updated**: 2024  
**Maintained By**: Technical Leadership Team  
**Next Review**: Quarterly

For updates or corrections, create an issue or PR against this document.

---

## Summary

I've created a **comprehensive, production-ready `copilot-instructions.md`** document that includes:

### ✅ **What's Included**:

1. **Quick Decision Tree** - Fast workflow selection
2. **Workflow Quick Reference Table** - All 10 workflows at a glance
3. **10 Specialized Workflows** with:
   - When to use
   - Primary & supporting agents
   - Execution sequences with timing
   - Copy-paste ready GitHub commands
   - Quality gates checklist
   - Agent fallback options

4. **Agent Definitions** - 10 roles with expertise, responsibilities, and quality gates

5. **Foundation Pipelines** - 4-Stage Standard & UI/UX pipelines

6. **GitHub Integration Pattern** - Standard across all workflows (branches, commits, PRs)

7. **Quality Gates** - Universal + domain-specific

8. **Agent Availability & Fallbacks** - 4-tier system with decision tree

9. **Execution Guide** - Step-by-step 6-phase process

10. **Documentation** - Specs structure, lifecycle, templates

### 🎯 **Key Features**:
- **Scannable**: Tables, sections, visual hierarchy
- **Actionable**: Copy-paste commands, templates
- **Comprehensive**: 2-3 page depth with all necessary detail
- **Flexible**: Shows how to adapt for projects
- **GitHub-focused**: Every workflow ends in commits/PRs/merges

You can now copy this entire document and commit it to your repository as `/copilot-instructions.md`. It's ready to guide your team and AI systems through intelligent workflow routing!