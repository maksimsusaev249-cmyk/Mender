# Security Specification — Mender Messenger (Phase 0 TDD)

## 1. Data Invariants

1. **PII Isolation (`UserPrivate` vs `UserPublic`)**:
   - `/users_private/{userId}` stores `email`, `phone`, `pinHash`, and `pinSalt`. It can ONLY be read or written by the authenticated owner (`request.auth.uid == userId`).
   - `/users/{userId}` stores only public profile attributes (`displayName`, `username`, `avatarUrl`, `bio`, `status`, privacy preferences, counts) and never contains phone numbers, emails, or PIN hashes.
2. **Relational Integrity & Master Gate (`Chat`, `ChatMember`, `Message`)**:
   - A message in `/chats/{chatId}/messages/{messageId}` cannot be created unless the parent `/chats/{chatId}` exists and the sender (`request.auth.uid`) is a verified member in `/chats/{chatId}/members/{request.auth.uid}` (or the chat owner).
   - For channels (`type == 'channel'`), only `owner` or `admin` members can post messages.
   - Private chats (`visibility == 'private'`) cannot be read by non-participants.
3. **Strict Schema & Volumetric Validation**:
   - Every create and update operation passes through `isValid[Entity](incoming())`, enforcing exact key allowlists (`hasAll` + `hasOnly`), string `.size()` bounds, regex ID patterns (`^[a-zA-Z0-9_\-]+$`), and server timestamps (`request.time`).
4. **Terminal State Locking**:
   - `CallSession` (`status == 'ended'`) and `Report` (`status == 'resolved'`) cannot be modified once they reach their terminal state.
5. **Query Enforcer (No Blanket List)**:
   - Every `allow list` rule enforces constraints against `resource.data` without performing O(n) `get()` or `exists()` calls inside `list`.

---

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 (Identity Spoofing on UserPublic)**: Authenticated user `uid_attacker` creates `/users/uid_victim` with `uid: "uid_victim"`. -> `PERMISSION_DENIED`.
2. **Payload 2 (PII Theft on UserPrivate)**: Authenticated user `uid_attacker` performs `get` on `/users_private/uid_victim`. -> `PERMISSION_DENIED`.
3. **Payload 3 (Shadow Field Injection on Chat)**: User creates `/chats/chat_1` with an extra field `"isVerified": true`. -> `PERMISSION_DENIED`.
4. **Payload 4 (Orphaned Message Write)**: User creates `/chats/non_existent_chat/messages/msg_1` where parent chat does not exist. -> `PERMISSION_DENIED`.
5. **Payload 5 (Unauthorized Private Chat Read)**: User `uid_outsider` performs `get` on private chat `/chats/chat_secret` where they are neither `ownerId`, `peerUserId`, nor in `/chats/chat_secret/members/uid_outsider`. -> `PERMISSION_DENIED`.
6. **Payload 6 (Value Poisoning on Message Update)**: Sender updates `content` of `/chats/chat_1/messages/msg_1` to a boolean `true` or an oversized 10,000-char string. -> `PERMISSION_DENIED`.
7. **Payload 7 (Privilege Escalation on ChatMember)**: Regular user `uid_attacker` creates `/chats/chat_1/members/uid_attacker` with `role: "owner"` on a chat owned by `uid_victim`. -> `PERMISSION_DENIED`.
8. **Payload 8 (Timestamp Forgery)**: User creates `/posts/post_1` with a past client timestamp `createdAt` instead of `request.time`. -> `PERMISSION_DENIED`.
9. **Payload 9 (Immortal Field Mutation)**: User updates `/posts/post_1` and attempts to mutate `authorId` or `createdAt`. -> `PERMISSION_DENIED`.
10. **Payload 10 (Terminal State Mutation on CallSession)**: User updates `/calls/call_1` after `resource.data.status == 'ended'`. -> `PERMISSION_DENIED`.
11. **Payload 11 (Unverified Email Write)**: User with `email_verified: false` (and no phone verification) attempts to create a post or chat. -> `PERMISSION_DENIED`.
12. **Payload 12 (ID Poisoning Attack)**: User attempts to create a document with an invalid ID containing spaces or special characters. -> `PERMISSION_DENIED`.
