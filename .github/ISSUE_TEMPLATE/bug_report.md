---
name: Bug Report
description: Report a bug or system issue
title: '[BUG][${alert_id}] '
labels: ['bug', 'needs-triage', 'needs-reproduction', '${severity_label}', '${component_label}', '${alert_source_label}']
assignees: ['@platform-team', '@qa-team', '@security-team']
---

### Bug Description

A clear and concise description of the bug.

Alert ID: ${alert_id}
Alert Source: ${alert_source}

### Severity*

Please select the severity level:

- [ ] P0 - Critical: System Down
- [ ] P1 - High: Service Degradation  
- [ ] P2 - Medium: Feature Impact
- [ ] P3 - Low: Minor Issue
- [ ] SEC0 - Critical Security
- [ ] SEC1 - High Security
- [ ] SEC2 - Medium Security

### Component*

Please select the affected component:

- [ ] API Gateway
- [ ] Document Processor
- [ ] Email Service
- [ ] Web Interface
- [ ] Database
- [ ] Message Queue
- [ ] Storage Service
- [ ] Authentication Service
- [ ] Monitoring System
- [ ] Infrastructure
- [ ] Security Controls
- [ ] Other

### Environment*

- Environment: [Development/Staging/Production]
- Region: [e.g. us-east-1]
- Service Version: [e.g. 1.0.0]
- Infrastructure: [e.g. ECS/EKS]
- Alert Source: [e.g. DataDog/CloudWatch]
- Incident Time: [UTC timestamp]

### Steps to Reproduce*

1. Step 1
2. Step 2
3. Step 3

### Expected Behavior*

A clear and concise description of what you expected to happen.

### Actual Behavior*

A clear and concise description of what actually happened.

### System Metrics

- CPU Usage: ${cpu_usage}
- Memory Usage: ${memory_usage}
- Error Rate: ${error_rate}
- Response Time: ${response_time}

### Logs and Screenshots

Please attach relevant logs, error messages, or screenshots.

```json
// Insert relevant log snippets here
```

### Additional Context

Add any other context about the problem here, such as:
- Related incidents
- Recent changes
- Workarounds attempted

### Security Impact Assessment

For security-related issues (SEC0-SEC2), please provide:
- Potential data exposure
- Affected security controls
- Recommended containment steps

### Automated Analysis

- [ ] Alert correlation completed
- [ ] Metrics collected
- [ ] Security scan performed
- [ ] Incident history checked

---
**Note**: For P0/SEC0 issues, please also notify the on-call team via PagerDuty.