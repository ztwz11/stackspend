# Agent Brief 04: Desktop Tray

## 담당 범위

- apps/tray
- tray menu
- native notification
- Open Dashboard
- Refresh Now
- Pause Notifications
- Start at Login

## 원칙

- local API만 호출
- provider connector import 금지
- credential import 금지
- raw SQLite query 금지
- secret scanner test 필수

## 동작

```text
start
→ find local runtime
→ start if missing
→ load tray menu
→ poll notification digest
→ show toast if allowed
```
