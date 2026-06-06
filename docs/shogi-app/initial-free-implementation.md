# 将棋対戦アプリ: 初期完全無料で実装する方法

この文書は、[requirements.md](./requirements.md) と [design.md](./design.md) を前提に、初期運用を Cloudflare Workers Free と無料で使える範囲だけで始めるための実装方針を整理する。

## 完全無料の定義

初期完全無料モードでは、Cloudflare への請求が発生しない構成を優先する。

- Workers Free を使う。
- 公開入口は `workers.dev` にする。
- Cloudflare Email Sending は使わない。
- custom domain は必須にしない。
- GitHub Actions は public repo の test / lint / build のみにする。
- apply / deploy はローカル端末から実行する。
- R2 は IaC remote state など無料枠に収まる最小用途に留める。

この前提では、「メールアドレスを入力して、そのメールへ確認リンクを送る」本番フローは Cloudflare だけでは完全無料にできない。Cloudflare Email Service の Email Sending は Workers Paid plan の機能であり、Workers Free では outbound email が使えないためである。

## 初期の機能範囲

完全無料モードで先に成立させる体験:

1. 招待制でユーザーを作成または参加させる。
2. 招待 URL で対局を作成する。
3. `GameRoom` Durable Object で対局を進行する。
4. 合法手検証、投了、時間切れ、通信断復旧を server authoritative に扱う。
5. DO storage に authoritative event を保存する。
6. D1 に履歴を投影する。
7. 対局履歴と棋譜再生を見られる。

完全無料モードで初期必須にしないもの:

- Cloudflare Email Sending。
- custom domain。
- public signup。
- パスワードリセットメール。
- メール確認必須の登録。
- R2 への長期棋譜 archive。
- Queue retention へ依存する復旧。
- 観戦、コメント、レート戦、大会機能。

## 認証とメール

`MailAdapter` は最初から境界として作るが、完全無料モードでは outbound email を送らない。

推奨 adapter:

- `DevLogMailAdapter`
  - local development 専用。
  - magic link や確認 URL を terminal / local log に出す。
  - production では使わない。
- `DisabledMailAdapter`
  - 完全無料 production 用。
  - メール送信を必要とする操作を明示的に無効化する。
  - public signup、password reset、email verification required flow は閉じる。
- `ProviderMailAdapter`
  - 将来用。
  - Cloudflare Email Service、外部 transactional email provider、または既存の無料枠 provider へ差し替える。

初期の認証方式:

- 招待制を基本にする。
- 管理者が初期ユーザーを作成できる運用 command を用意する。
- 最初は推測困難な招待リンクで初回 session を作る。
- OAuth または passkey は、provider 条件、WebAuthn の RP ID、callback URL、secret 管理を確認してから有効化する。
- メールアドレスは `user_private_profiles` に任意で保存できるが、完全無料モードでは `email_verified_at` を必須にしない。
- public signup を有効化する場合は、実メール送信手段と bot 対策を決めてからにする。

無料のままメールっぽい確認をしたい場合の代替案:

- 既に Cloudflare 管理の domain がある場合だけ、Email Routing で inbound mail を受け、ユーザーから確認コードつきメールを送ってもらう方式を検討できる。
- ただし domain が無い場合は domain cost が発生するため、完全無料前提の本線にはしない。

## Realtime / Durable Object

1 局 = 1 `GameRoom` Durable Object は完全無料モードでも採用する。

無料枠向けの制御:

- WebSocket Hibernation を使う。
- heartbeat を高頻度にしない。
- presence event は棋譜 event として保存しない。
- `serverSeq` を進めるのは durable game event だけにする。
- DO storage へ毎手 event と current state を保存する。
- 大きな snapshot を毎手保存しない。
- 終局後、D1 projection 完了を確認して DO storage の event log / outbox を削除または圧縮する。

## D1 Projection

完全無料モードでは、D1 を対局中の authoritative state にしない。

初期方針:

- DO storage を対局中の正とする。
- D1 は履歴、一覧、棋譜再生用の query store とする。
- `game_events` は `UNIQUE (game_id, server_seq)` と `UNIQUE (game_id, event_id)` を持つ。
- projection checkpoint は gap なしで連続投影済みの最大 `serverSeq` とする。
- D1 projection の遅延や失敗で対局 UX を止めない。

Queues は Workers Free でも利用できるが、10,000 operations/day と 24h retention の制約がある。初期完全無料モードでは Queues を必須にせず、`GameRoom` の outbox + DO Alarm を標準にする。

実装の切り替え:

```text
PROJECTION_TRANSPORT=do-outbox
QUEUE_PROJECTION_ENABLED=false
```

将来、Queue operations に余裕があることを確認できたら、projection batch を小さくまとめて Queues を使えるようにする。

## R2 と IaC State

R2 は初期から IaC remote state の置き場所として使える。ただし、完全無料モードではアプリ側の archive 依存を増やさない。

- `terraform.tfstate` や Pulumi state は repo に置かない。
- R2 state bucket は bootstrap resource として扱う。
- アプリの棋譜 archive は初期必須にしない。
- D1 履歴で利用者向けの棋譜再生を成立させる。
- 長期 archive が必要になったら R2 へ圧縮 export する。

## Feature Flags

完全無料モードの初期値:

```text
PUBLIC_SIGNUP_ENABLED=false
EMAIL_DELIVERY=disabled
EMAIL_VERIFICATION_REQUIRED=false
AUTH_INVITE_ONLY=true
AUTH_INVITE_LINK_LOGIN_ENABLED=true
AUTH_PASSKEY_ENABLED=false
AUTH_OAUTH_ENABLED=false
PROJECTION_TRANSPORT=do-outbox
QUEUE_PROJECTION_ENABLED=false
R2_GAME_ARCHIVE_ENABLED=false
CUSTOM_DOMAIN_ENABLED=false
```

OAuth や passkey を使う場合は、provider 側の利用条件、client secret 管理、callback URL、WebAuthn の RP ID を別途確認する。完全無料を最優先する場合、最初は管理者発行の招待リンクで session を作るところから始めるのが一番単純である。

## 実装順

1. `wrangler.jsonc` に Workers Free 前提の bindings を定義する。
2. D1 migrations を作成する。
3. `GameRoom` Durable Object と DO migrations を作る。
4. `AuthAdapter` と `MailAdapter` の interface だけ先に切る。
5. `DisabledMailAdapter` と invite-only auth を実装する。
6. 招待対局作成、参加、着手、投了、時間切れを通す。
7. DO outbox + alarm で D1 projection を実装する。
8. 再接続で snapshot / event diff 復元できるようにする。
9. 履歴一覧と棋譜再生を実装する。
10. 完了対局の DO cleanup を実装する。
11. local development と staging smoke test で無料枠消費量を測る。

## 無料枠での注意点

無料枠で壊れやすい箇所:

- Workers CPU 10ms/request に password hash や重い棋譜処理が収まらない。
- D1 rows written が毎手の index 更新や統計更新で増える。
- DO rows written が event、state、outbox、alarm、delete で増える。
- Queues operations が 1 event = 1 message の設計で増える。
- `workers.dev` で公開 signup を開けると bot による signup / invite 作成が増える。
- Email Sending が必要になった時点で Cloudflare Workers Free だけでは完結しない。

対策:

- public signup は閉じる。
- 招待作成に rate limit を置く。
- Queue を初期必須にしない。
- D1 projection を batch できる event payload にする。
- `games` summary の毎手 update を避ける。
- 監査ログは保持期間を持たせる。
- 完了対局の DO storage は projection 完了後に削除または圧縮する。

## 有料化または外部 provider への移行条件

以下のどれかが必要になったら、完全無料モードから移行する。

- 実メールでの登録確認、magic link、password reset が必要。
- public signup を安全に開けたい。
- Cloudflare Email Service の Email Sending を使いたい。
- Queues の 10,000 operations/day または 24h retention が足りない。
- D1 / DO の daily rows read / written が継続的に上限の 30-50% に近づく。
- Workers CPU 10ms/request に rule validation、auth、export が収まらない。
- Workers Logs の保持期間や Logpush が必要。
- 独自 domain、運用監視、公開サービスとしての信頼性を上げたい。

## 参照

- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Email Service pricing](https://developers.cloudflare.com/email-service/platform/pricing/)
- [Cloudflare Queues Free plan changelog](https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
