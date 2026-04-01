# Card-Benefits: QA & Code Review Process

**Version:** 1.0
**Created:** April 1, 2026
**Purpose:** Ensure all code changes are reviewed for security, correctness, and quality

---

## 📋 Overview

Every code change in this project follows this workflow:

```
SPECIFICATION REVIEW → IMPLEMENTATION → QA REVIEW → TESTING → DEPLOYMENT
```

**No code is merged without QA approval.**

---

## 🔄 Detailed Workflow

### 1️⃣ SPECIFICATION PHASE

**When:** At the start of each task

**Process:**
1. Write technical specification document (SPECIFICATION_[TaskName].md)
2. Include:
   - Objective and acceptance criteria
   - Technical design details
   - Implementation steps with file locations
   - Testing requirements
   - Security considerations
   - Rollback plan

3. Submit for QA review using `tech-spec-architect` agent:
   ```
   Task: Review specification SPECIFICATION_[TaskName].md
   Agent: tech-spec-architect
   Focus: Clarity, completeness, security, feasibility
   ```

4. Address QA feedback on spec
5. Get approval before implementation starts

**QA Checks (Specification Phase):**
- [ ] Acceptance criteria are clear and measurable
- [ ] Technical design is sound
- [ ] Security implications identified
- [ ] Implementation steps are specific
- [ ] File locations are correct
- [ ] Testing strategy is comprehensive
- [ ] Rollback plan is viable

---

### 2️⃣ IMPLEMENTATION PHASE

**When:** After spec approval

**Process:**
1. Follow specification exactly
2. Implement code with proper error handling
3. Self-review before submission:
   - [ ] Code follows spec
   - [ ] Error handling present
   - [ ] Type-safe (no `any` types)
   - [ ] No console.logs in production
   - [ ] Comments for complex logic
   - [ ] No hardcoded values

4. Prepare for QA review:
   - Save all files
   - Note any deviations from spec
   - List assumptions made

**Code Quality Standards:**
- ✅ TypeScript strict mode
- ✅ No unused variables
- ✅ Clear naming conventions
- ✅ Comments for complex logic
- ✅ Error messages are helpful
- ✅ Proper error handling

---

### 3️⃣ QA CODE REVIEW PHASE

**When:** Implementation complete, before testing

**Process:**
1. Submit code for review using `qa-code-reviewer` agent:
   ```
   Task: Review implementation of [Task Name]
   Agent: qa-code-reviewer
   Scope: [List specific files changed]
   Specification: [Link to spec]
   Focus Areas:
   - Security vulnerabilities
   - Logic correctness
   - Error handling completeness
   - Performance issues
   - Code quality & standards
   ```

2. QA agent reviews for:
   - ✅ Security vulnerabilities (SQL injection, XSS, CSRF, etc.)
   - ✅ Logic correctness (matches spec)
   - ✅ Edge case handling
   - ✅ Error handling completeness
   - ✅ Performance bottlenecks
   - ✅ Code standards compliance
   - ✅ Test coverage adequacy
   - ✅ Type safety

3. QA agent provides:
   - Detailed findings report
   - Specific file:line references
   - Code examples showing issues
   - Concrete fix recommendations
   - Severity levels (Critical, High, Medium, Low)

4. Address QA findings:
   - Fix all Critical issues immediately
   - Fix High priority before testing
   - Document Medium/Low for later
   - Request re-review if major changes

5. Get QA approval (signature)

**Critical Issues (Must Fix Before Testing):**
- 🔴 Security vulnerabilities
- 🔴 Logic errors affecting spec compliance
- 🔴 Missing error handling in critical paths
- 🔴 Type safety violations

**High Priority (Fix Before Deployment):**
- 🟠 Performance issues
- 🟠 Incomplete error handling
- 🟠 Code quality issues
- 🟠 Test coverage gaps

**Medium Priority (Fix Next Sprint):**
- 🟡 Style/formatting issues
- 🟡 Documentation gaps
- 🟡 Potential edge cases

---

### 4️⃣ TESTING PHASE

**When:** QA review approved

**Process:**
1. Write unit tests based on spec
   - Target: 85%+ coverage
   - Test normal cases
   - Test edge cases
   - Test error scenarios

2. Write integration tests
   - Test workflows
   - Test data consistency
   - Test with real database

3. Run full test suite:
   ```bash
   npm run test              # All tests
   npm run test:coverage     # Coverage report
   npm run type-check        # Type safety
   npm run lint              # Code quality
   ```

4. Verify:
   - [ ] All tests passing
   - [ ] Coverage >80%
   - [ ] No type errors
   - [ ] No linting errors
   - [ ] No regressions

**Test Categories:**
- **Unit Tests:** Individual functions in isolation
- **Integration Tests:** Multiple components working together
- **Security Tests:** Authorization, validation, injection attacks
- **E2E Tests:** Full user workflows
- **Regression Tests:** Ensure previous functionality still works

---

### 5️⃣ DEPLOYMENT PHASE

**When:** All reviews & tests passed

**Process:**
1. Merge code to develop branch
2. Deploy to staging environment
3. Smoke test on staging
4. Deploy to production
5. Monitor for errors (first 24 hours)
6. Document any issues

---

## 🤖 Using QA Agents

### `qa-code-reviewer` Agent

**When to Use:**
- After implementation is complete
- Before any testing begins
- For code quality checks
- For security audits

**How to Use:**
```
Use the qa-code-reviewer Task agent with:
- subagent_type: "qa-code-reviewer"
- description: Brief task summary
- prompt: Detailed review request

Example:
"Please review implementation of [Task] for security, correctness,
and code quality. Check files: [list]. Focus on: [list specific concerns]"
```

**What It Checks:**
- Security vulnerabilities (OWASP Top 10)
- Logic errors and edge cases
- Performance issues
- Code standards
- Test adequacy
- Type safety
- Error handling

**Output:**
- Detailed analysis
- Code examples with line numbers
- Severity levels
- Fix recommendations
- Sign-off (approved/needs fixes)

---

### `tech-spec-architect` Agent

**When to Use:**
- At start of each task for spec review
- For architectural decisions
- For design validation

**How to Use:**
```
Use the Task agent with:
- subagent_type: "tech-spec-architect"
- description: Specification review
- prompt: Detailed design document

Example:
"Please review this specification for completeness, clarity,
security implications, and technical feasibility"
```

**What It Checks:**
- Specification clarity
- Technical feasibility
- Security design
- Performance implications
- Scalability considerations
- Testing strategy

**Output:**
- Review findings
- Improvement recommendations
- Approval or feedback

---

### `Explore` Agent (For Research)

**When to Use:**
- To understand existing code before changes
- To analyze codebase patterns
- To find all usages of a function

**How to Use:**
```
Use the Task agent with:
- subagent_type: "Explore"
- description: Code exploration task
- prompt: What you want to understand

Example:
"Explore the codebase to find all ROI calculation implementations
and how they differ. Report file locations and differences."
```

---

## 📋 Approval Checklist

### Specification Approval
- [ ] Objective clear
- [ ] Acceptance criteria measurable
- [ ] Design technically sound
- [ ] Security reviewed
- [ ] Implementation steps detailed
- [ ] Testing strategy complete
- [ ] Rollback plan defined
- **QA Signature:** _______________

### Code Review Approval
- [ ] No critical security issues
- [ ] No logic errors
- [ ] Error handling complete
- [ ] Matches specification
- [ ] Code quality good
- [ ] No performance red flags
- [ ] Test coverage adequate
- **QA Signature:** _______________

### Testing Approval
- [ ] All tests passing
- [ ] Coverage >80%
- [ ] No regressions
- [ ] Smoke test passed
- [ ] Manual testing passed
- **QA Signature:** _______________

### Deployment Approval
- [ ] All approvals received
- [ ] All tests passing
- [ ] Rollback plan ready
- [ ] Monitoring configured
- [ ] Documentation complete
- **Deployment Sign-off:** _______________

---

## 🚨 Issue Severity Levels

### 🔴 CRITICAL (Blocks Deployment)
- Security vulnerability
- Logic error breaking spec
- Missing critical error handling
- Data corruption risk
- App crash scenarios
**Action:** Fix immediately, re-review

### 🟠 HIGH (Should Fix Before Deployment)
- Performance issue
- Incomplete error handling
- Code quality issue
- Potential edge case
- Test coverage gap
**Action:** Fix before deployment

### 🟡 MEDIUM (Fix Next Sprint)
- Non-critical code smell
- Minor documentation gap
- Future optimization
- Nice-to-have improvement
**Action:** Document for next sprint

### 🟢 LOW (Polish)
- Style preference
- Comment clarity
- Typo in comment
- Unused import
**Action:** Fix if time allows

---

## 📊 Review Checklist (Per File)

For each file changed, verify:

### Security
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] No CSRF vulnerabilities
- [ ] Proper authorization checks
- [ ] No hardcoded secrets
- [ ] Safe cryptographic operations
- [ ] Input validation present

### Correctness
- [ ] Logic matches specification
- [ ] Edge cases handled
- [ ] Error handling complete
- [ ] Type-safe (no `any` types)
- [ ] Null checks present
- [ ] No silent failures
- [ ] Error messages helpful

### Performance
- [ ] No N+1 queries
- [ ] Proper memoization/caching
- [ ] Efficient algorithms
- [ ] No memory leaks
- [ ] Proper lazy loading
- [ ] Reasonable bundle size impact

### Quality
- [ ] Follows conventions
- [ ] Clear variable names
- [ ] Functions reasonably sized
- [ ] Comments for complex logic
- [ ] No dead code
- [ ] No console.logs
- [ ] Test coverage adequate

### Accessibility
- [ ] Keyboard navigable
- [ ] Screen reader compatible
- [ ] Color contrast adequate
- [ ] ARIA labels present
- [ ] Semantic HTML used
- [ ] Focus indicators visible

---

## 📝 Review Template

When submitting code for review, include:

```markdown
# Code Review Submission: [Task Name]

## Files Changed
- [ ] /src/file1.tsx
- [ ] /src/file2.ts
- [ ] /src/file3.tsx

## Summary
Brief description of changes

## Specification
Link/reference to approved specification

## Key Changes
- Change 1
- Change 2
- Change 3

## Testing
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] All tests passing
- [ ] Coverage >80%

## Self-Review
- [ ] Matches specification
- [ ] Error handling complete
- [ ] Type-safe
- [ ] No security issues spotted
- [ ] Code quality acceptable

## Questions/Concerns
Any areas you want QA to focus on

## Ready for Review
By: [Your Name]
Date: [Date]
```

---

## 🔄 Feedback Loop

### If QA Finds Issues

1. **Critical Issues:** Fix immediately
   - Make fixes
   - Re-submit for QA review
   - No testing until approved

2. **High Priority Issues:** Fix before testing
   - Make fixes
   - Re-submit for QA review
   - Then proceed to testing

3. **Medium/Low Issues:** Document for next sprint
   - Can proceed to testing
   - Fix later if time allows

### If Tests Find Issues

1. Debug the failure
2. Identify root cause
3. Fix in code
4. Re-submit for QA review (if logic changed)
5. Re-run tests
6. Document findings

### If Deployment Issues

1. Stop deployment
2. Investigate error
3. Activate rollback if needed
4. Debug root cause
5. Make fix
6. Get QA re-review
7. Re-test
8. Re-deploy

---

## 📞 Communication

### Daily Standup
- Status of current task
- Blockers or issues
- QA review results
- Plan for next day

### Weekly Review
- Phase progress
- Quality metrics
- Issues found/fixed
- Next week's plan

### Before Deployment
- Final checklist
- Risk assessment
- Rollback readiness
- Monitoring setup

---

## ✅ Success Metrics

By following this process, we ensure:

- ✅ Zero security vulnerabilities in production
- ✅ Zero logic errors in critical paths
- ✅ 80%+ test coverage
- ✅ <0.1% production error rate
- ✅ User satisfaction >95%
- ✅ Code quality grade A-

---

**This process is mandatory for all code changes.**

**No exceptions. Code without QA approval cannot be merged or deployed.**

