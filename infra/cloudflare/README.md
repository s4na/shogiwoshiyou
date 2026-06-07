# Cloudflare Infra

初期実装は Wrangler を deploy の入口にする。D1 migration、Durable Object migration、Workers Assets の binding はアプリに強く紐づくため、まずは app repo 内の `wrangler.jsonc` と `migrations` で管理する。

IaC を追加する場合は、このディレクトリに OpenTofu / Terraform または Pulumi を置く。state は repo に置かず、Cloudflare R2 remote state を使う。

初期無料運用では、remote state bucket 以外に R2 をアプリ機能へ必須化しない。

deploy / apply はローカル端末から実行し、GitHub Actions には Cloudflare deploy token を持たせない。
