# SkyBlueEarthJapan 経費管理アプリ
## 実装ロードマップ

---

## 概要

本ドキュメントは、経費管理アプリの実装計画を整理したものです。
設計仕様書（SPEC.md等）に基づき、フェーズごとにタスクを分解しています。

### 関連仕様書
| ファイル | 内容 |
|----------|------|
| SPEC.md | 設計仕様書（全体概要） |
| SPEC_IMPLEMENTATION.md | 実装詳細（API設計、状態遷移） |
| SPEC_AI_UI.md | AI設計・Homeプロンプト定義 |
| SPEC_MASTER_UI.md | 勘定科目マスタ・履歴/分析UI文言 |
| UI_DESIGN.md | UIデザインガイドライン |
| DB_SCHEMA.md | メインDBスキーマ（9シート） |
| DB_SCHEMA_ACCOUNTANT.md | 会計士共有用スキーマ（4シート） |

---

## フェーズ構成（全5フェーズ・27タスク）

```
Phase 1: 基盤構築 ──────────────────────────────────┐
   └─▶ Phase 2: 取引入力 ───────────────────────────┤
              └─▶ Phase 3: 履歴 ────────────────────┤
                       └─▶ Phase 4: 分析 ───────────┤
                                └─▶ Phase 5: 会計士共有
```

---

## Phase 1: 基盤構築（5タスク）

### 目的
GAS環境・DBスプレッドシート・共通ユーティリティを整備し、以降の開発基盤を構築する。

### タスク一覧

| # | タスク | 優先度 | 依存 | 詳細 |
|---|--------|--------|------|------|
| 1 | DBスプレッドシート初期化 | P0 | - | 全9シート作成、ヘッダー行設定 |
| 2 | GASプロジェクト基盤セットアップ | P0 | #1 | Code.gs, doGet/doPost設定 |
| 3 | 共通ユーティリティ実装 | P0 | #2 | UUID生成、日付処理、JSONレスポンス |
| 4 | Drive保存ユーティリティ | P0 | #2 | フォルダ作成、ファイル保存 |
| 5 | 定数定義（Config.gs） | P0 | - | シート名、列名、設定値 |

### 成果物
- DBスプレッドシート（9シート構成）
- GASプロジェクト骨格
- Utils.gs, Config.gs

### 参照仕様
- DB_SCHEMA.md: シート構成詳細
- SPEC.md: 6.1 環境変数/設定

---

## Phase 2: 取引入力（8タスク）

### 目的
Home画面でAI音声入力・手入力による取引登録を実現する。

### タスク一覧

| # | タスク | 優先度 | 依存 | 詳細 |
|---|--------|--------|------|------|
| 6 | Home画面UI（HTML/CSS） | P0 | #5 | 音声入力エリア、手入力導線 |
| 7 | 手入力フォーム実装 | P0 | #6 | 全フィールド入力、バリデーション |
| 8 | AI連携（OpenAI API呼び出し） | P0 | #3 | AIService.gs, プロンプト生成 |
| 9 | AI解析結果カード表示 | P0 | #8 | 候補表示、質問UI |
| 10 | Confirm画面UI | P0 | #9 | 最終確認フォーム、編集可能 |
| 11 | confirmTransaction API | P0 | #3 | 取引確定、DB書込み |
| 12 | 音声入力（Web Speech API） | P1 | #6 | 録音→文字起こし→編集可能 |
| 13 | 対話モードUI | P1 | #9 | 質問応答、追加情報収集 |

### 成果物
- home.html
- AIService.gs
- TransactionService.gs (confirmTransaction)
- 音声入力機能

### 参照仕様
- SPEC_AI_UI.md: AI設計全般
- UI_DESIGN.md: 3.1 Home画面設計

---

## Phase 3: 履歴（7タスク）

### 目的
確定済み取引の一覧表示・編集・証憑管理を実現する。

### タスク一覧

| # | タスク | 優先度 | 依存 | 詳細 |
|---|--------|--------|------|------|
| 14 | History画面一覧UI | P0 | #11 | 取引カード、月次サマリー |
| 15 | listTransactions API | P0 | #3 | フィルタ対応、ページネーション |
| 16 | フィルタ/検索機能 | P1 | #15 | 種別、科目、取引先、期間 |
| 17 | 詳細Drawer/Modal | P0 | #14 | 取引詳細表示、編集モード |
| 18 | updateTransaction API | P0 | #15 | 更新＋Audit Log記録 |
| 19 | 証憑アップロードUI | P1 | #17 | ファイル選択、プレビュー |
| 20 | uploadReceipt API | P1 | #4 | Drive保存、URL記録 |

### 成果物
- history.html
- TransactionService.gs (list, update, void)
- ReceiptService.gs

### 参照仕様
- SPEC_MASTER_UI.md: 2. 履歴画面UI文言
- SPEC.md: 2.2 History画面仕様

---

## Phase 4: 分析（5タスク）

### 目的
事業状況の可視化（KPI、グラフ、概算税額）を実現する。

### タスク一覧

| # | タスク | 優先度 | 依存 | 詳細 |
|---|--------|--------|------|------|
| 21 | Analytics画面KPI表示 | P1 | #15 | 売上/経費/利益サマリー |
| 22 | getMonthlySummary API | P1 | #3 | 月次集計ロジック |
| 23 | 経費内訳円グラフ | P2 | #22 | Chart.js等でカテゴリ別表示 |
| 24 | 月次推移グラフ | P2 | #22 | 12ヶ月の折れ線/棒グラフ |
| 25 | 概算税額表示 | P2 | #22 | 所得税/住民税概算＋注意書き |

### 成果物
- analytics.html
- AnalyticsService.gs

### 参照仕様
- SPEC_MASTER_UI.md: 3. 分析画面UI文言
- UI_DESIGN.md: 3.3 Analytics画面設計

---

## Phase 5: 会計士共有（2タスク）

### 目的
確定した経費を会計士共有用スプレッドシートへ自動同期する。

### タスク一覧

| # | タスク | 優先度 | 依存 | 詳細 |
|---|--------|--------|------|------|
| 26 | syncAccountantExport API | P0 | #11 | 単一取引の同期処理 |
| 27 | resyncAccountantExport API | P1 | #26 | 月次/全期間の再同期 |

### 成果物
- AccountantService.gs
- 会計士共有用スプレッドシート連携

### 参照仕様
- DB_SCHEMA_ACCOUNTANT.md: 会計士共有シート構造
- SPEC.md: 6.2 syncAccountantExport

---

## 実装順序（推奨）

### Week 1: 基盤＋入力の骨格
```
Day 1-2: #1 DBシート作成, #5 定数定義
Day 3-4: #2 GAS基盤, #3 共通Utils
Day 5:   #4 Drive Utils
```

### Week 2: 取引入力（コア）
```
Day 1-2: #6 Home UI, #7 手入力フォーム
Day 3-4: #8 AI連携, #9 解析結果カード
Day 5:   #10 Confirm UI, #11 confirmTransaction
```

### Week 3: 履歴＋音声
```
Day 1-2: #14 History UI, #15 listTransactions
Day 3:   #17 詳細Modal, #18 updateTransaction
Day 4:   #12 音声入力
Day 5:   #13 対話モード
```

### Week 4: 証憑＋分析
```
Day 1:   #19 証憑UI, #20 uploadReceipt
Day 2:   #16 フィルタ/検索
Day 3-4: #21 Analytics UI, #22 getMonthlySummary
Day 5:   #23-25 グラフ/税額
```

### Week 5: 会計士共有＋調整
```
Day 1-2: #26-27 会計士同期
Day 3-5: バグ修正、UIブラッシュアップ
```

---

## ファイル構成（実装後）

```
expense-app/
├── Code.gs              # エントリーポイント（doGet/doPost）
├── Config.gs            # 定数/設定（シート名、列名）
├── Utils.gs             # UUID、日付、JSONレスポンス
├── TransactionService.gs   # 取引CRUD
├── ReceiptService.gs    # 証憑アップロード
├── AccountantService.gs # 会計士共有同期
├── AnalyticsService.gs  # 分析/集計
├── AIService.gs         # AI連携（OpenAI）
├── index.html           # メインHTML（SPA）
├── home.html            # Home画面テンプレート
├── history.html         # History画面テンプレート
├── analytics.html       # Analytics画面テンプレート
├── styles.css           # 共通スタイル（SkyBlueEarth）
└── app.js               # フロントエンドJS
```

---

## 優先度定義

| 優先度 | 意味 | 対応 |
|--------|------|------|
| P0 | MVPに必須 | 最優先で実装 |
| P1 | MVP推奨 | 時間があれば実装 |
| P2 | 将来拡張 | MVP後に対応 |

---

## 完了定義（Done）

以下をすべて満たした時点でMVP完了とする。

### 機能要件
- [ ] 音声/手入力で取引登録→AI推定→確認→確定ができる
- [ ] 確定した取引が履歴に表示され、編集でき、編集履歴が残る
- [ ] 証憑をアップロードするとDriveに保存され、リンクがDBに残る
- [ ] 確定した経費が会計士共有用シートに即同期される
- [ ] 分析で当月の売上/経費/利益と概算税額が見える

### 非機能要件
- [ ] 入力から確定まで30秒以内
- [ ] モバイルで快適に操作できる
- [ ] エラー時に適切なメッセージが表示される

---

## 備考

- 各タスクの詳細仕様はSPEC_IMPLEMENTATION.mdの「12. API設計詳細」を参照
- UI文言はSPEC_AI_UI.md、SPEC_MASTER_UI.mdに定義済み
- カラーパレット等はUI_DESIGN.mdに従う
