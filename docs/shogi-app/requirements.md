# 将棋対戦アプリ: 要件定義

この文書は、[user-requests.md](./user-requests.md) の要望を、利用者価値と受け入れ可能な振る舞いとして整理する。技術構成、データ構造、API、ライブラリ選定は [design.md](./design.md) で扱う。初期完全無料での実装方法は [initial-free-implementation.md](./initial-free-implementation.md) で扱う。

## User Requests

- Cloudflare 上で将棋対戦アプリを作りたい。
- Hono.js、Preact Signals、Vite+ あたりを使いたい。
- ちゃんと対戦して遊べる将棋アプリにしたい。
- 対局履歴を残したい。
- ユーザー登録、メール登録、メール確認をできるようにしたい。
- 無料枠で進める場合の制約も知りたい。
- ネット対戦として、通信断、リトライ、自動再接続を考慮したい。
- リトライや再接続は過剰にせず、対戦 UX を損なわない範囲にしたい。
- issue ではなく、Markdown 文書を追加する Pull Request として残したい。
- 小さく妥協した試作品ではなく、やりたいことを実現する設計書にしたい。
- 要望、要件、設計は Markdown を分けたい。
- 初期は無料枠や小規模利用を想定しつつ、将来大きくしたときに破綻しない責務境界を持たせたい。
- 過剰設計ではなく、拡張性、変更容易性、置換可能性、観測可能性、整合性を意識した設計にしたい。
- 対局モードとして、持ち時間なしと持ち時間ありを選べるようにしたい。
- 持ち時間ありの場合は、複数の持ち時間プリセットから選べるようにしたい。
- メールアドレスなどの個人情報は `users` テーブルに直接持たせず、ユーザー識別子と分離したい。
- 退会時は個人情報を削除・匿名化しつつ、対局履歴の参照整合性は壊さないようにしたい。
- Cloudflare の構築順を考慮し、DB や管理用の操作面がインターネットへ露出しないようにしたい。
- D1 などのデータストアは Worker binding と認可済み API 経由でのみ扱い、public route から直接操作できないようにしたい。
- Cloudflare への deploy と production migration はローカル端末から Wrangler で実行したい。
- public repo の GitHub Actions は test / lint / build に限定し、本番 deploy 用の Cloudflare token を GitHub に保存しない。
- アプリケーションとアプリに付随する Cloudflare インフラは、まず public app monorepo で管理したい。
- `infra/cloudflare` に Cloudflare IaC を置き、IaC state は R2 remote state に置きたい。
- 将来、account / organization / domain 寄りの基盤が増えたら、その部分だけ別 repo に分けられる境界を持たせたい。
- repo には `wrangler.jsonc`, `migrations`, `infra/cloudflare` の infra code, `.env.example`, `.dev.vars.example` を置きたい。
- repo には `.dev.vars`, `.env`, `terraform.tfstate`, secret を含む `Pulumi.*.yaml`, R2 credentials, Cloudflare API token を置かない。
- アプリ本体と deploy は Wrangler を主担当にする。
- IaC を本当に書きたい部分だけ、Terraform / OpenTofu または Pulumi で管理する。
- IaC state は Cloudflare R2 に置く。
- CI は test / lint / build のみにし、apply / deploy はローカル端末から実行する。
- `s4na/shogiwoshiyou` に対する Pull Request として文書を作り直したい。
- 初期は Cloudflare Workers Free と無料で使える範囲だけで遊べる構成にしたい。
- 初期完全無料運用では、Cloudflare Email Sending、custom domain、paid-only observability、paid-only queue retention などを必須にしない。
- 初期完全無料運用でも、後から実メール送信、public signup、有料 plan、外部 provider へ移れる adapter 境界を残す。

## Context / Goal

オンラインで将棋を指したいユーザーが、アカウントを作成し、相手と対局し、通信状態が不安定でも対局を継続し、終了後に棋譜と履歴を確認できる Web アプリを作る。

完成形では、ユーザーは登録、ログイン、メール確認、対局作成、参加、対局、再接続、履歴閲覧、棋譜再生、棋譜出力まで一連の体験を自然に行える。通信断や短時間の離席は、対局が壊れる原因ではなく、復帰可能な通常ケースとして扱う。

## In Scope

- メールアドレスを使ったユーザー登録。
- メール確認。
- ログイン、ログアウト、セッション管理。
- 表示名など最低限のプロフィール管理。
- 退会時の個人情報削除・匿名化。
- 招待 URL による対局作成と参加。
- 対局者の先後決定。
- 対局作成時の持ち時間設定。持ち時間なし、または持ち時間ありのプリセットを選べる。
- 盤面、持ち駒、手番、最終手、対局状態の表示。
- 駒選択、移動、打ち、成り選択。
- 合法手のみ受け付ける対局。
- 二歩、打ち歩詰め、成り、打ち、王手放置など、通常対局で必要な反則手の拒否。
- 投了、詰み、時間切れ、千日手などの終局扱い。
- 対局中の通信断検知。
- 対局中の自動再接続。
- 再接続時の局面復元。
- 着手送信直後の切断や二重送信への対処。
- 相手の短時間切断時に対局を即終了させない UX。
- 対局履歴一覧。
- 対局詳細。
- 棋譜再生。
- 棋譜の再利用可能な形式での export。
- 不正操作、過剰アクセス、招待 URL 乱用への対策。
- 運用上必要なログ、監査情報、障害調査情報。
- 完了対局の保存量と監査ログが増え続けないための保持期間、削除、圧縮、または archive。
- 無料枠で始める場合の制約把握と、有料化または外部サービス利用が必要になる判断基準の明確化。
- Cloudflare リソースの構築・migration・secrets 設定・公開 route 有効化の順序定義。
- ローカル deploy 前に実行する検査手順と、deploy 実行者・対象環境・commit を確認できる記録。
- public app monorepo 内でのアプリコード、Wrangler 設定、D1 migration、Cloudflare IaC、state backend 設定の配置方針。
- 初期完全無料で動かすための feature flag、認証、メール、projection、archive、公開方法の配置方針。

## Details To Decide

現時点で「やりたいこと」から外す機能は定義しない。ただし、以下は仕様の詳細決定が必要な領域として Open Questions に置く。

- 持ち時間ありの場合の初期プリセット値。
- 秒読み、フィッシャー、カスタム持ち時間を初回から含めるか。
- 入玉宣言法の採用範囲。
- レート戦の計算方式。
- 観戦やコメントの公開範囲。
- メール送信基盤の最終選定。
- 初期完全無料モードでメール確認を必須にしない場合の初期認証方式。

## Out of Scope

- ネイティブ iOS / Android アプリ。
- 現金賞金や大会運営機能。
- AI 解析を必須機能にすること。
- 完全オフライン対局。
- 匿名ユーザーだけで永続対局履歴を残すこと。

## User Stories

1. ユーザーとして、メールアドレスで登録し、メール確認を完了してから対局できるようになりたい。
2. ユーザーとして、相手を招待して将棋の対局を開始したい。
3. 対局作成者として、持ち時間なし、または複数の持ち時間プリセットから対局条件を選びたい。
4. 対局者として、合法手だけが受け付けられる安心できる盤面で指したい。
5. 対局者として、移動中や一時的な通信断が起きても対局へ戻りたい。
6. 対局者として、着手直後に通信が切れても、二重着手や局面の食い違いを起こしたくない。
7. ユーザーとして、過去の対局を一覧し、棋譜を再生して振り返りたい。
8. 運用者として、不正アクセス、過剰な再試行、招待 URL の乱用、障害時の履歴欠損を調査・抑止したい。

## Acceptance Criteria

### 正常系: 登録して対局を開始できる

```gherkin
Given 未登録の利用者がメールアドレスで登録する
When メール確認を完了してログインする
And 持ち時間設定を選んで招待対局を作成し、別のログイン済みユーザーが参加する
Then 先後が確定した対局が開始される
And 両者の画面に同じ初期局面が表示される
And 対局画面には選択した持ち時間設定が表示される
```

### 正常系: 持ち時間なしで対局できる

```gherkin
Given 対局作成者が持ち時間なしを選んで対局を作成する
When 対局者が着手を続ける
Then サーバーは時間切れ event を生成しない
And 対局は投了、詰み、千日手など時間以外の終局条件で終了する
```

### 例外系: 持ち時間ありで時間切れが判定される

```gherkin
Given 対局作成者が持ち時間ありのプリセットを選んで対局を作成する
And 手番側の残り時間がなくなる
When サーバーが期限超過を検知する
Then 時間切れ event が 1 回だけ確定する
And 勝敗と履歴に時間切れ理由が記録される
```

### 正常系: 合法手が同期され履歴に残る

```gherkin
Given 対局者 A と対局者 B が同じ対局に参加している
When A が合法手を指す
Then B の画面にその着手が反映される
And 対局履歴に着手順、局面、消費時間が記録される
And 対局詳細からその手順を再生できる
```

### 正常系: 通信断から復帰できる

```gherkin
Given 対局中に片方のリアルタイム接続が切断された
When 利用者の通信が復旧する
Then 自動的に再接続が試行される
And 最新局面または未取得イベントから対局画面が復元される
And 対局が二重進行しない
```

### 正常系: 退会後も履歴を壊さず個人情報を消せる

```gherkin
Given 過去に対局履歴があるユーザーが退会する
When 退会処理が完了する
Then メールアドレス、認証情報、セッションは削除または匿名化される
And 過去の対局履歴と棋譜 export は参照できる
And 履歴上の表示名は退会済みユーザーとして扱われる
```

### 正常系: 公開前にデータストアが保護されている

```gherkin
Given production 環境を初めて公開する
When custom domain または public route を有効化する
Then D1、Durable Objects、Queues、R2 は public internet から直接操作できない
And migration、secrets、認証、CSRF、Origin 検証、rate limit が設定済みである
And production 以外の環境は production データストアを参照していない
```

### 正常系: ローカルから本番 deploy できる

```gherkin
Given main branch の検査が通っている
And deploy 実行者のローカル端末に最小権限の Cloudflare token が設定されている
When deploy 実行者がローカル端末から production migration と `wrangler deploy --env production` を実行する
Then GitHub Actions に本番 Cloudflare token は保存されていない
And deploy 対象の commit、environment、migration version が確認できる
```

### 正常系: 初期完全無料モードで対局できる

```gherkin
Given production 環境が Workers Free と `workers.dev` で公開されている
And Cloudflare Email Sending、custom domain、Queue projection、R2 game archive が無効である
And public signup が無効で、招待制またはメール送信不要の認証方式が有効である
When 招待済みユーザーがログインして対局を作成し、相手が参加する
Then Cloudflare Email Sending を使わずに対局を開始できる
And 着手、再接続、終局、履歴閲覧が DO storage と D1 projection で成立する
And GitHub Actions に apply / deploy job と本番 Cloudflare token は存在しない
```

### 例外系: 非合法手は受け付けない

```gherkin
Given 対局者が現在局面では指せない手を送信する
When サーバーがその着手を検証する
Then 着手は拒否される
And 盤面、手番、履歴は更新されない
And 利用者には対局を続行できる状態が表示される
```

### 例外系: 同じ着手が再送されても重複しない

```gherkin
Given 対局者が着手を送信した直後に通信が切断された
When 再接続後に同じ着手が再送される
Then 既に受理済みの着手は重複登録されない
And 未受理の着手は同じ局面の場合だけ再送される
And 局面が変わっている場合は最新局面に復元される
```

## Non-functional Requirements

### Performance

- 対局中の着手反映は、通常のネットワーク状態で 1 秒以内を目標にする。
- 対局画面の操作は、着手候補表示や成り選択で明確な遅延を感じさせない。
- 履歴一覧はページングされ、対局数が増えても初期表示が重くならない。
- 棋譜再生は長手数の対局でも UI を固めない。

### Cost

- Cloudflare 無料枠での小規模検証が可能な構成を保つ。
- メール送信など無料枠では実現できない領域は、外部サービスまたは有料プランへ切り替えられるようにする。
- 書き込み回数、リアルタイム通信 message 数、履歴保存量が無制限に増えないようにする。
- 対局中の authoritative storage と履歴用 projection の二重書き込みによる rows written 消費を見積もれるようにする。
- 無料枠では小規模利用を前提にし、過剰最適化ではなく消費量の測定と有料化判断ができるようにする。

### Security

- 対局操作は認証済みユーザーだけが行える。
- D1、Durable Objects、Queues、R2 などのデータストアは public internet へ直接公開しない。
- DB 操作は Worker binding、migration command、または認可済みの内部処理に限定し、公開 API から任意 SQL や管理操作を実行できない。
- 本番 custom domain / route / public signup を有効化する前に、認証、CSRF、Origin 検証、rate limit、Turnstile、secrets、migration を完了している。
- 本番 deploy に必要な Cloudflare token は GitHub repository secrets に置かず、deploy 実行者のローカル環境または個人の secret manager で管理する。
- `users` は対局履歴の安定識別子を持つテーブルとし、メールアドレスなどの個人情報を直接保存しない。
- メールアドレス、認証アカウント、確認 token、セッションなどの個人情報・認証情報は、削除または匿名化しやすいテーブルに分離する。
- WebSocket 再接続用の識別子は認可の根拠にしない。
- 対局参加者以外は対局者として着手できない。
- 招待 URL は推測困難で、期限、使用状態、取り消し状態を持つ。
- メール確認、セッション、パスワードまたは代替認証方式は安全に扱う。
- 過剰な登録、ログイン試行、対局作成、着手送信を抑止する。
- state-changing request は CSRF と Origin 検証を行う。
- 登録、ログイン開始、パスワードリセット、招待作成など abuse を受けやすい入口には bot 対策を設ける。
- WebSocket は handshake だけでなく、状態変更 message ごとに session、権限、active control、rate limit を検証する。
- 招待 URL は raw token を保存せず、期限、使用回数、取り消し、seat claim を扱える。

### Auditability

- 着手、投了、終局、再接続、拒否された着手、重要な認証イベントを追跡できる。
- 障害時に、どの局面が authoritative だったか確認できる。
- 利用者向け履歴と運用者向け監査ログの目的を分ける。
- 監査ログは保持期間と削除方針を持ち、履歴保存や無料枠を圧迫し続けない。
- 棋譜に残す durable event と、接続状態だけの ephemeral event を分けられる。
- 退会後も対局履歴は壊さず、表示上は退会済みユーザーとして扱える。
- 退会後の履歴、監査ログ、export にメールアドレスなどの個人情報が残らない。

### Operations

- 対局中 state、履歴用 state、認証 state の責務が分かれている。
- メール送信、認証、棋譜処理、通信復帰はそれぞれ障害時のふるまいが定義されている。
- 退会処理は認証情報・個人情報の削除と、対局履歴の参照保持を分けて扱える。
- 構築順は private resources first, public routes last を基本にし、D1 作成、migration、secrets 設定、Worker deploy、smoke test、public route 有効化を段階的に進める。
- dev / staging / production は別リソースを使い、preview や開発環境が production D1、Queue、R2、secrets を参照しない。
- CI は public repo での test / lint / build に限定し、Cloudflare への apply、deploy、production migration はローカル手動操作にする。
- secret、state file、binding 分離の検査は、必要に応じて lint / build 内の repository check として扱い、CI に Cloudflare apply / deploy job は置かない。
- ローカル deploy は main branch の特定 commit から実行し、deploy 前後の checklist、migration status、Worker version を記録する。
- app に付随する Worker、D1、D1 migrations、Durable Object migrations、Queues、R2 bindings、`wrangler.jsonc` は app monorepo に置く。
- app monorepo には `migrations`, `infra/cloudflare` の infra code, `.env.example`, `.dev.vars.example` も置き、ローカル開発と検査に必要な形だけを共有する。
- `.dev.vars`, `.env`, `terraform.tfstate`, secret を含む `Pulumi.*.yaml`, R2 credentials, Cloudflare API token は repo に置かない。
- account bootstrap、R2 state bucket 作成、DNS、custom domain、Zero Trust、複数アプリ共通基盤は、必要になった時点で別 repo に分離できる。
- IaC state は repo に commit せず、R2 remote state などの外部 backend に置く。
- 履歴 projection の遅延や失敗は対局継続と分離され、復旧手段がある。
- 完了対局の authoritative storage は projection 完了後に安全に削除または圧縮できる。
- projection checkpoint は履歴の欠損を越えて進まず、repair できる。
- 時計と時間切れは server authoritative に判定され、通信断や alarm 遅延で二重終局しない。
- 持ち時間なしの対局では server authoritative clock を勝敗判定に使わず、時間切れ event を発生させない。
- 持ち時間ありの対局では、選択されたプリセットに基づいて server authoritative clock が残り時間と時間切れを判定する。
- 無料枠から有料プランまたは外部 provider へ移る判断基準が明確である。
- 主要処理の CPU 時間、保存・取得処理、リアルタイム再接続、同期失敗を観測できる。

### Maintainability / Evolvability

- 初期実装を軽くしても、Auth、Mail、Rule Engine、Projection、Clock、Archive、Observability の責務境界が見える。
- 対局の authoritative state、履歴 projection、通信状態、認証、時計、将棋ルールが密結合にならない。
- 将来のライブラリ差し替え、外部 provider 変更、有料プラン移行、保存先追加が、対局の中核ロジック全体を書き換えなくても検討できる。
- 将来の破壊的変更は許容できるが、責務の不足や正の所在の誤りによる履歴欠損、勝敗事故、認可事故は避ける。

## Open Questions

- 持ち時間ありの初期プリセットをどの値にするか。例: 3 分、5 分、10 分、15 分、30 分。
- 秒読み、フィッシャー、カスタム持ち時間を初回から入れるか、まずは持ち時間なしと切れ負け型プリセットに絞るか。
- 千日手、連続王手の千日手、入玉宣言法をどのルールセットで扱うか。
- レート戦を初回公開時から有効にするか、まずは非レート対局を中心にするか。
- 観戦、コメント、検討モードの公開範囲と権限をどうするか。
- メール認証は password + email verification、magic link、OAuth 併用のどれを主軸にするか。
- 本番メール送信は Cloudflare Email Service、外部 transactional email provider、または併用のどれにするか。
- 棋譜 export の最初の正式対応形式は KIF、CSA、SFEN/USI のどれにするか。
