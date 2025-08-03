import express from 'express';
import { CognitoAtEdge } from 'cognito-at-edge';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// 環境変数を読み込み
dotenv.config();

const app = express();

// Cookie パーサーを設定
app.use(cookieParser());

// cognito-at-edge の設定
const cognitoAtEdge = new CognitoAtEdge({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  userPoolAppId: process.env.COGNITO_CLIENT_ID,
  userPoolDomain: process.env.COGNITO_DOMAIN,
  cookieExpirationDays: parseInt(process.env.COOKIE_EXPIRATION_DAYS, 10) || 365,
  disableCookieDomain: true, // ローカル環境での動作のため無効化
  httpOnly: false,
});

/**
 * CloudFront のリクエスト形式を模倣するヘルパー関数
 * @param {Object} req Express リクエストオブジェクト
 * @returns {Object} CloudFront Event 形式のオブジェクト
 */
const createCloudFrontEvent = (req) => ({
  Records: [
    {
      cf: {
        request: {
          headers: Object.entries(req.headers).reduce((acc, [key, value]) => {
            acc[key.toLowerCase()] = [{ key, value: Array.isArray(value) ? value[0] : value }];
            return acc;
          }, {}),
          uri: req.url,
          querystring: req.query ? new URLSearchParams(req.query).toString() : '',
        },
      },
    },
  ],
});

// cognito-at-edge 認証ミドルウェア
app.use(async (req, res, next) => {
  // /cookies エンドポイントは認証をスキップ
  if (req.path === '/cookies') {
    return next();
  }

  console.log(`認証チェック開始: ${req.method} ${req.url}`);
  
  const cfEvent = createCloudFrontEvent(req);
  
  try {
    const result = await cognitoAtEdge.handle(cfEvent);
    
    if (result.status) {
      console.log(`認証処理結果: Status ${result.status}`);
      
      // ステータスコードを設定
      res.status(parseInt(result.status, 10));
      
      // ヘッダーを設定
      if (result.headers) {
        Object.entries(result.headers).forEach(([key, value]) => {
          if (Array.isArray(value) && value.length > 0) {
            res.setHeader(key, value[0].value);
          }
        });
      }
      
      // レスポンスボディがある場合は送信
      if (result.body) {
        res.send(result.body);
      } else {
        res.end();
      }
    } else {
      // 認証成功、次のミドルウェアに進む
      console.log('認証成功、プロキシ処理に進む');
      next();
    }
  } catch (error) {
    console.error('Cognito認証エラー:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '認証処理中にエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 認証後のリダイレクトエンドポイント
app.get('/parseauth', (req, res) => {
  console.log('認証リダイレクト処理: /parseauth');
  res.redirect('/');
});

// Cookie 情報を表示するエンドポイント
app.get('/cookies', (req, res) => {
  console.log('Cookie情報取得: /cookies');
  res.json({
    message: 'Cookie情報',
    cookies: req.cookies,
    headers: {
      cookie: req.headers.cookie || null,
      'user-agent': req.headers['user-agent'] || null,
    },
    timestamp: new Date().toISOString(),
  });
});

// プロキシ設定
const proxyTarget = process.env.PROXY_TARGET || 'http://localhost:7860';
console.log(`プロキシ先設定: ${proxyTarget}`);

app.use(
  '/',
  createProxyMiddleware({
    target: proxyTarget,
    changeOrigin: true,
    ws: true, // WebSocket サポート
    onError: (err, req, res) => {
      console.error('プロキシエラー:', err.message);
      res.status(502).json({
        error: 'Bad Gateway',
        message: 'プロキシ先サーバーに接続できません',
        target: proxyTarget,
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    },
    onProxyReq: (proxyReq, req, res) => {
      console.log(`プロキシリクエスト: ${req.method} ${req.url} -> ${proxyTarget}${req.url}`);
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`プロキシレスポンス: ${proxyRes.statusCode} ${req.url}`);
    }
  })
);

// エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
  console.error('サーバーエラー:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'サーバー内部エラーが発生しました',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 LocalLambdaCognitoProxy サーバー起動`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🎯 プロキシ先: ${proxyTarget}`);
  console.log(`🍪 Cookie確認: http://localhost:${PORT}/cookies`);
  console.log(`🔐 認証: AWS Cognito (${process.env.COGNITO_DOMAIN || '未設定'})`);
  console.log('='.repeat(50));
});