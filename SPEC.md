# SkyBlueEarthJapan 経費管理アプリ 設計仕様書（SPEC）
Version: 0.1
Owner: Yuji Imaizumi
Project: SkyBlueEarthJapan（個人事業） 経費/売上 管理アプリ
DB: Google Spreadsheet（Excel原本をGoogle Sheets化して使用）
UI: GAS Web App（HTML/JS）
Backend: Google Apps Script（GAS）
Storage: Google Drive（証憑PDF/画像保存）

---

## 0. 目的 / ゴール
本アプリは、個人事業「スカイブルーアースジャパン」の取引（経費・売上）を
- **音声入力（対話形式）** または手入力で登録
- AIが **取引情報を構造化** し **勘定科目を推定**
- ユーザーが確認・修正して **確定**
- DBスプレッドシートに保存し **履歴** で閲覧・編集可能
- **分析** で月次の売上/経費/利益と、概算の所得税/住民税を表示
- 証憑（レシート/請求書）を **Driveに保存** し、リンク/IDをDBに記録
- 会計士共有用に **経費一覧だけ** を別スプレッドシートへ自動同期

を実現する。

---

## 1. スコープ
### 1.1 MVPに含める
- 取引登録：経費/売上、音声/手入力、AI推定、確認、確定
- 履歴一覧：検索/フィルタ、詳細表示、編集、証憑アップロード
- 分析：当月の売上/経費/利益、経費内訳（円グラフ）、概算税額
- Drive証憑保存：PDF/画像アップロード→指定フォルダに保存→リンク記録
- 会計士共有：確定した経費のみ、整形して共有用シートへ同期
- 監査ログ：確定後の編集は履歴（before/after）を保持

### 1.2 MVPに含めない（将来拡張）
- 証憑画像/PDFのOCRによる自動読取（当面やらない）
- 消費税の厳密な税区分/インボイス対応（列だけ保持し、入力必須にしない）
- 銀行/カード自動連携、レシート自動仕訳（後回し）

---

## 2. 画面仕様（3画面）
アプリの画面は **ホーム / 履歴 / 分析** の3ページ構成とする。

### 2.1 Home（入力）
**目的**：取引を登録し、AI推定結果を確認して確定する。

#### UIコンポーネント
- 入力モード切替：`音声入力` / `手入力`
- 音声入力（対話チャットUI）
  - 音声→文字起こし結果を表示
  - AIが不足項目を質問（例：日付、金額、種別など）
- 手入力フォーム
  - 取引種別（売上/経費）
  - 取引日
  - 金額
  - 取引先
  - 摘要（内容）
  - 勘定科目（候補プルダウン、検索可）
  - 支払方法（現金/口座/カード 等）
  - メモ（任意）

#### AI推定結果カード
- 推定フィールド：
  - type（expense/revenue）
  - date / amount / vendor / description
  - account_title（候補上位+理由）
  - payment_method（推定できる場合）
  - confidence
- ボタン：
  - `OK（この内容で次へ）`
  - `修正`
  - `破棄`

#### 確定前の最終確認（Confirm View）
- フォーム形式で全項目編集可能
- `確定` ボタンでDBへ書き込み
- 確定後：トースト表示「登録しました」＋履歴へ導線

---

### 2.2 History（履歴）
**目的**：確定した取引（経費/売上）を一覧表示し、編集や証憑紐付けを行う。

#### 一覧（Table）
- 列（表示の最低限）：
  - 日付 / 種別 / 金額 / 取引先 / 摘要 / 勘定科目 / 支払方法 / 証憑
- 機能：
  - フィルタ：月、種別、勘定科目、取引先、支払方法、金額帯
  - 検索：摘要/取引先の部分一致
  - ソート：日付、金額

#### 詳細（Drawer/Modal）
- 取引情報の全項目表示・編集
- `保存（更新）`：更新時は audit log に before/after を記録
- `削除（無効化）`：物理削除ではなく status を `void` にする

#### 証憑アップロード
- 各取引に `証憑アップロード` ボタン
- アップロード対象：PDF / 画像（jpg/png/webp）
- 動作：
  1) ファイル選択
  2) Drive指定フォルダへ保存
  3) fileId / URL を DB に記録
  4) 一覧上の `証憑を見る` が有効化（Driveリンクを開く）

---

### 2.3 Analytics（分析）
**目的**：当月の売上/経費/利益と、年換算の概算税額を可視化する。

#### KPI
- 当月売上合計
- 当月経費合計
- 当月利益（売上 - 経費）

#### チャート
- 当月経費内訳（勘定科目別円グラフ）
- 直近12か月推移（売上/経費/利益の折れ線 or 棒）

#### 概算税額（簡易）
- 年換算所得（例：当月利益×12 または 直近平均×12）
- 概算所得税 / 概算住民税
- 注意表示：「概算です。最終計算は会計士/税理士判断に従う」

---

## 3. データベース（Spreadsheet）仕様
DBはスプレッドシートで管理する。Excel原本をGoogle Sheetsに変換して使用する。

### 3.1 シート構成（Excelを正とする）
- 00_README
- 01_SETTINGS
- 02_MASTER_AccountTitles
- 03_MASTER_Vendors
- 10_TRANSACTIONS（主テーブル）
- 11_ATTACHMENTS（証憑）
- 12_AUDIT_LOG（変更履歴）
- 20_ACCOUNTANT_EXPORT（会計士共有用）
- 30_DASHBOARD（分析）

> 実装時は、各シート名を定数化すること。

### 3.2 主テーブル：10_TRANSACTIONS（概念スキーマ）
取引台帳。音声/手入力、売上/経費をすべて格納。

必須列（MVP）：
- id（UUID）
- type（expense/revenue）
- date（YYYY-MM-DD）
- amount（number）
- vendor（string）
- description（string）
- account_title（string）
- payment_method（enum）
- status（draft/confirmed/void）
- receipt_fileId（nullable）
- receipt_url（nullable）
- ai_raw（nullable）
- ai_confidence（nullable）
- created_at / updated_at

任意列（拡張）：
- tax_type（課税/非課税など）
- tags（string）

### 3.3 証憑：11_ATTACHMENTS
- attachment_id
- transaction_id（FK）
- fileId
- url
- filename
- mimeType
- created_at

### 3.4 変更履歴：12_AUDIT_LOG
- audit_id
- transaction_id
- action（create/update/void）
- before_json
- after_json
- editor（email）
- timestamp

### 3.5 会計士共有：20_ACCOUNTANT_EXPORT（経費のみ）
会計士に渡す最低限の一覧。**売上/利益/設定等は含めない。**

推奨列：
- 取引日
- 取引先
- 摘要（内容）
- 金額
- 勘定科目
- 支払方法
- 証憑リンク（見せる運用の場合のみ）
- メモ（任意）

---

## 4. Google Drive 証憑保存仕様
### 4.1 保存先
- 01_SETTINGS に `RECEIPT_FOLDER_ID` を設定
- 年/月フォルダを自動作成する：
  - `{root}/{YYYY}/{MM}/`

### 4.2 命名規則（推奨）
- `{date}_{amount}_{vendor}_{account_title}.{ext}`
- 例：`2026-01-24_12000_Amazon_消耗品費.pdf`

### 4.3 権限
- MVP：アプリ利用者本人のみ閲覧
- 会計士にリンクを共有する場合：
  - 会計士のGoogleアカウントに閲覧権限付与（フォルダ単位推奨）

---

## 5. AI 仕様
### 5.1 目的
- 音声文字起こしテキストから取引情報を構造化し、勘定科目を推定する
- 不足情報がある場合は対話で埋める

### 5.2 推定対象フィールド
- type（expense/revenue）
- date（推定できない場合は質問）
- amount（推定できない場合は質問）
- vendor（任意、質問可能）
- description（摘要）
- account_title（候補上位3）
- payment_method（推定できる場合）
- confidence（0〜1）
- reason（なぜその勘定科目か）

### 5.3 対話（チャット）ルール
- 欠落がある場合は、最小限の質問で埋める（1ターンで複数質問OK）
- 確定前に最終確認フォームを必ず表示

### 5.4 学習（軽量）
- 03_MASTER_Vendors に vendorごとのデフォルト科目を保存し、次回推定に反映
- ユーザー修正が多い組み合わせ（vendor×account_title）を優先度UP

---

## 6. GAS（バックエンド）設計
### 6.1 環境変数/設定（01_SETTINGS）
- APP_NAME（表示名）
- BUSINESS_NAME（屋号）
- DB_SHEET_ID（DBスプレッドシート）
- ACCOUNTANT_SHEET_ID（会計士共有用スプレッドシート）
- RECEIPT_FOLDER_ID（証憑保存フォルダ）
- PAYMENT_METHODS（選択肢）
- TIMEZONE（Asia/Tokyo）

### 6.2 想定関数一覧（例）
#### 取引
- `createDraftTransaction(payload)`
  - AI推定結果を一時保存（draft）する場合に使用（任意）
- `confirmTransaction(payload)`
  - confirmedで10_TRANSACTIONSに書き込み
  - 成功後に `syncAccountantExport(transactionId)` を呼ぶ
- `updateTransaction(transactionId, payload)`
  - 12_AUDIT_LOGにbefore/afterを保存
- `voidTransaction(transactionId)`
  - statusをvoidに更新、audit log記録

#### 履歴
- `listTransactions(filters)`
  - 10_TRANSACTIONSから条件抽出
- `getTransaction(transactionId)`

#### 証憑
- `uploadReceipt(transactionId, blob, filename, mimeType)`
  - Drive保存→11_ATTACHMENTS記録→10_TRANSACTIONSへURL/fileId反映
- `getReceiptLink(transactionId)`

#### 会計士共有
- `syncAccountantExport(transactionId)`
  - type=expense かつ status=confirmed のみ反映
  - 20_ACCOUNTANT_EXPORTの整形行を upsert
- `resyncAccountantExport(month?)`（保険）
  - 指定月/全期間を再生成

#### 分析
- `getMonthlySummary(year, month)`（売上/経費/利益）
- `getCategoryBreakdown(year, month)`（科目別）
- `estimateAnnualTax(summary, settings)`（概算）

---

## 7. 非機能要件
### 7.1 パフォーマンス
- 履歴一覧は月単位取得を基本とし、全件読みは避ける
- 証憑のDrive保存は非同期風にUIで進行表示

### 7.2 セキュリティ
- GAS Webアプリは本人のみアクセス可
- スプレッドシート/Driveは最小権限
- 監査ログで改ざん検知可能性を確保

### 7.3 可用性/バックアップ
- DBシートを定期コピー（手動でも可）
- resync関数で会計士共有シートを復旧可能にする

---

## 8. UIデザイン指針（スカイブルーアースジャパン）
- コンセプト：青空、深い青い地球、月、太陽
- ベース：白/薄い雲（背景）
- アクセント：深いスカイブルー（主要ボタン/強調）
- 分析：月（淡いグレー）、太陽（淡いゴールド）を控えめに使用
- 余白を多めに、カードUIで視認性重視

---

## 9. 受入条件（Doneの定義）
- 音声/手入力で取引登録→AI推定→確認→確定できる
- 確定した取引が履歴に表示され、編集でき、編集履歴が残る
- 証憑をアップロードするとDriveに保存され、リンクがDBに残る
- 確定した経費が会計士共有用シートに即同期される
- 分析で当月の売上/経費/利益と概算税額が見える

---

## 10. 今後の拡張候補
- 証憑OCRで金額/日付/取引先の自動入力
- freeeへの仕訳エクスポート（CSV）
- 決済/口座API連携
- タグ/プロジェクト別集計
