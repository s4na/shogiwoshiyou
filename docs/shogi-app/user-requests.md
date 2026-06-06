# 将棋対戦アプリ: ユーザー要望メモ

この文書は、将棋対戦アプリについてユーザーから出た要望を、後から設計判断の起点を追えるように記録する。要件への整理は [requirements.md](./requirements.md)、それを満たす設計は [design.md](./design.md)、初期完全無料での実装方法は [initial-free-implementation.md](./initial-free-implementation.md) に分ける。

## 元の要望

- Cloudflare で将棋対戦アプリを作る場合、どういう実装になるか検討したい。
- Hono.js、Preact Signals、Vite+ あたりを使いたい。
- ちゃんと対戦して遊べる将棋アプリにしたい。
- 対局履歴を残したい。
- ユーザー登録やメール登録もできるようにしたい。
- 検討内容を GitHub issue として登録したい。

## 追加要望

- Cloudflare の無料枠でやろうとしたときの制約を整理したい。
- ネット対戦だからこそ、通信断、リトライ、自動再接続を考慮したい。
- ただし過剰な仕組みにしたいわけではなく、対戦 UX を損なわない範囲にしたい。
- issue のコメントではなく、本文として整理したい。
- レビュー指摘を踏まえて、設計の方向性を見直したい。
- issue ではなく、Markdown 文書を追加する Pull Request として作り直したい。
- 既存 issue は閉じたい。
- 小さく妥協した試作品ではなく、ちゃんとやりたいことを実現するための設計書に仕上げたい。
- ユーザーからの要望、整理した要件、その要件を満たす設計は別々の Markdown として分けたい。
- 持ち時間は対局モード次第にしたい。持ち時間なしの対局と、持ち時間ありの対局を選べるようにしたい。
- 持ち時間ありの場合は、普通の将棋アプリで選ぶような複数の持ち時間プリセットを持ちたい。
- メールアドレスは `users` テーブルに直接持たせず、ユーザー識別子と個人情報テーブルを分けたい。
- 退会時に対局履歴の参照元である `users` まで消さなくて済むよう、メールアドレスなどの個人情報は削除・匿名化しやすい場所へ分離したい。
- Cloudflare の構築順も考慮し、DB や管理口がインターネットに露出しないようにしたい。
- D1 などのデータストアは公開 route から直接触らせず、Worker の認証済み API / binding 経由でだけ扱いたい。
- Cloudflare への deploy は GitHub Actions ではなく、ローカル端末から Wrangler で行いたい。
- public repo で CI 代を抑えつつ、GitHub に本番 deploy 用の Cloudflare token を置かない運用にしたい。
- アプリケーションとアプリに付随する Cloudflare インフラは、まず public app monorepo で管理したい。
- `infra/cloudflare` ディレクトリに Cloudflare の IaC を置き、IaC state は R2 remote state に置きたい。
- GitHub Actions は検査だけにし、apply / deploy はローカル端末から行う形にしたい。
- Cloudflare の account / organization / domain 寄りの基盤が増えたら、その部分だけ後から別 repo に逃がせるようにしたい。
- repo には `wrangler.jsonc`, `migrations`, `infra/cloudflare` の infra code, `.env.example`, `.dev.vars.example` を置きたい。
- repo には `.dev.vars`, `.env`, `terraform.tfstate`, secret を含む `Pulumi.*.yaml`, R2 credentials, Cloudflare API token を置きたくない。
- アプリ本体と deploy は Wrangler で扱いたい。
- IaC を本当に書きたい部分は Terraform / OpenTofu または Pulumi で扱いたい。
- IaC state は Cloudflare R2 に置きたい。
- CI は test / lint / build のみにしたい。
- apply / deploy はローカル端末から実行したい。
- `s4na/shogiwoshiyou` を `ghq get` した上で、この repo に対して Pull Request を作り直したい。
- 初期は完全無料で楽しめる実装方法も整理したい。
- 完全無料を優先する初期運用では、Cloudflare Email Sending や custom domain など有料化しやすい要素を避けたい。
- ただし将来、実メール送信や公開 signup が必要になったときに Mail adapter や Auth adapter を差し替えられる余地は残したい。

## 設計品質に関する追加要望

- 初期運用は無料枠や小規模利用を想定するが、将来大きくしたときに破綻しない設計にしたい。
- 最初から大規模サービス向けの装備をすべて積む必要はない。
- ソフトウェア品質特性として、拡張性、変更容易性、置換可能性、観測可能性、整合性を意識したい。
- 後から簡単に入れ替えられる責務境界があるなら、将来の破壊的変更は許容できる。
- ただし、そもそも必要な責務、境界、正の所在が足りていない設計にはしたくない。
- 無料枠最適化そのものより、あとで拡張・置換・有料化判断ができる設計の余地を重視する。
- Auth、Mail、Rule Engine、Projection、Clock、Archive、Observability などは、初期実装を軽くしても責務境界だけは見えるようにしたい。
- 抽象化を厚くすることより、authoritative state、履歴、通信、認証、時計、将棋ルールの責務を混ぜないことを重視する。

## レビュー指摘から取り込む観点

- 1 局 = 1 Durable Object によって着手処理を直列化する方針は妥当。
- D1 を対局中の authoritative state ではなく、履歴、一覧、検索、再生の query store として使う分離は妥当。
- メール登録、認証、将棋ルール検証、WebSocket Hibernation、再接続、履歴再生、export、Turnstile、rate limit を一体で考える必要がある。
- Cloudflare Free では Email Sending が使えないため、メール送信は Workers Paid または外部 provider を前提に差し替えられる設計にする。
- Workers Free の CPU 制約を考えると、パスワード認証や棋譜処理は実測が必要。
- Better Auth + Hono + D1 は候補として自然だが、Worker runtime、D1 migration、cookie、password hash を早めに検証する。
- DO から D1 への同期は単一トランザクションにできないため、DO 側 outbox と retry の仕様を明確にする。
- WebSocket Hibernation では in-memory state が消える前提で、constructor 復元や attachment の扱いを設計する。
- 再接続プロトコルには `eventId`、`serverSeq`、`positionKeyHash` を持たせ、不整合検知と調査をしやすくする。
- 再接続用の client instance id を認可の根拠にせず、WebSocket upgrade 時に認証と参加権限を検証する。
- `tsshogi` は有力候補だが、Cloudflare Workers runtime での互換性を検証する。
- Vite+ は初期の本線にせず、まずは Vite + Cloudflare Vite plugin を本線にする。
- Cloudflare Free の DO storage、D1 rows written、Queues operations、subrequest の制約は、対局数と履歴保存に直結するため具体的に扱う。
- DO Alarm は 1 object あたり 1 つだけなので、時間切れ、D1 投影 retry、cleanup を単一 scheduler で扱う。
- D1 投影は Queues または DO outbox で retry し、D1 の遅延や失敗で対局 UX を止めない。
- 完了対局の DO storage は D1 投影完了後に削除または圧縮し、1 object / account storage 上限へ近づかないようにする。
- 複数タブや複数端末で同じ対局を開く場合の active control connection の扱いを決める。
- 認証は request-scoped binding、CSRF、Turnstile、password hash の CPU 制約を前提に設計する。
- `tsshogi` が保証する将棋ルール範囲を検証し、不足があれば server 側補完または代替ライブラリを比較する。
- 無料枠を基本にするが、極限までチューニングするより、消費量を測れて安全に有料化判断できる設計にする。
- `serverSeq` に含める durable game event と、棋譜に残さない ephemeral connection event を分ける。
- projection checkpoint は gap を越えない max contiguous sequence として扱う。
- `positionKeyHash` と `stateHash` を分け、千日手・再接続・snapshot integrity の用途を混ぜない。
- WebSocket の状態変更 message は、handshake 済みでも active control と `controlEpoch` を毎回検証する。
