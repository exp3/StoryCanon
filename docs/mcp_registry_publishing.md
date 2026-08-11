# MCP レジストリへの公開手順

StoryCanon 自身が MCP サーバーである以上、MCP レジストリは最も見込みの高い流入経路になる。
そこを見ている人は全員 MCP クライアントを持っているので、新規ドメインの SEO とは即効性が違う。

マニフェストはリポジトリ直下の [`server.json`](../server.json)。

> **公開は手動作業。** DNS レコードの変更と署名鍵の操作が必要なため、以下は人間が実行すること。

## 方針

`softglow.jp` の所有を証明する **DNS 認証** を使う。GitHub 認証も選べるが、
GitHub アカウントを紐づけたくないため採用しない。

- レジストリ上の名前： `jp.softglow/storycanon`（`server.json` の `name`。設定済み）
- 証明する対象： ドメイン `softglow.jp`
- 鍵の方式： **ECDSA P-384**

### なぜ Ed25519 ではなく ECDSA P-384 か

公式ドキュメントの既定は Ed25519 だが、macOS 標準の `openssl` は LibreSSL で
Ed25519 の鍵生成に対応していない（`Algorithm Ed25519 not found` になる）。
ECDSA P-384 は LibreSSL でも動くため、追加インストールが不要。
このリポジトリの開発機（LibreSSL 3.3.6）で動作確認済み。

---

## 手順

### 1. mcp-publisher を入れる

```bash
brew install mcp-publisher
```

### 2. 署名鍵を作る

**鍵はリポジトリの外に置くこと。** 誤ってコミットすると、レジストリ上の
StoryCanon を第三者が更新できるようになる。

```bash
mkdir -p ~/.storycanon-mcp && chmod 700 ~/.storycanon-mcp && openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:secp384r1 -out ~/.storycanon-mcp/key.pem && chmod 600 ~/.storycanon-mcp/key.pem
```

### 3. TXT レコードの値を出力する

```bash
echo "v=MCPv1; k=ecdsap384; p=$(openssl ec -in ~/.storycanon-mcp/key.pem -text -noout -conv_form compressed 2>/dev/null | grep -A4 'pub:' | tail -n +2 | tr -d ' :\n' | xxd -r -p | base64)"
```

`v=MCPv1; k=ecdsap384; p=...` という1行が出る。これを次で使う。

### 4. Route 53 に TXT レコードを追加する

> ### ⚠️ 既存のレコードを消さないこと
>
> `softglow.jp` の apex にはすでに TXT レコードが1件ある。
>
> ```
> "google-site-verification=IyKvOAt6SEodwseFcfdRpnzcW8DrSTyymPEjS_yY5Tc"
> ```
>
> Route 53 は同じ名前・同じタイプの値を**1つのレコードセットにまとめて保持する**。
> 新規作成しようとすると衝突し、CLI で新しい値だけを `UPSERT` すると
> **上の Google の値が消える**。Search Console の所有権確認が外れる。
>
> 必ず「新規作成」ではなく**既存レコードセットの編集**で、値を1行**追加**する。

対象のホストゾーンは次のとおり（`infra/cdk.context.json` より）。

| 項目 | 値 |
| --- | --- |
| ホストゾーン ID | `Z04472712PET24PRE9WTF` |
| ドメイン | `softglow.jp` |
| AWS アカウント | `199041707218` |
| リージョン | `ap-northeast-1` |

**マネジメントコンソールでの操作（推奨）**

1. Route 53 → ホストゾーン → `softglow.jp`
2. レコード一覧から、**名前が空（apex）でタイプが TXT** のレコードを選ぶ
3. 「レコードを編集」
4. 値の欄は複数行入れられる。既存の `"google-site-verification=..."` は**そのまま残し**、
   改行して2行目に手順3の値をダブルクォートで囲んで追加する

   ```
   "google-site-verification=IyKvOAt6SEodwseFcfdRpnzcW8DrSTyymPEjS_yY5Tc"
   "v=MCPv1; k=ecdsap384; p=（手順3で出た値）"
   ```

5. 保存

**反映の確認**

数分かかる。両方の値が返れば成功。

```bash
dig +short TXT softglow.jp @8.8.8.8
```

### 5. ログインして公開する

```bash
mcp-publisher login dns --algorithm ecdsap384 --domain softglow.jp --private-key "$(openssl ec -in ~/.storycanon-mcp/key.pem -noout -text 2>/dev/null | grep -A4 'priv:' | tail -n +2 | tr -d ' :\n')"
```

続けてリポジトリ直下で:

```bash
mcp-publisher publish
```

---

## 補足

### サブドメインでは通らない

TXT レコードは**必ず apex（`softglow.jp`）**に置く。
`_mcp-auth.softglow.jp` のようなセレクタ配下だとレジストリが見つけられず、
署名エラーとして失敗する。

### 鍵をローテーションするとき

古い TXT レコードを**必ず消す**。残っていると先に試されて検証に失敗する。

### エンドポイント側の準備は不要

レジストリは「指定 URL で公開されていること」を要求するが、
`https://storycanon.softglow.jp/mcp` はすでに条件を満たしている
（401 + `WWW-Authenticate`、`/.well-known/oauth-protected-resource/mcp` と
`/.well-known/oauth-authorization-server` がいずれも 200）。
**CDK の変更もデプロイも不要。**

### 更新するとき

`server.json` の `version` を上げてから `mcp-publisher publish` を再実行する。
エンドポイント URL が変わった場合は `remotes[].url` も直す。

### server.json の文字数制限

`publish` が `422 Unprocessable Entity / validation failed` で落ちる場合、
たいていは長さ制限に引っかかっている。エラー本文は切り詰められて理由が読めないので、
先にスキーマで検証したほうが早い。

| フィールド | 制限 |
| --- | --- |
| `description` | **100文字** |
| `title` | 100文字 |
| `name` | 200文字／`^[a-zA-Z0-9.-]+/[a-zA-Z0-9._-]+$` |
| `version` | 255文字 |

手元で検証するには:

```bash
pip3 install jsonschema && curl -s -o /tmp/mcp-server.schema.json https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json && python3 -c "import json,jsonschema; jsonschema.Draft7Validator(json.load(open('/tmp/mcp-server.schema.json'))).validate(json.load(open('server.json'))); print('OK')"
```

### DNS を触りたくない場合の代替

HTTP 認証という方式もある。`/.well-known/mcp-registry-auth` というファイルを
ドメイン上で配信して所有を証明するもので、DNS を一切触らない。
ただし `softglow.jp` の apex は現在何も配信していない（A レコードなし）ため、
使うなら `storycanon.softglow.jp` で配信することになり、
証明できるドメインが変わる結果、名前が `jp.softglow.storycanon/*` になる。

### その他のディレクトリ

公式レジストリを集約しているところもあるが、個別登録が必要なものもある。
登録要件は変わりやすいので、着手時に各サイトの現在の要件を確認すること。

- Smithery / Glama / PulseMCP / mcpservers.org
- `awesome-mcp-servers` への PR
- Anthropic の Connector Directory（申請枠があれば）
