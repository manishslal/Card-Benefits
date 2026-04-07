# Copilot Instructions: Workflow Routing System

**Version**: 2.0 (Token-Optimized)  
**Purpose**: Route work through specialized workflows  
**Token Cost**: ~600 tokens/execution (main + workflow file) vs 2,200 for monolithic

---

## 🎯 How This Works

1. **Decide** — Use Quick Decision Tree (30 seconds)
2. **Route** — Find your workflow type
3. **Load** — Read specific workflow file (150-300 lines)
4. **Execute** — Follow step-by-step guide
5. **Deliver** — Check quality gates, merge to main

---

## Quick Decision Tree

```
Is it a standard feature?
├─ YES → Load: feature-standard-pipeline.md
└─ NO ↓

Is it UI/React focused?
├─ YES → Load: feature-uiux-pipeline.md
└─ NO ↓

What's the primary domain?
├─ Backend/TypeScript? → backend-feature-workflow.md
├─ React/Next.js? → frontend-feature-workflow.md
├─ Java/MCP? → java-mcp-workflow.md
├─ Database/PostgreSQL? → database-workflow.md
├─ Full-Stack? → fullstack-feature-workflow.md
├─ Security? → security-audit-workflow.md
├─ DevOps? → devops-infrastructure-workflow.md
├─ Bug/Debug? → bug-fix-debug-workflow.md
├─ Testing/QA? → testing-qa-workflow.md
└─ Docs? → documentation-workflow.md
```

---

## Workflow Type Quick Reference

| Workflow | Agent | Duration | Load File |
|----------|-------|----------|-----------|
| **Standard Feature** | Tech Lead | 60-180 min | feature-standard-pipeline.md |
| **UI/UX Pipeline** | Frontend Specialist | 45-120 min | feature-uiux-pipeline.md |
| **React/Next.js** | Frontend Specialist | 30-60 min | frontend-feature-workflow.md |
| **TypeScript/Node.js** | Backend Specialist | 45-90 min | backend-feature-workflow.md |
| **Java MCP** | Java Specialist | 60-120 min | java-mcp-workflow.md |
| **PostgreSQL** | Database Architect | 30-45 min | database-workflow.md |
| **Full-Stack** | Tech Lead | 120-180 min | fullstack-feature-workflow.md |
| **Security Audit** | Security Auditor | 60-120 min | security-audit-workflow.md |
| **DevOps** | DevOps Engineer | 45-90 min | devops-infrastructure-workflow.md |
| **Bug Fix** | Debug Specialist | 20-60 min | bug-fix-debug-workflow.md |
| **Testing** | QA Engineer | 60-120 min | testing-qa-workflow.md |
| **Docs** | Technical Writer | 30-90 min | documentation-workflow.md |

---

## Agent Specialization Map

Map each role to the right copilot agent:

| Role | Copilot Agent | Domain |
|------|---|---|
| **Frontend Specialist** | Expert React Frontend Engineer | React, Next.js, TypeScript, CSS, Components |
| **Backend Specialist** | SWE | Node.js, TypeScript, API, services |
| **Database Architect** | PostgreSQL Database Administrator | PostgreSQL, migrations, optimization |
| **UI/UX Designer** | SE: UX Designer | Design specs, user research, accessibility |
| **Java Specialist** | Java MCP Expert | Java, Spring Boot, MCP servers |
| **Security Auditor** | SE: Security | OWASP, compliance, vulnerabilities |
| **DevOps Engineer** | devops-deployment-engineer | Docker, K8s, CI/CD, GitHub Actions |
| **Debug Specialist** | Debug Mode Instructions | Debugging, error analysis |
| **QA Automation Engineer** | qa-code-reviewer | Test automation, Playwright, Jest |
| **Technical Writer** | SE: Tech Writer | Documentation, API docs, guides |

---

## GitHub Integration Pattern (All Workflows)

### Branch Naming
```
feature/[type]-[description]
fix/[issue]-[description]
docs/[description]
ops/[description]
test/[description]
```

### Commit Message Format
```
feat(frontend): Add dark mode toggle
fix(api): Handle null user profile
docs(setup): Update installation guide
test(auth): Add JWT validation tests
ops(ci): Configure GitHub Actions
```

### Standard PR Checklist
- [ ] Code follows project style
- [ ] Tests pass (80%+ coverage)
- [ ] Quality gates checked
- [ ] Documentation updated
- [ ] No breaking changes

---

## Quality Gates (All Workflows)

### Code Quality
- ✅ Linting passes (0 errors)
- ✅ TypeScript strict mode
- ✅ Test coverage ≥80%
- ✅ No TODO/FIXME in production

### Accessibility (Frontend)
- ✅ WCAG 2.1 AA compliant
- ✅ Lighthouse >95
- ✅ Keyboard navigation works
- ✅ Screen reader compatible

### Performance
- ✅ Build size +<5%
- ✅ Page load <3 seconds
- ✅ Core Web Vitals Lighthouse >90
- ✅ API response <500ms

### Security
- ✅ No OWASP Top 10 issues
- ✅ No hardcoded secrets
- ✅ Dependency audit clean
- ✅ SQL injection protected

### Deployment
- ✅ All tests passing
- ✅ Security scan clean
- ✅ Staging verified
- ✅ Monitoring configured

---

## Where to Find Detailed Workflows

All workflows in `.github/specs/workflows/`:

```
.github/specs/workflows/
├── feature-standard-pipeline.md
├── feature-uiux-pipeline.md
├── frontend-feature-workflow.md
├── backend-feature-workflow.md
├── java-mcp-workflow.md
├── database-workflow.md
├── fullstack-feature-workflow.md
├── security-audit-workflow.md
├── devops-infrastructure-workflow.md
├── bug-fix-debug-workflow.md
├── testing-qa-workflow.md
└── documentation-workflow.md
```

Each file includes:
- Step-by-step execution
- Copy-paste git commands
- Quality gate checklist
- Agent responsibilities
- Execution time + parallelization
- Fallback agent options

---

## Quick Examples

**React Component?**
1. Decision Tree → UI/React? YES
2. Load: feature-uiux-pipeline.md
3. Follow with Frontend Specialist
4. Check accessibility gate

**Fix API Bug?**
1. Decision Tree → Bug? YES
2. Load: bug-fix-debug-workflow.md
3. Follow with Debug Specialist
4. Check code quality gate

**Database Migration?**
1. Decision Tree → Database? YES
2. Load: database-workflow.md
3. Follow with Database Architect
4. Check performance gate

**Deploy Infrastructure?**
1. Decision Tree → DevOps? YES
2. Load: devops-infrastructure-workflow.md
3. Follow with DevOps Engineer
4. Check deployment gate

---

## Why Modular Architecture?

✅ **Token Efficient**: Load only what you need (~600 vs 2,200)  
✅ **Fast Decisions**: Decision tree = 30 seconds  
✅ **Scalable**: Easy to add new workflow types  
✅ **Maintainable**: Update workflows independently  
✅ **Focused**: Each file contains one workflow type  

**Execution Model:**
1. Load main file (150 lines, ~200 tokens)
2. Follow decision tree
3. Load specific workflow (150-300 lines, ~400 tokens)
4. Execute with full context

---

## Troubleshooting

**Q: Which workflow?**
A: Follow Quick Decision Tree. Default = Standard Feature Pipeline.

**Q: Agent unavailable?**
A: Check specific workflow file for fallback options.

**Q: Quality gate failed?**
A: See specific workflow file for recovery steps.

**Q: Add new workflow type?**
A: Create file in `.github/specs/workflows/`, update reference table & decision tree.

---

**Last Updated**: 2024-04-07  
**Status**: Production Ready  
**Version**: 2.0 (Token-Optimized Modular System)
