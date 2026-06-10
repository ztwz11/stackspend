# Agent Brief 05: Security and Test Gates

## 담당 범위

- secret pattern tests
- notification payload tests
- local API response tests
- tray menu payload tests
- runtime lock tests

## 검사할 문자열

```text
sk-
AWS_SECRET_ACCESS_KEY
refresh_token
client_secret
SLACK_WEBHOOK_URL
email
invoice
card
raw
payload
authorization
```

## Acceptance criteria

- 모든 local API response는 `secretsReturned: false`
- notification digest에는 provider secret 없음
- tray menu에는 provider secret 없음
- logs에는 webhook URL 없음
