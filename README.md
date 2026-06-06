# shogiwoshiyou

Cloudflare Workers 上で動かす将棋対戦アプリ。

- [ユーザー要望](docs/shogi-app/user-requests.md)
- [要件定義](docs/shogi-app/requirements.md)
- [設計書](docs/shogi-app/design.md)
- [初期完全無料で実装する方法](docs/shogi-app/initial-free-implementation.md)

## 初期実装

- Cloudflare Workers + Workers Assets
- Hono API
- Preact + `@preact/signals`
- Vite + Cloudflare Vite plugin
- D1
- Durable Objects + WebSocket
- `tsshogi` による合法手検証
- username/password 登録
- メール送信なし
- 対局作成、参加、着手、投了、履歴保存
- 切断時の WebSocket 再接続と軽い polling fallback

メールアドレスは任意入力で、`users` には持たず `user_private_profiles` に分離して保存します。初期実装ではメール確認、確認メール、パスワードリセットメールは送りません。
この PR では、メール送信なしで動作を確認しやすいように username/password の公開登録を有効にしています。公開運用で登録を制限したい場合は、招待制や管理者作成に切り替えてから deploy してください。

盤面の駒は外部画像素材を使わず、文字を CSS で駒風に表示しています。今後、外部の駒画像、フォント、実在商品の意匠に寄せた素材を使う場合は、追加前にライセンスを確認してください。

## ローカル開発

```bash
pnpm install
pnpm exec wrangler d1 migrations apply shogiwoshiyou --local
pnpm dev
```

起動後、`http://localhost:5173/` を開きます。

検査:

```bash
pnpm typecheck
pnpm lint
pnpm lint:ox
pnpm test
pnpm build
zizmor .github/workflows
```

## 完全無料で始めるデプロイ

Cloudflare の `workers.dev` ドメインを使い、custom domain とメール送信を使わない前提です。GitHub Actions は test / lint / build / zizmor の検査だけを行い、deploy はローカル端末から実行します。

```bash
pnpm exec wrangler login
pnpm exec wrangler d1 create shogiwoshiyou
```

作成された D1 `database_id` を `wrangler.jsonc` に設定します。

```bash
pnpm exec wrangler d1 migrations apply shogiwoshiyou --remote
pnpm deploy
```

repo に置くもの:

- `wrangler.jsonc`
- `migrations`
- `.env.example`
- `.dev.vars.example`

repo に置かないもの:

- `.dev.vars`
- `.env`
- `terraform.tfstate`
- `Pulumi.*.yaml`
- R2 credentials
- Cloudflare API token
