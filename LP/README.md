# StoryCanon LP

`index.html` は、StoryCanon の既存UI（オフホワイト、墨色、セージグリーン、細い罫線）に合わせた静的ランディングページです。外部ライブラリや画像に依存しないため、そのまま静的ホスティングできます。

## 公開前の設定

`index.html` にある次のURLを、実際のStoryCanonログインURLに置き換えてください。

```text
https://YOUR-STORYCANON-APP-URL/login
```

## Google Sitesでの利用

Google SitesはHTML/CSSファイル一式を直接アップロードしてページ化する機能を持たないため、以下のいずれかで利用します。

1. `LP` フォルダを Cloudflare Pages、GitHub Pages、Firebase Hosting などの静的ホスティングに公開する。
2. Google Sites の編集画面で **挿入 → 埋め込む → URL** を選ぶ。
3. 公開した `index.html` のURLを貼り付け、表示サイズを横幅いっぱいに調整する。

Google Sites上でネイティブに再現する場合は、見出し・本文・3列カード・CTAボタンの構成をこのファイルからコピーして配置してください。Google Sites内のボタンリンクには、上記ログインURLを設定します。
