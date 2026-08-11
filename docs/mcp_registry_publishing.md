# MCP レジストリへの公開手順

StoryCanon 自身が MCP サーバーである以上、MCP レジストリ／ディレクトリは最も見込みの高い流入経路になる。
そこを見ている人は全員 MCP クライアントを持っているので、新規ドメインの SEO とは即効性が違う。

マニフェストはリポジトリ直下の [`server.json`](../server.json)。

> **公開は手動作業。** 認証にアカウント資格情報と DNS レコードの変更が必要なため、
> 以下は人間が実行すること。

## 1. 公式レジストリ (registry.modelcontextprotocol.io)

現在プレビュー中。破壊的変更やデータリセットがありうる。

### 名前空間の選択

`server.json` の `name` は、認証方法によって形式が決まる。

| 認証方法 | 名前の形式 | StoryCanon の場合 |
| --- | --- | --- |
| ドメイン (DNS) | `<reverse-dns>/*` | `jp.softglow/storycanon` ← 現在の設定 |
| GitHub | `io.github.<user>/*` | `io.github.exp3/storycanon` |

DNS 認証のほうが名前としては素直だが、**TXT レコードをドメインのapex (`softglow.jp`) に置く必要がある**。
サブドメインやセレクタ配下 (`_mcp-auth.softglow.jp` など) では認証が通らない。
DNS を触りたくない場合は `name` を `io.github.exp3/storycanon` に書き換えて GitHub 認証を使う。

### DNS 認証で公開する場合

macOS の標準 `openssl` は LibreSSL で Ed25519 の鍵生成に対応していないため、
Homebrew の OpenSSL 3 を明示的に使う。

```bash
brew install openssl@3
```

鍵を作り、TXT レコードの値を出力する:

```bash
/opt/homebrew/opt/openssl@3/bin/openssl genpkey -algorithm Ed25519 -out key.pem
```

```bash
PUBLIC_KEY="$(/opt/homebrew/opt/openssl@3/bin/openssl pkey -in key.pem -pubout -outform DER | tail -c 32 | base64)" && echo "softglow.jp. IN TXT \"v=MCPv1; k=ed25519; p=${PUBLIC_KEY}\""
```

出力された TXT レコードを `softglow.jp` の apex に登録してから、`mcp-publisher` で公開する。
鍵をローテーションしたときは、**古い TXT レコードを必ず消すこと**。残っていると先に試されて検証に失敗する。

`key.pem` はリポジトリにコミットしないこと。

### GitHub 認証で公開する場合

```bash
mcp-publisher login github
```

デバイスコードを求められるので、表示された URL とコードで認証する。

### 公開

```bash
mcp-publisher publish
```

## 2. その他のディレクトリ

公式レジストリを集約しているところもあるが、個別に登録が必要なものもある。
いずれも登録要件は変わりやすいので、着手時に各サイトの現在の要件を確認すること。

- Smithery
- Glama
- PulseMCP
- mcpservers.org
- `awesome-mcp-servers` への PR
- Anthropic の Connector Directory（申請枠があれば）

## 3. 更新時

`version` は公開のたびに上げる。レジストリはバージョンごとに履歴を持つ。
エンドポイント URL が変わった場合は `remotes[].url` を直して再公開する。
