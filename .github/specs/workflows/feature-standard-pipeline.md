# 4-Stage Standard Feature Pipeline

**Use this for typical feature requests that don't fall into specialized categories.**

**Primary Agent**: Tech Lead  
**Supporting Agents**: Domain-specific specialists (Backend, Frontend, Database, Security)  
**Typical Duration**: 60-180 minutes  
**When to Use**: Default pipeline for general features

---

## Pipeline Overview

```
Stage 1: Architecture & Planning
    ↓
    ├─ Backend Specialist: API/database design
    ├─ Frontend Specialist: Component design
    └─ Security Auditor: Security review
    ↓
Stage 2: Backend Implementation
    ↓
    └─ Backend Specialist: Implement endpoints
    ↓
Stage 3: Frontend Implementation
    ↓
    ├─ [PARALLEL] Frontend Specialist: Implement components
    ├─ [PARALLEL] QA Engineer: Test planning
    └─ [PARALLEL] Documentation: Start API docs
    ↓
Stage 4: Integration & QA
    ↓
    ├─ Frontend Specialist: Integrate backend
    ├─ QA Engineer: Full testing
    └─ Tech Lead: Sign-off
```

---

## Stage 1: Architecture & Planning

**Duration**: 15-30 minutes  
**Owner**: Tech Lead  
**Parallelizable**: Backend design + Frontend design (independent)

### Checklist
- [ ] Break feature into tasks
- [ ] Identify database changes needed
- [ ] List API endpoints required
- [ ] Design component structure
- [ ] Identify security requirements
- [ ] Create data models and interfaces

### Output
- Architecture document (text-based, if needed)
- Task breakdown with time estimates
- Database schema changes (if any)
- API endpoint specifications
- Component hierarchy

### GitHub
```bash
# Create feature branch
git checkout -b feature/[feature-name]

# Create tracking document (if needed)
# docs/features/[feature-name]-spec.md
```

### Quality Gate
- ✅ Architecture reviewed by Tech Lead
- ✅ Security requirements identified
- ✅ Estimated time realistic
- ✅ No blocking dependencies

---

## Stage 2: Backend Implementation

**Duration**: 30-60 minutes  
**Owner**: Backend Specialist  
**Parallelizable**: Can start while frontend design continues

### Checklist
- [ ] Create database migrations (if needed)
- [ ] Implement API endpoints with full validation
- [ ] Implement business logic
- [ ] Add request/response validation
- [ ] Implement error handling
- [ ] Add logging for debugging
- [ ] Write unit tests (target >85% coverage)
- [ ] Write integration tests (target >70% coverage)

### Output
- API endpoints fully functional
- Database migrations (tested)
- Unit & integration tests
- Error handling for all paths
- Logging configured

### GitHub
```bash
# Commit structure
git add src/routes/ src/services/ src/models/ src/tests/
git commit -m "feat(api): implement [feature] endpoints"

# Push to feature branch
git push origin feature/[feature-name]
```

### Quality Gates
- ✅ Unit test coverage >85%
- ✅ Integration tests >70%
- ✅ All error paths covered
- ✅ Response time <100ms
- ✅ Input validation complete
- ✅ Logging in place
- ✅ No TypeScript errors

### Fallback Agent
If Backend Specialist unavailable → SWE

---

## Stage 3: Frontend Implementation

**Duration**: 30-60 minutes  
**Owner**: Frontend Specialist  
**Parallelizable**: Can run in parallel with Stage 2

### Checklist
- [ ] Create component structure
- [ ] Implement component logic
- [ ] Connect to backend API
- [ ] Implement error handling
- [ ] Add loading states
- [ ] Write component tests
- [ ] Test responsive design
- [ ] Add accessibility features (WCAG 2.1 AA)
- [ ] Add Storybook story (optional)

### Output
- Working React/Next.js components
- Component tests (>80% coverage)
- Integration with backend API
- Responsive design verified
- Accessibility verified

### GitHub
```bash
# Commit structure
git add src/components/ src/app/ src/tests/
git commit -m "feat(frontend): implement [feature] components"

# Push to feature branch
git push origin feature/[feature-name]
```

### Quality Gates
- ✅ Unit test coverage >80%
- ✅ Components responsive (mobile, tablet, desktop)
- ✅ Accessibility score >95 (Lighthouse)
- ✅ No console errors/warnings
- ✅ TypeScript strict mode passes
- ✅ API integration tested

### Fallback Agent
If Frontend Specialist unavailable → Expert React Frontend Engineer

---

## Stage 4: Integration & QA

**Duration**: 15-30 minutes  
**Owner**: QA Engineer + Tech Lead

### Checklist
- [ ] Full integration testing (backend + frontend)
- [ ] End-to-end user flows
- [ ] Performance testing
- [ ] Cross-browser testing
- [ ] Mobile responsiveness
- [ ] Security vulnerability scan
- [ ] Documentation review

### Output
- QA report (pass/fail on test cases)
- Performance report (load times, bundle size)
- Security scan report
- Sign-off for deployment

### GitHub
```bash
# Create PR with detailed description
gh pr create \
  --title "feat: [Feature Name]" \
  --body "
## Description
[What this feature does]

## Changes
- Backend: [what changed]
- Frontend: [what changed]
- Database: [what changed]

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Full flow tested (E2E)
- [ ] Accessibility verified
- [ ] Performance checked
- [ ] Security scan passed

## Breaking Changes
- [ ] None
- [ ] Yes (describe)

## Related Issues
Closes #[issue-number]
"

# Request review
gh pr review --approve

# Merge when ready
gh pr merge --squash
```

### Quality Gates (Final)
- ✅ All tests passing (100%)
- ✅ Code coverage ≥80%
- ✅ Security scan: zero critical vulnerabilities
- ✅ Performance: <5% bundle size increase
- ✅ Accessibility: WCAG 2.1 AA verified
- ✅ Documentation updated

### Fallback Agent
If QA Engineer unavailable → qa-code-reviewer

---

## Parallel Execution Opportunities

These stages can run in parallel to save time:

```
Stage 1 Planning (15-30 min)
    ├─ [PARALLEL] Stage 2 Backend (30-60 min) — starts while design completes
    └─ [PARALLEL] Stage 3 Frontend (30-60 min) — starts while design completes
         ↓
    Stage 4 Integration & QA (15-30 min)

Total Time: ~75-120 minutes (vs 120-180 sequential)
```

### Tips for Parallelization
1. Use **mocked APIs** in frontend during backend development
2. Create **interface stubs** for component props early
3. Use **Storybook** for isolated component development
4. Use **data factories** in tests for realistic data

---

## Troubleshooting

### Backend Implementation Blocked
- **Issue**: Database migration takes longer than expected
- **Solution**: Create migration in parallel, frontend uses mock data until ready

### Frontend Tests Failing
- **Issue**: Component tests fail due to API changes
- **Solution**: Update test mocks first, then backend implementation

### Integration Issues
- **Issue**: Frontend can't connect to backend API
- **Solution**: Check CORS headers, authentication, and error handling

### Performance Degradation
- **Issue**: Bundle size or load time increased
- **Solution**: Run `npm run analyze` to identify large dependencies

---

## Examples

### Example 1: Add Blog Feature
```
Stage 1: Planning
  - Backend Specialist: /api/posts, /api/posts/:id, database schema
  - Frontend Specialist: BlogList, BlogPost, BlogEditor components
  - Security: Verify auth on POST/DELETE endpoints
  
Stage 2: Backend
  - Implement GET /api/posts (paginated)
  - Implement POST /api/posts (create)
  - Implement PATCH /api/posts/:id (update)
  - Implement DELETE /api/posts/:id (delete)
  
Stage 3: Frontend
  - BlogList: Fetch and display posts
  - BlogPost: Show single post
  - BlogEditor: Create/edit post form
  
Stage 4: QA
  - Test full create → list → view → edit → delete flow
  - Check pagination
  - Verify auth (only own posts editable)
```

### Example 2: Add Payment Feature
```
Stage 1: Planning
  - Backend: Payment API integration with Stripe
  - Frontend: Payment form component
  - Security: PCI compliance check
  
Stage 2: Backend
  - Implement POST /api/payments
  - Implement /api/payments/webhook (Stripe)
  - Database schema for payment records
  
Stage 3: Frontend
  - StripeForm component
  - Payment success/error pages
  
Stage 4: QA
  - Test payment flow end-to-end
  - Test error handling
  - Security: Verify no credit card data stored
```

---

## Deployment Checklist

Before merging to main:

- [ ] All tests passing
- [ ] Code review approved
- [ ] Security scan clean
- [ ] Performance within budget
- [ ] Documentation updated
- [ ] Database migrations tested
- [ ] Feature flag ready (if needed)
- [ ] Staging environment verified

---

**Related Files**
- Main routing: `.github/copilot-instructions.md`
- Other workflows: `.github/specs/workflows/*.md`
- GitHub integration: Commit messages, branch naming conventions

**Next Steps**
- After Stage 4 QA passes, merge to main
- Feature is ready for production deployment
- Use `devops-infrastructure-workflow.md` for deployment if needed
