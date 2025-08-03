# LocalLambdaCognitoProxy

ローカル環境で AWS Lambda@Edge の Cognito 認証を再現し、リクエストを指定されたエンドポイント（例: `http://localhost:7860`）にプロキシするプロジェクト。Express サーバーが `cognito-at-edge` を使用し、`/cookies` エンドポイントで Cookie 情報を表示。

## 概要

このプロジェクトは、CloudFront + Lambda@Edge で実装される Cognito 認証機能をローカル環境で再現します。開発時にAWS環境を構築せずに認証フローをテストできます。

### 主な機能

- 🔐 AWS Cognito User Pool による認証
- 🔄 認証後の自動プロキシ転送
- 🍪 Cookie 情報の確認機能
- 🚀 Node.js 20.x LTS + ESM 対応
- ⚡ 開発時のホットリロード対応

## 前提条件

- **Node.js**: 20.x LTS 以上
- **プロキシ先**: デフォルトで `http://localhost:7860` が動作していること
- **AWS Cognito User Pool**: 設定済みの Cognito User Pool
- **インターネット接続**: Cognito 認証に必要

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env` ファイルに以下の設定を記述してください：

```env
# AWS Cognito 設定
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=your-client-id
COGNITO_DOMAIN=your-domain.auth.us-east-1.amazoncognito.com
COGNITO_REDIRECT_URI=http://localhost:3000/parseauth
COGNITO_REGION=us-east-1

# Cookie 設定
COOKIE_EXPIRATION_DAYS=365

# サーバー設定
PORT=3000

# プロキシ先設定
PROXY_TARGET=http://localhost:7860

# 開発環境設定
NODE_ENV=development
```

### 3. Cognito の設定

AWS Cognito User Pool のアプリクライアント設定で以下のコールバック URL を追加してください：

```
http://localhost:3000/parseauth
```

## 起動方法

### 1. プロキシ先を起動

まず、プロキシ先のアプリケーション（例: `http://localhost:7860`）を起動してください。

### 2. Express プロキシサーバーを起動

#### 開発モード（推奨）

```bash
npm run dev
```

#### 本番モード

```bash
npm start
```

### 3. ブラウザでアクセス

- **メインアクセス**: `http://localhost:3000`
  - 未認証の場合 → Cognito ログインページにリダイレクト
  - 認証済みの場合 → プロキシ先（`http://localhost:7860`）に転送

- **Cookie 確認**: `http://localhost:3000/cookies`
  - 現在のリクエストの Cookie 情報を JSON 形式で表示
  - 認証不要でアクセス可能

## エンドポイント

| エンドポイント | 説明 | 認証 |
|---------------|------|------|
| `/` | メインエントリーポイント、認証後プロキシ先に転送 | 必要 |
| `/parseauth` | Cognito からのリダイレクト処理 | 不要 |
| `/cookies` | Cookie 情報を JSON で表示 | 不要 |
| その他 | プロキシ先に転送 | 必要 |

## ディレクトリ構造

```
LocalLambdaCognitoProxy/
├── src/
│   ├── server.js              # Express プロキシサーバー
│   └── authMiddleware.js       # Cognito 認証ミドルウェア
├── .env                       # 環境変数設定
├── package.json              # プロジェクト設定
├── README.md                 # このファイル
├── .git/                     # Git リポジトリ
└── .jj/                      # Jujutsu リポジトリ
```

## 認証フロー

1. ユーザーが `http://localhost:3000` にアクセス
2. 認証状態をチェック
3. **未認証の場合**:
   - Cognito ホスト UI にリダイレクト
   - ユーザーがログイン
   - `/parseauth` にリダイレクト
   - メインページにリダイレクト
4. **認証済みの場合**:
   - プロキシ先（`PROXY_TARGET`）に転送

## 設定オプション

### 環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|-------------|
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID | 必須 |
| `COGNITO_CLIENT_ID` | Cognito アプリクライアント ID | 必須 |
| `COGNITO_DOMAIN` | Cognito ドメイン | 必須 |
| `COGNITO_REDIRECT_URI` | リダイレクト URI | `http://localhost:3000/parseauth` |
| `COGNITO_REGION` | AWS リージョン | 必須 |
| `COOKIE_EXPIRATION_DAYS` | Cookie 有効期限（日） | `365` |
| `PORT` | サーバーポート | `3000` |
| `PROXY_TARGET` | プロキシ先 URL | `http://localhost:7860` |
| `NODE_ENV` | 実行環境 | `development` |

## トラブルシューティング

### よくある問題

**1. 認証エラーが発生する**
- `.env` ファイルの Cognito 設定を確認
- Cognito User Pool のコールバック URL 設定を確認
- インターネット接続を確認

**2. プロキシ先に接続できない**
- `PROXY_TARGET` の URL を確認
- プロキシ先のサーバーが起動しているか確認
- ポート番号の競合を確認

**3. Cookie が保存されない**
- ブラウザの Cookie 設定を確認
- ローカル環境では `secure: false` が設定されています

### ログ確認

サーバーログで以下の情報を確認できます：

```bash
npm run dev
```

- 認証チェックの詳細
- プロキシリクエストの転送状況
- エラーの詳細情報

## 開発情報

### 技術スタック

- **Node.js**: 20.x LTS
- **Express**: 4.x
- **cognito-at-edge**: 1.2.0+
- **http-proxy-middleware**: 3.x
- **ESM**: ES Modules 使用

### バージョン管理

- **Git**: GitHub パブリッシュ用
- **Jujutsu (jj)**: ローカル開発用

## 注意事項

- 本番の Cognito User Pool に依存するため、インターネット接続が必要です
- ローカル環境では Cookie の `secure` フラグが無効化されています
- プロキシ先のアプリケーションが別途必要です
- 環境変数ファイル（`.env`）には機密情報が含まれるため、バージョン管理から除外してください

## ライセンス

MIT License

## サポート

問題や質問がある場合は、GitHub Issues をご利用ください。