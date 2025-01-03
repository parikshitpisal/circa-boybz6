## Pull Request Description

<!-- Please provide a clear and concise description of your changes following the conventional commits format -->
<!-- Format: type(scope): description -->
<!-- Example: feat(auth): implement MFA for admin access -->

### Type of Change
<!-- Please select the type of change this PR introduces -->

- [ ] Feature Implementation
- [ ] Bug Fix
- [ ] Performance Improvement
- [ ] Code Refactoring
- [ ] Documentation Update
- [ ] CI/CD Update
- [ ] Security Enhancement
- [ ] Compliance Update

### Related Issue
<!-- Please link the issue this PR addresses -->

Fixes #(issue number)

Related compliance requirements (if applicable):
<!-- List any GLBA, SOC 2, or PCI DSS requirements addressed -->

### Changes Made
<!-- Provide a detailed description of the changes -->

- [ ] Detailed change description
- [ ] Impact on existing functionality
- [ ] Dependencies affected
- [ ] Configuration changes required

### Security Considerations
<!-- All security items must be addressed -->

- [ ] Data encryption impact
  - [ ] Changes to encryption at rest
  - [ ] Changes to encryption in transit
  - [ ] Key management modifications
- [ ] Authentication/Authorization changes
  - [ ] Role-based access control updates
  - [ ] Permission model changes
- [ ] PII handling modifications
  - [ ] Data classification changes
  - [ ] Storage location changes
  - [ ] Access pattern updates
- [ ] Compliance requirements addressed
  - [ ] GLBA considerations
  - [ ] SOC 2 Type II controls
  - [ ] PCI DSS requirements
- [ ] Security testing completed
  - [ ] Vulnerability scanning
  - [ ] Penetration testing (if required)
  - [ ] Security review approval

### Testing
<!-- Document all testing performed -->

- [ ] Unit tests added/modified
  - [ ] Test coverage report attached
  - [ ] Critical paths covered
- [ ] Integration tests updated
  - [ ] API endpoints tested
  - [ ] Service interactions verified
- [ ] Security tests performed
  - [ ] Authentication tests
  - [ ] Authorization tests
  - [ ] Data protection tests
- [ ] Performance tests conducted
  - [ ] Load testing results
  - [ ] Stress testing results
- [ ] Test coverage report
  - [ ] Coverage percentage: ___%
  - [ ] Critical paths covered

### Deployment Notes
<!-- Document deployment requirements and process -->

- [ ] Database migrations required
  - [ ] Migration scripts tested
  - [ ] Rollback scripts prepared
- [ ] Configuration changes needed
  - [ ] Environment variables
  - [ ] Service configurations
  - [ ] Infrastructure updates
- [ ] Environment variables to be updated
  - [ ] Development
  - [ ] Staging
  - [ ] Production
- [ ] Deployment order dependencies
  - [ ] Service deployment sequence
  - [ ] Configuration update sequence
- [ ] Rollback plan
  - [ ] Rollback steps documented
  - [ ] Recovery point identified
  - [ ] Service dependencies mapped

### Checklist
<!-- Final verification checklist -->

- [ ] Code follows project style guidelines
- [ ] Documentation has been updated
- [ ] All automated tests pass
- [ ] Security review completed
- [ ] Compliance review completed
- [ ] Performance impact assessed
- [ ] Deployment plan reviewed
- [ ] Rollback strategy validated

### Reviewers
<!-- Required reviewers based on change type -->

- [ ] @security-team for security review
- [ ] @platform-team for technical review
- [ ] @product-team for feature validation
- [ ] @compliance-team for compliance verification

/label ~needs-review ~waiting-for-ci ~security-review-required ~compliance-check-needed