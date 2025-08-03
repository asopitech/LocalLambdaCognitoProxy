import { CognitoAtEdge } from 'cognito-at-edge';

// cognito-at-edge インスタンスを作成
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

/**
 * Cognito 認証ミドルウェア
 * Express ミドルウェアとして使用可能な認証関数
 * 
 * @param {Object} req Express リクエストオブジェクト
 * @param {Object} res Express レスポンスオブジェクト
 * @param {Function} next 次のミドルウェアに進むためのコールバック
 */
export const authMiddleware = async (req, res, next) => {
  console.log(`[authMiddleware] 認証チェック: ${req.method} ${req.url}`);
  
  // CloudFront Event 形式に変換
  const cfEvent = createCloudFrontEvent(req);
  
  try {
    // cognito-at-edge で認証処理を実行
    const result = await cognitoAtEdge.handle(cfEvent);
    
    if (result.status) {
      // リダイレクトまたはエラーレスポンスが必要な場合
      console.log(`[authMiddleware] 認証処理結果: Status ${result.status}`);
      
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
      console.log('[authMiddleware] 認証成功、次の処理に進む');
      next();
    }
  } catch (error) {
    console.error('[authMiddleware] 認証エラー:', error);
    res.status(500).json({
      error: 'Authentication Error',
      message: '認証処理中にエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * 特定のパスを認証から除外するミドルウェアファクトリー
 * @param {string[]} excludePaths 認証を除外するパスの配列
 * @returns {Function} Express ミドルウェア関数
 */
export const createAuthMiddleware = (excludePaths = []) => {
  return (req, res, next) => {
    // 除外パスに一致する場合はスキップ
    if (excludePaths.some(path => req.path === path || req.path.startsWith(path))) {
      console.log(`[authMiddleware] パス除外: ${req.path}`);
      return next();
    }
    
    // 通常の認証処理を実行
    return authMiddleware(req, res, next);
  };
};

export default authMiddleware;