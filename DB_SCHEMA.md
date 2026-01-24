# SkyBlue Earth Japan — 経費管理DB
## データベーススキーマ定義（スプレッドシート実装版）

> このドキュメントは実際のGoogle スプレッドシートの構造を正とする

---

## 0. 概要

### スプレッドシート名
**経費管理システム**

### 目的
音声/手入力 → AI解析 → 確認 → 確定 → 取引台帳へ記録。
証憑（PDF/画像）はGoogle Driveに保存し、リンクを台帳へ紐付けます。

### 会計士共有
確定した経費のみを『20_ACCOUNTANT_EXPORT』へ同期して渡します（売上・設定などは共有しない運用）。

### 色のルール
| 色 | 意味 |
|----|------|
| 青文字 | 入力（シナリオ/設定/手入力） |
| 黒文字 | 計算/式 |
| 橙背景 | 要確認（未確定など） |

### 使い方（Webアプリ連動想定）
1. ホーム画面で取引を入力
2. AIが日付/金額/取引先/内容/勘定科目を提案
3. OKで確定
4. 履歴で編集/証憑アップロード

### 重要
このExcelは"DBの初期設計"です。実際の同期・自動入力はGoogle Apps Scriptで行います。

---

## 1. シート一覧

| シート名 | 用途 |
|----------|------|
| 00_README | スプレッドシートの説明 |
| 01_SETTINGS | アプリ設定 |
| 02_MASTER_AccountTitles | 勘定科目マスタ（freee寄せ） |
| 03_MASTER_Vendors | 取引先マスタ（任意） |
| 10_TRANSACTIONS | 取引台帳（DB） |
| 11_ATTACHMENTS | 証憑（添付）一覧 |
| 12_AUDIT_LOG | 変更履歴（監査ログ） |
| 20_ACCOUNTANT_EXPORT | 会計士共有用（経費一覧） |
| 30_DASHBOARD | 分析ダッシュボード（概算） |

---

## 2. 00_README

### 内容
- タイトル: SkyBlue Earth Japan — 経費管理DB（ベースシート）
- 目的説明
- 色のルール
- 使い方（Webアプリ連動想定）
- 重要事項

---

## 3. 01_SETTINGS

### スキーマ

| 行 | 項目 | 値（入力） | メモ |
|----|------|-----------|------|
| 3 | 屋号 | スカイブルーアースジャパン | 表示名・ファイル命名に使用 |
| 4 | 事業者名（代表） | | 任意 |
| 5 | 会計年度開始月 | 1 | 1〜12（通常は1） |
| 6 | 通貨 | JPY | 固定 |
| 7 | 証憑保存フォルダID（Drive） | | GASで使用。フォルダIDを設定 |
| 8 | 証憑フォルダ構造 | YYYY/MM | 自動作成ルール（例：2026/01） |
| 9 | 会計士共有用スプレッドシートID | | 同期先（経費一覧のみ） |
| 10 | 会計士共有：証憑リンクを含める | YES | YES/NO |
| 11 | 入力：支払方法リスト | 現金,口座,カード,その他 | CSV形式 |
| 12 | 入力：取引ステータス | draft,confirmed,void | CSV形式 |
| 13 | 分析：住民税（所得割率） | 10.0% | 概算。地域差あり |
| 14 | 分析：住民税（均等割：円/年） | 5000 | 概算。地域差あり |
| 15 | 分析：所得税 概算を表示 | YES | MVPは概算のみ |

### 実装用定数

```javascript
const SETTINGS_KEYS = {
  BUSINESS_NAME: '屋号',
  OWNER_NAME: '事業者名（代表）',
  FISCAL_YEAR_START: '会計年度開始月',
  CURRENCY: '通貨',
  RECEIPT_FOLDER_ID: '証憑保存フォルダID（Drive）',
  RECEIPT_FOLDER_STRUCTURE: '証憑フォルダ構造',
  ACCOUNTANT_SHEET_ID: '会計士共有用スプレッドシートID',
  INCLUDE_RECEIPT_LINK: '会計士共有：証憑リンクを含める',
  PAYMENT_METHODS: '入力：支払方法リスト',
  TRANSACTION_STATUS: '入力：取引ステータス',
  RESIDENT_TAX_RATE: '分析：住民税（所得割率）',
  RESIDENT_TAX_FIXED: '分析：住民税（均等割：円/年）',
  SHOW_INCOME_TAX_ESTIMATE: '分析：所得税 概算を表示'
};
```

---

## 4. 02_MASTER_AccountTitles（勘定科目マスタ）

### スキーマ

| 列 | カラム名 | 型 | 必須 | 説明 |
|----|----------|-----|------|------|
| A | code | string | ○ | 科目コード（EXP001, REV001等） |
| B | name | string | ○ | 科目名（消耗品費、売上高等） |
| C | type | string | ○ | expense / revenue |
| D | display_group | string | ○ | 表示グループ（経費 / 売上） |
| E | example_keywords | string | ○ | AI推定用キーワード（カンマ区切り） |
| F | notes | string | - | 注意事項・補足 |
| G | active | boolean | ○ | TRUE / FALSE |
| H | created_at | date | ○ | 作成日 |
| I | updated_at | date | ○ | 更新日 |

### 初期データ

| code | name | type | display_group | example_keywords | notes |
|------|------|------|---------------|------------------|-------|
| EXP001 | 消耗品費 | expense | 経費 | 文房具,事務用品,備品(10万円未満) | 10万円以上は資産/減価償却 |
| EXP002 | 旅費交通費 | expense | 経費 | 電車,タクシー,出張,宿泊,ガソリン | 私用混在は按分 |
| EXP003 | 通信費 | expense | 経費 | 携帯,インターネット,切手,郵送 | 事業按分可 |
| EXP004 | 水道光熱費 | expense | 経費 | 電気,ガス,水道 | 事業按分可 |
| EXP005 | 地代家賃 | expense | 経費 | 家賃,レンタルオフィス,駐車場 | 事業按分可 |
| EXP006 | 広告宣伝費 | expense | 経費 | 広告,チラシ,SNS広告,LP制作 | ― |
| EXP007 | 接待交際費 | expense | 経費 | 会食,贈答品,手土産 | 相手先記録推奨 |
| EXP008 | 外注費 | expense | 経費 | 業務委託,制作依頼,デザイン,開発 | 源泉徴収の有無注意 |
| EXP009 | 支払手数料 | expense | 経費 | 振込手数料,決済手数料 | ― |
| EXP010 | 租税公課 | expense | 経費 | 印紙税,事業税,固定資産税 | 所得税/住民税は通常× |
| EXP011 | 雑費 | expense | 経費 | その他少額 | 乱用しない |
| REV001 | 売上高 | revenue | 売上 | 売上,請求,入金 | ― |

---

## 5. 03_MASTER_Vendors（取引先マスタ）

### スキーマ

| 列 | カラム名 | 型 | 必須 | 説明 |
|----|----------|-----|------|------|
| A | vendor_name | string | ○ | 取引先名 |
| B | default_account_title | string | - | デフォルト勘定科目 |
| C | default_payment_method | string | - | デフォルト支払方法 |
| D | notes | string | - | メモ |
| E | active | boolean | ○ | TRUE / FALSE |
| F | created_at | date | ○ | 作成日 |
| G | updated_at | date | ○ | 更新日 |

### 初期データ

| vendor_name | default_account_title | default_payment_method | notes |
|-------------|----------------------|------------------------|-------|
| Amazon | 消耗品費 | カード | ― |
| Google | 通信費 | カード | Workspace等 |
| JR | 旅費交通費 | カード | ― |

---

## 6. 10_TRANSACTIONS（取引台帳）

### スキーマ

| 列 | カラム名 | 型 | 必須 | 説明 |
|----|----------|-----|------|------|
| A | id | string | ○ | UUID |
| B | type | string | ○ | expense / revenue |
| C | date | date | ○ | 取引日（YYYY-MM-DD） |
| D | month | string | ○ | 月（YYYY-MM）※集計用 |
| E | vendor | string | - | 取引先 |
| F | description | string | ○ | 摘要（内容） |
| G | amount | number | ○ | 金額（税込） |
| H | account_title | string | ○ | 勘定科目 |
| I | payment_method | string | - | 支払方法（現金/口座/カード/その他） |
| J | status | string | ○ | draft / confirmed / void |
| K | receipt_fileId | string | - | Drive fileId |
| L | receipt_url | string | - | Drive URL |
| M | tags | string | - | タグ（カンマ区切り） |
| N | ai_confidence | number | - | AI信頼度（0〜1） |
| O | ai_raw | string | - | AI入力原文 |
| P | created_at | datetime | ○ | 作成日時 |
| Q | updated_at | datetime | ○ | 更新日時 |

---

## 7. 11_ATTACHMENTS（証憑一覧）

### スキーマ

| 列 | カラム名 | 型 | 必須 | 説明 |
|----|----------|-----|------|------|
| A | transaction_id | string | ○ | 取引ID（FK） |
| B | fileId | string | ○ | Drive fileId |
| C | url | string | ○ | Drive URL |
| D | filename | string | ○ | ファイル名 |
| E | mimeType | string | ○ | MIMEタイプ |
| F | uploaded_at | datetime | ○ | アップロード日時 |
| G | uploaded_by | string | - | アップロード者 |
| H | notes | string | - | メモ |

---

## 8. 12_AUDIT_LOG（変更履歴）

### スキーマ

| 列 | カラム名 | 型 | 必須 | 説明 |
|----|----------|-----|------|------|
| A | transaction_id | string | ○ | 取引ID（FK） |
| B | action | string | ○ | create / update / void |
| C | field | string | - | 変更フィールド名 |
| D | old_value | string | - | 変更前の値 |
| E | new_value | string | - | 変更後の値 |
| F | editor | string | ○ | 編集者 |
| G | reason | string | - | 変更理由 |
| H | timestamp | datetime | ○ | 変更日時 |
| I | source | string | - | 変更元（app / manual） |

---

## 9. 20_ACCOUNTANT_EXPORT（会計士共有用）

### スキーマ

| 列 | カラム名 | 型 | 必須 | 説明 |
|----|----------|-----|------|------|
| A | 取引日 | date | ○ | 取引日 |
| B | 取引先 | string | - | 取引先名 |
| C | 摘要 | string | ○ | 内容 |
| D | 金額 | number | ○ | 金額 |
| E | 勘定科目 | string | ○ | 勘定科目 |
| F | 支払方法 | string | - | 支払方法 |
| G | 証憑リンク | string | - | Drive URL（設定による） |
| H | メモ | string | - | 補足 |

### 注意事項
- **GASが自動書き込み**（手動編集しない）
- **経費（type=expense）のみ**同期
- **status=confirmed**のみ同期
- 売上・利益・設定情報は**含めない**
- 証憑リンクは01_SETTINGSの設定による

---

## 10. 30_DASHBOARD（分析ダッシュボード）

### 構成

#### 対象月設定（A3:C3）
| セル | 内容 |
|------|------|
| A3 | 対象月 |
| B3 | 2026-01（入力欄） |
| C3 | 例: 2026-01 |

#### KPI（A5:B8）
| 行 | 項目 | 値 |
|----|------|-----|
| 5 | KPI | ― |
| 6 | 売上（当月） | ¥0 |
| 7 | 経費（当月） | ¥0 |
| 8 | 利益（当月） | ¥0 |

#### 経費内訳（当月・勘定科目別）（D4:E11）
| 勘定科目 | 金額 |
|----------|------|
| 消耗品費 | ¥0 |
| 旅費交通費 | ¥0 |
| 通信費 | ¥0 |
| 水道光熱費 | ¥0 |
| 地代家賃 | ¥0 |
| 広告宣伝費 | ¥0 |
| 接待交際費 | ¥0 |

#### 月次推移（直近12か月）（A11:E24）
| 月 | 売上 | 経費 | 外注費 |
|----|------|------|--------|
| 2025-02 | ¥0 | ¥0 | ¥0 |
| ... | ... | ... | ... |
| 2026-01 | ¥0 | ¥0 | ¥0 |

#### グラフ
- **経費内訳（当月）**: 円グラフ
- **売上・経費・利益（直近12か月）**: 折れ線グラフ

---

## 11. 実装用定数定義

### シート名

```javascript
const SHEETS = {
  README: '00_README',
  SETTINGS: '01_SETTINGS',
  ACCOUNT_TITLES: '02_MASTER_AccountTitles',
  VENDORS: '03_MASTER_Vendors',
  TRANSACTIONS: '10_TRANSACTIONS',
  ATTACHMENTS: '11_ATTACHMENTS',
  AUDIT_LOG: '12_AUDIT_LOG',
  ACCOUNTANT_EXPORT: '20_ACCOUNTANT_EXPORT',
  DASHBOARD: '30_DASHBOARD'
};
```

### カラム位置（10_TRANSACTIONS）

```javascript
const COLS_TRANSACTIONS = {
  ID: 1,
  TYPE: 2,
  DATE: 3,
  MONTH: 4,
  VENDOR: 5,
  DESCRIPTION: 6,
  AMOUNT: 7,
  ACCOUNT_TITLE: 8,
  PAYMENT_METHOD: 9,
  STATUS: 10,
  RECEIPT_FILE_ID: 11,
  RECEIPT_URL: 12,
  TAGS: 13,
  AI_CONFIDENCE: 14,
  AI_RAW: 15,
  CREATED_AT: 16,
  UPDATED_AT: 17
};
```

---

## 12. データ整合性ルール

### 取引台帳
- `id`: UUID形式、重複不可
- `type`: "expense" または "revenue" のみ
- `date`: YYYY-MM-DD形式
- `month`: dateから自動生成（YYYY-MM）
- `amount`: 正の整数
- `status`: "draft" / "confirmed" / "void" のみ
- `account_title`: 勘定科目マスタに存在する値

### 証憑一覧
- `transaction_id`: 取引台帳に存在するid

### 変更履歴
- `transaction_id`: 取引台帳に存在するid
- `action`: "create" / "update" / "void" のみ

### 会計士共有用
- 取引台帳から `type=expense` かつ `status=confirmed` のみ同期
- GASによる自動書き込みのみ（手動編集禁止）

---

## 13. 備考

- このスキーマはGoogle スプレッドシートの実際の構造に基づいています
- 実装時はこのドキュメントを正として参照してください
- 会計士共有用スプレッドシートは別途作成が必要です
