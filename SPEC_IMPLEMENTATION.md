# SkyBlueEarthJapan 経費管理アプリ
## 実装向け詳細設計仕様（Implementation Spec）

---

## 11. 画面状態遷移（UI State Machine）

### 11.1 全体遷移

```
[Home]
  ├─(音声/手入力開始)
  │
  ├─▶ [AI解析中]
  │        │
  │        ├─▶ [AI質問中（対話）]
  │        │        └─（必要項目充足）
  │        │
  │        └─▶ [AI解析結果表示]
  │                 │
  │                 ├─ 修正
  │                 │     └─▶ [Confirm編集]
  │                 │
  │                 ├─ OK
  │                 │     └─▶ [Confirm編集]
  │                 │
  │                 └─ 破棄 → Home
  │
  └─▶ [Confirm編集]
           │
           ├─ 確定 → 保存 → 履歴へ
           └─ 戻る → AI解析結果表示
```

---

### 11.2 履歴画面遷移

```
[History]
  ├─ 一覧表示
  │
  ├─▶ 詳細表示（Drawer/Modal）
  │        │
  │        ├─ 編集 → 保存 → 一覧更新
  │        │             （Audit Log記録）
  │        │
  │        ├─ 証憑アップロード
  │        │     └─▶ Drive保存 → URL反映
  │        │
  │        └─ 無効化（void）
  │
  └─ フィルタ/検索
```

---

### 11.3 分析画面遷移

```
[Analytics]
  ├─ 当月KPI表示
  ├─ 経費内訳グラフ
  ├─ 月次推移
  └─ 概算税額表示
```

---

## 12. API（GAS関数）設計詳細

### 12.1 共通仕様
- すべて JSON でやり取り
- 日付は `YYYY-MM-DD`
- 金額は number（整数）
- エラー時は `{ success: false, message }`

---

### 12.2 取引登録系

#### createDraftTransaction
**用途**：AI解析途中の一時保存（任意）

```
POST /draft
```

**Request**
```json
{
  "type": "expense",
  "ai_raw": "昨日Amazonで12000円事務用品",
  "ai_suggestion": {
    "date": "2026-01-24",
    "amount": 12000,
    "vendor": "Amazon",
    "description": "事務用品購入",
    "account_title_candidates": ["消耗品費", "雑費"],
    "confidence": 0.82
  }
}
```

**Response**
```json
{
  "success": true,
  "draft_id": "uuid"
}
```

---

#### confirmTransaction
**用途**：取引を確定してDBに保存

```
POST /transaction/confirm
```

**Request**
```json
{
  "type": "expense",
  "date": "2026-01-24",
  "amount": 12000,
  "vendor": "Amazon",
  "description": "事務用品購入",
  "account_title": "消耗品費",
  "payment_method": "card",
  "memo": ""
}
```

**処理**
1. `10_TRANSACTIONS` に confirmed で保存
2. `created_at / updated_at` 自動付与
3. `syncAccountantExport()` 呼び出し

**Response**
```json
{
  "success": true,
  "transaction_id": "uuid"
}
```

---

#### updateTransaction
**用途**：履歴からの修正（監査ログ必須）

```
POST /transaction/update
```

**Request**
```json
{
  "transaction_id": "uuid",
  "updates": {
    "amount": 13000,
    "account_title": "消耗品費"
  }
}
```

**処理**
- before/after を `12_AUDIT_LOG` に保存

**Response**
```json
{
  "success": true
}
```

---

#### voidTransaction
**用途**：取引を無効化（物理削除しない）

```
POST /transaction/void
```

**Request**
```json
{
  "transaction_id": "uuid"
}
```

**処理**
- status を `void` に更新
- `12_AUDIT_LOG` に記録

**Response**
```json
{
  "success": true
}
```

---

### 12.3 履歴取得系

#### listTransactions

```
GET /transactions
```

**Query**
```json
{
  "month": "2026-01",
  "type": "expense",
  "account_title": "消耗品費"
}
```

**Response**
```json
{
  "success": true,
  "items": [
    {
      "id": "uuid",
      "date": "2026-01-24",
      "amount": 12000,
      "vendor": "Amazon",
      "account_title": "消耗品費",
      "receipt_url": "https://drive..."
    }
  ]
}
```

---

#### getTransaction

```
GET /transaction/{id}
```

**Response**
```json
{
  "success": true,
  "transaction": {
    "id": "uuid",
    "type": "expense",
    "date": "2026-01-24",
    "amount": 12000,
    "vendor": "Amazon",
    "description": "事務用品購入",
    "account_title": "消耗品費",
    "payment_method": "card",
    "status": "confirmed",
    "receipt_url": "https://drive...",
    "created_at": "2026-01-24T10:00:00",
    "updated_at": "2026-01-24T10:00:00"
  }
}
```

---

### 12.4 証憑アップロード

#### uploadReceipt

```
POST /transaction/receipt
```

**Request**
- multipart/form-data
  - file
  - transaction_id

**処理**
1. Driveフォルダへ保存（年/月フォルダ自動作成）
2. `11_ATTACHMENTS` に記録
3. `10_TRANSACTIONS.receipt_url` 更新

**Response**
```json
{
  "success": true,
  "fileId": "drive_file_id",
  "url": "https://drive.google.com/..."
}
```

---

#### getReceiptLink

```
GET /transaction/{id}/receipt
```

**Response**
```json
{
  "success": true,
  "url": "https://drive.google.com/..."
}
```

---

### 12.5 会計士共有

#### syncAccountantExport
**用途**：単一取引を会計士共有シートへ同期

```
POST /accountant/sync
```

**Request**
```json
{
  "transaction_id": "uuid"
}
```

**仕様**
- type=expense かつ status=confirmed のみ反映
- 列を整形して `20_ACCOUNTANT_EXPORT` に upsert

---

#### resyncAccountantExport
**用途**：指定月/全期間を再生成（保険）

```
POST /accountant/resync
```

**Request**
```json
{
  "month": "2026-01"
}
```

---

### 12.6 分析系

#### getMonthlySummary

```
GET /analytics/monthly
```

**Query**
```json
{
  "year": 2026,
  "month": 1
}
```

**Response**
```json
{
  "success": true,
  "sales": 200000,
  "expenses": 80000,
  "profit": 120000
}
```

---

#### getCategoryBreakdown

```
GET /analytics/categories
```

**Query**
```json
{
  "year": 2026,
  "month": 1
}
```

**Response**
```json
{
  "success": true,
  "breakdown": [
    { "account_title": "消耗品費", "amount": 30000 },
    { "account_title": "旅費交通費", "amount": 25000 },
    { "account_title": "通信費", "amount": 15000 }
  ]
}
```

---

#### estimateAnnualTax
**用途**：概算税額

```
GET /analytics/tax-estimate
```

**Response**
```json
{
  "success": true,
  "annual_income_estimate": 1440000,
  "income_tax_estimate": 72000,
  "resident_tax_estimate": 144000,
  "note": "概算です。最終計算は会計士/税理士判断に従ってください。"
}
```

---

## 13. AI入出力仕様（厳密版）

### 13.1 Input（AIへ）

```json
{
  "text": "昨日Amazonで12000円事務用品を買った",
  "context": {
    "today": "2026-01-25",
    "vendors": [
      { "name": "Amazon", "default_account_title": "消耗品費" },
      { "name": "楽天", "default_account_title": null }
    ],
    "account_titles": [
      { "code": "01", "name": "消耗品費", "keywords": ["文房具", "事務用品"] },
      { "code": "02", "name": "雑費", "keywords": [] },
      { "code": "03", "name": "通信費", "keywords": ["電話", "インターネット"] }
    ]
  }
}
```

### 13.2 Output（AIから）- 解析成功時

```json
{
  "success": true,
  "type": "expense",
  "date": "2026-01-24",
  "amount": 12000,
  "vendor": "Amazon",
  "description": "事務用品購入",
  "account_title_candidates": [
    {
      "name": "消耗品費",
      "reason": "事務用品のため",
      "confidence": 0.82
    },
    {
      "name": "雑費",
      "reason": "消耗品費で分類しづらい場合",
      "confidence": 0.15
    }
  ],
  "payment_method": null,
  "missing_fields": [],
  "overall_confidence": 0.82
}
```

### 13.3 Output（AIから）- 情報不足時

```json
{
  "success": true,
  "partial": true,
  "type": "expense",
  "date": null,
  "amount": 12000,
  "vendor": "Amazon",
  "description": "事務用品購入",
  "missing_fields": ["date"],
  "question": "いつの取引ですか？（例：昨日、1月24日）",
  "overall_confidence": 0.60
}
```

### 13.4 対話フロー例

```
User: 「Amazonで事務用品買った」

AI: {
  "missing_fields": ["date", "amount"],
  "question": "いつ、いくらの取引ですか？"
}

User: 「昨日、12000円」

AI: {
  "success": true,
  "type": "expense",
  "date": "2026-01-24",
  "amount": 12000,
  ...
}
```

---

## 14. 実装チケット分割例（GitHub Issues）

### Phase 1: 基盤構築
| チケット | 内容 | 優先度 |
|----------|------|--------|
| #1 | DBスプレッドシート初期化（全シート作成） | P0 |
| #2 | GAS プロジェクト基盤セットアップ | P0 |
| #3 | 共通ユーティリティ（UUID生成、日付処理） | P0 |
| #4 | Drive保存ユーティリティ | P0 |
| #5 | シート名/列名の定数定義 | P0 |

### Phase 2: 取引入力
| チケット | 内容 | 優先度 |
|----------|------|--------|
| #6 | Home画面 UI（HTML/CSS） | P0 |
| #7 | 手入力フォーム実装 | P0 |
| #8 | AI連携（OpenAI API呼び出し） | P0 |
| #9 | AI解析結果カード表示 | P0 |
| #10 | Confirm画面 UI | P0 |
| #11 | confirmTransaction API | P0 |
| #12 | 音声入力（Web Speech API） | P1 |
| #13 | 対話モード UI | P1 |

### Phase 3: 履歴
| チケット | 内容 | 優先度 |
|----------|------|--------|
| #14 | History画面 一覧UI | P0 |
| #15 | listTransactions API | P0 |
| #16 | フィルタ/検索機能 | P1 |
| #17 | 詳細Drawer/Modal | P0 |
| #18 | updateTransaction API（+ Audit Log） | P0 |
| #19 | 証憑アップロード UI | P1 |
| #20 | uploadReceipt API | P1 |

### Phase 4: 分析
| チケット | 内容 | 優先度 |
|----------|------|--------|
| #21 | Analytics画面 KPI表示 | P1 |
| #22 | getMonthlySummary API | P1 |
| #23 | 経費内訳円グラフ | P2 |
| #24 | 月次推移グラフ | P2 |
| #25 | 概算税額表示 | P2 |

### Phase 5: 会計士共有
| チケット | 内容 | 優先度 |
|----------|------|--------|
| #26 | syncAccountantExport API | P0 |
| #27 | resyncAccountantExport API | P1 |

---

## 15. 実装上の最重要原則

### データの扱い
- **スプレッドシート = Single Source of Truth**
- 確定前データは `status: draft` 扱い
- 確定後変更は **必ず audit log** に記録
- 物理削除は行わない（`status: void`）

### 会計士共有
- 会計士には **「必要最小限」** しか見せない
- 売上/利益/設定情報は共有しない
- 証憑リンクは設定で表示/非表示を切替可能

### 税額表示
- 税額は **必ず「概算」表記**
- 「最終計算は会計士/税理士判断に従う」を明記

### エラーハンドリング
- すべてのAPI呼び出しでエラーハンドリング
- ユーザーに分かりやすいエラーメッセージ
- 致命的エラーはログに記録

---

## 16. この設計のゴール

### ユーザー体験
- 個人事業主が **毎日音声で使える** シンプルさ
- 入力から確定まで **30秒以内**

### 会計士連携
- 会計士が **迷わず処理できる** 整形されたデータ
- freee準拠の勘定科目

### 拡張性
- 将来の freee連携 に対応可能
- 税制変更 に設定で対応可能
- OCR追加 に対応可能な構造

---

## 17. ファイル構成（推奨）

```
expense-app/
├── Code.gs              # GASエントリーポイント
├── Config.gs            # 定数/設定
├── Utils.gs             # ユーティリティ関数
├── TransactionService.gs   # 取引CRUD
├── ReceiptService.gs    # 証憑アップロード
├── AccountantService.gs # 会計士共有同期
├── AnalyticsService.gs  # 分析/集計
├── AIService.gs         # AI連携
├── index.html           # メインHTML
├── home.html            # Home画面
├── history.html         # History画面
├── analytics.html       # Analytics画面
├── styles.css           # 共通スタイル
└── app.js               # フロントエンドJS
```

---

## 18. 開発環境セットアップ

### 必要なもの
- Googleアカウント
- Google Apps Script プロジェクト
- OpenAI APIキー（AI機能用）

### 初期設定手順
1. Google Sheetsで空のスプレッドシートを作成
2. GASプロジェクトを作成し、スプレッドシートにバインド
3. `01_SETTINGS` シートに初期設定を記入
4. Webアプリとしてデプロイ

---

## 19. テスト観点

### 単体テスト
- 各GAS関数の入出力
- 日付計算ユーティリティ
- UUID生成

### 結合テスト
- 入力→確定→履歴表示の一連フロー
- 証憑アップロード→Drive保存→URL反映
- 確定→会計士シート同期

### UIテスト
- 各画面の表示確認
- フォームバリデーション
- エラー表示

---

## 20. 運用ガイドライン

### 日次
- 取引発生時に音声/手入力で登録
- 証憑があればその場でアップロード

### 月次
- 月末に履歴を確認
- 未分類/下書きがないか確認
- 会計士共有シートを確認

### 年次
- 年間サマリーを確認
- 会計士に共有シートのアクセス権を付与
- 必要に応じてCSVエクスポート
