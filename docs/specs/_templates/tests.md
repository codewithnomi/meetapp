---
feature: FXX
title: <Feature name>
status: draft
updated: YYYY-MM-DD
---

# FXX <Feature name>: Test Cases

Written **before** the code. Each test case becomes an automated test.
Levels: unit · integration · e2e (real app flow) · security · performance

## Test cases

### TC-FXX-01: <short name>
- **Covers:** AC-FXX-01
- **Level:** e2e
- **Given** <starting situation>
- **When** <action>
- **Then** <expected result>

### TC-FXX-02: <short name>, security
- **Covers:** AC-FXX-02
- **Level:** security
- **Given** a user who is NOT a participant of the meeting
- **When** they try to …
- **Then** they are refused (error 403) and nothing is revealed

## Coverage
| Acceptance criterion | Test cases |
|---|---|
| AC-FXX-01 | TC-FXX-01 |
