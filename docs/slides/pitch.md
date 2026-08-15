---
marp: true
theme: default
paginate: true
size: 16:9
header: 'Personal Cinema'
style: |
  section {
    background: #0b0d12;
    color: #e7ecf3;
    font-family: "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif;
    padding: 60px 70px;
  }
  section.lead { text-align: center; justify-content: center; }
  h1 { color: #fff; font-size: 60px; letter-spacing: .02em; }
  h2 { color: #7dd3fc; font-size: 40px; border-bottom: 1px solid #22303f; padding-bottom: 12px; }
  h3 { color: #fbbf24; font-size: 28px; }
  strong { color: #fbbf24; }
  code { background: #161b23; color: #7dd3fc; }
  table { font-size: 24px; }
  th { color: #7dd3fc; }
  blockquote { border-left: 4px solid #7dd3fc; color: #b9c6d6; padding-left: 20px; }
  header { color: #4b5b6e; font-size: 18px; }
  footer, section::after { color: #4b5b6e; }
  .big { font-size: 34px; line-height: 1.6; }
  .kpi { font-size: 46px; color: #fbbf24; }
---

<!-- _class: lead -->

# Personal Cinema

## 映画を「探す場所」ではなく、<br>あなたの映画人生をつくる場所

Team Skynet / Supabase × Devin Hackathon

---

## 課題：観たあとの記憶が、どこにも残らない

- 配信サービスは**「次に何を再生させるか」**しか設計していない
- 観た記録は各サービスに散らばり、**自分の映画史が手元に残らない**
- 「なぜこれを勧められたのか」が不明なので、推薦を信じられない

> 年間 100 本観ている人ほど、自分の趣味を言葉にできない。

---

## ターゲット：年 30 本以上観る「映画生活者」

- レビューは書かないが、**観た記録は残したい**ライト〜ミドル層
- 感想を語りたいが、SNS の点数バトルには参加したくない人
- 既存サービスの「みんなの平均点」では自分の好みが説明されない人

**インサイト**：欲しいのは検索エンジンではなく、**自分の鏡**。

---

## ソリューション：評価が「自分の DNA」に育つ

観る → 評価する → **Cinema DNA** が更新される → **CineType** が育つ →
棚が増える → 推薦精度が上がる

<div class="big">

映画を消費するたびに、**あなた自身のプロフィールが厚くなる**プロダクト。

</div>

---

## コアループ：1 回の評価がすべてを動かす

| ステップ | 起きること |
| --- | --- |
| 1. 評価 | 0.5〜5.0 の星でレーティング |
| 2. 特徴量 | 作品の 8 軸ベクトルを生成（ルール＋LLM） |
| 3. DNA 更新 | 好き/嫌いの符号付き重みでユーザーベクトルを再計算 |
| 4. 提示 | CineType・Crystal・For You Score が即座に変化 |

**評価が即フィードバックになるので、離脱せず溜まる。**

---

## Cinema DNA：好みを 8 軸のベクトルにする

`FEEL` 情緒 / `THINK` 思考 / `IMMERSE` 没入 / `STORY` 物語
`SENSE` 映像美 / `PULSE` 疾走感 / `EXPLORE` 未知 / `DEPTH` 余韻

- 高評価は作品ベクトルへ、低評価は**反対側へ**軸を引っぱる
- 評価が少ないうちは中央値 0.5 に引き戻す**事前分布**で暴れさせない
- 評価本数から `confidence` を算出し、UI 上でも自信度を明示

---

## CineType：16 タイプで「自分の名前」がつく

- 8 軸ベクトルと各タイプ中心ベクトルの**類似度**で判定
- 例：`THE VISIONARY`（世界の設計図を読む人）、`THE DREAMER`（余韻の中に住む人）
- 診断コンテンツと違い、**評価が増えるほど所属タイプが変わる＝育つ**

診断で終わらせず、**プロフィールとして共有できる資産**にした。

---

## For You Score：説明できる推薦

- 出力は 3 点セット：**予測評価 / Match% / Confidence**
- あなたの軸のうち**偏りが大きい軸を重く**して距離を測る
- 外部評価は**弱い事前分布**としてだけ使用（DNA が育つほど影響を下げる）
- 「あなたが 4.5 を付けた〇〇に近い」と**根拠となる近傍作品を提示**

ブラックボックス推薦ではなく、**納得して観られる推薦**。

---

## 可視化：数値ではなく「作品」として見せる

- **Cinema Crystal**：8 軸を多面体として描く SVG（モバイル前提・WebGL 非依存）
- **Taste Universe**：好みの地図上で自分の位置を確認
- **Shelf**：VHS の背表紙表現。標準棚＋カスタム棚をモチーフ付きで並べる

スクリーンショットを撮って**そのまま自慢できる**画面設計。

---

## コミュニティ：点数バトルにしない設計

- レビュー（ネタバレフラグ付き）・Like・Follow・フィード
- 平均点ランキングではなく、**「好みが近い人」からの反応**を中心に
- 相手の CineType が見えるので、**なぜ趣味が合うかが分かる**

---

## アーキテクチャ：外部依存を差し替え可能に

| レイヤ | 役割 |
| --- | --- |
| Movie Provider | TMDB / Mock を差し替え可能な抽象化 |
| Lazy Cache | 触れた作品だけを DB に取り込む（全件同期しない） |
| Feature 生成 | 決定論ルール ＋ 任意の LLM 分類器（バージョン管理付き） |
| Cinema DNA | 評価履歴 × 作品特徴量 → 8 軸 + CineType |
| Recommendation | 説明可能な content-based スコアリング |

**自社データ（評価・棚・DNA）と外部メタデータをスキーマレベルで分離。**

---

## Supabase 活用：Postgres をそのまま本番 DB に

- Prisma の datasource を**ビルド時に自動切り替え**（`DATABASE_URL` が Postgres なら PostgreSQL）
- ローカルは SQLite、本番は **Supabase Postgres** で同一スキーマを `db push`
- 13 モデル（User / Rating / CinemaDna / Shelf / Review / Follow …）を Supabase 上で運用
- 認証・レビューなど first-party データは全て Supabase に集約

**環境変数 1 本で「ローカル → Supabase 本番」に切り替わる構成。**

---

## Devin 活用：仕様書から MVP を組み立てる

- 製品仕様書（v0.3）を渡し、**Devin が MVP をスキャフォールド**（約 4,700 行 / TS・TSX）
- DNA 計算・推薦ロジック・SVG 可視化・PWA まで Devin セッション上で反復
- lint / typecheck / build を Devin に走らせ、**PR 単位でレビューして統合**
- ハッカソン中の追加機能も**チャット指示 → PR** のフローで積み増し

**人間は「プロダクト判断」に集中し、実装反復は Devin に任せた。**

---

## 完成度：実際に触れる状態で提出

- Next.js 15 / React 19 / Prisma / Tailwind、**5 タブ構成が動作**
- PWA（manifest ＋ Service Worker）で**ホーム画面から起動・オフラインシェル**
- TMDB キーなしでも**モックカタログ 36 作品**で全機能を体験可能
- デモアカウント：`demo@personal.cinema` / `cinema2024`

**Vercel Deploy ボタンからスマホだけで再現できる。**

---

## デモシナリオ（90 秒）

1. サインアップ → **オンボーディング評価**
2. その場で **CineType と Cinema Crystal** が生成される
3. Discover で **For You Score と説明文**を読む
4. 追加評価 → **DNA と推薦が変化**することを見せる
5. Shelf に追加 → **VHS 棚が増える**

---

## 独創性：推薦の出口ではなく「自己像」を作る

- 既存は**作品中心**、Personal Cinema は**ユーザー中心**
- 診断（静的）と推薦（不透明）の間を、**育つベクトル**で埋めた
- 好みを 8 軸で構造化したので、**推薦・可視化・共有が同じデータで説明できる**

---

## インパクト：観た記録が資産になる

- ユーザー：**自分の映画史とアイデンティティ**が手元に残る
- 推薦体験：根拠が見えることで**「観る決断」までの時間が短くなる**
- 拡張性：8 軸ベクトルは**書籍・音楽・アニメへ横展開可能**な共通言語

---

## ロードマップ

- **短期**：DNA の時系列変化（年ごとの自分の遷移）、棚の共有 OG 画像
- **中期**：CineType 近傍ユーザーとの協調フィルタリング併用
- **長期**：他ジャンルへの DNA 拡張、映画館・配信の視聴履歴連携

---

<!-- _class: lead -->

# 映画は消費で終わらない

観るたびに、あなたの Cinema DNA が更新される。

**Personal Cinema** — github.com/kuretechi/Skynet
