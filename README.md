# Personal Cinema

映画を探す場所ではなく、あなたの映画人生をつくる場所。
`personal_cinema_product_spec_v0.3` の MVP 実装です。

観る → 評価する → Cinema DNA が更新される → CineType が育つ → 棚が増える → 推薦が良くなる、
というループを一通り動く形にしています。

## 実装済みの範囲

- 認証（Cookie セッション）とオンボーディング（初期評価 → DNA 生成 → CineType 提示）
- 5 タブ構成: Home / Discover / Shelf / DNA / Community + 映画詳細 + プロフィール
- Cinema DNA 8 軸（FEEL / THINK / IMMERSE / STORY / SENSE / PULSE / EXPLORE / DEPTH）
- CineType 16 タイプ判定（8 軸ベクトルとタイプ中心ベクトルの類似度）
- For You Score: 予測評価 + Match% + Confidence + 説明文
- Shelf は VHS スパイン表現。標準棚（Watched / Favorites / Want to Watch）+ カスタム棚
- Cinema Crystal / Taste Universe は軽量 SVG（モバイル前提、WebGL 非依存）
- レビュー（ネタバレフラグ）、Like、Follow、Community Feed
- PWA manifest + Service Worker（オフラインシェル）

## アーキテクチャ

| レイヤ | 場所 | 役割 |
| --- | --- | --- |
| Movie Provider | `src/lib/movies/` | 外部メタデータ取得の抽象化。TMDB / Mock を差し替え可能 |
| Lazy Cache | `src/lib/movies/repository.ts` | ユーザーが触れた映画だけを DB に取り込む（全件同期はしない） |
| Feature 生成 | `src/lib/features/` | 決定論ルール + 任意の LLM 分類器のハイブリッド。バージョン付き |
| Cinema DNA | `src/lib/dna/` | 評価履歴 × 映画特徴量からユーザー 8 軸ベクトルと CineType |
| Recommendation | `src/lib/recommend/` | 説明可能な content-based スコアリング |

First-party データ（評価・棚・DNA・レビュー）と外部メタデータ（TMDB キャッシュ、外部評価）は
スキーマレベルで分離しています。

## セットアップ

```bash
npm install
cp .env.example .env      # AUTH_SECRET を設定（未設定でも開発用の既定値で動作）
npm run setup             # prisma generate + db push + seed
npm run dev
```

デモアカウント: `demo@personal.cinema` / `cinema2024`

### スマホ / ブラウザだけで開発する（GitHub Codespaces）

リポジトリの **Code → Codespaces → Create codespace** から起動すると、`.devcontainer` が
依存インストール・`.env` 生成・DB シードまで自動で行います。起動後は `npm run dev`、
転送された 3000 番ポートの URL をブラウザで開けます。

TMDB を使う場合は、リポジトリ設定の **Settings → Secrets and variables → Codespaces** に
`TMDB_API_KEY` を登録してから codespace を作成してください（未登録ならモックカタログで動作）。

なお、このアプリはサーバー処理（Server Actions / API Route / DB）が必須のため、
静的配信のみの GitHub Pages では動作しません。

### スマホに PWA としてインストールする（Vercel + Neon）

すべてスマホのブラウザだけで完了します。

1. https://neon.tech でサインアップし、プロジェクトを作成して接続文字列（`postgresql://...`）をコピー
2. https://vercel.com に GitHub アカウントでサインインし、このリポジトリを Import
3. Environment Variables に以下を設定して Deploy
   - `DATABASE_URL` = Neon の接続文字列
   - `AUTH_SECRET` = 任意の 32 バイト以上のランダム文字列
   - `TMDB_API_KEY` = TMDB の API キー（省略時はモックカタログ）
4. 発行された `https://<project>.vercel.app` をスマホで開き、共有メニューから「ホーム画面に追加」

`DATABASE_URL` が `postgres://` / `postgresql://` で始まる場合は Prisma の datasource が
自動で PostgreSQL に切り替わります（`scripts/sync-prisma-schema.mjs`）。ローカルはそのまま SQLite です。
スキーマ反映は Vercel のビルド（`vercel-build`）で `prisma db push` が実行されます。
デモデータが必要なら、Neon の接続文字列を `DATABASE_URL` に入れてローカルで `npm run db:seed` を実行してください。

## 環境変数

| 変数 | 未設定時の挙動 |
| --- | --- |
| `TMDB_API_KEY` | 同梱のモックカタログ（36 作品）で動作 |
| `OPENAI_API_KEY` | 特徴量生成が決定論ルールのみになる |
| `AUTH_SECRET` | 開発用の固定鍵にフォールバック（本番では必ず設定） |
| `DATABASE_URL` | 未設定なら `.env` の SQLite（`file:./dev.db`）。Postgres URL を渡すと PostgreSQL に切り替わる |

TMDB を利用する場合は、TMDB の最新の利用条件とアトリビューション要件に従ってください。
外部映画サイトのスクレイピングは行いません。

## スクリプト

```bash
npm run dev        # 開発サーバー
npm run build      # 本番ビルド
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run db:seed    # デモデータ投入
```

## 仕様書で TBD の項目

`src/lib/config.ts` に暫定値としてまとめてあります（オンボーディングの評価本数など）。
プロダクト仕様として確定したものではありません。
