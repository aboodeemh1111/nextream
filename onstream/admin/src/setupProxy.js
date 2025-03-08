const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // API proxy
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8801',
      changeOrigin: true
    })
  );

  // Static files proxy
  app.use(
    '/static',
    createProxyMiddleware({
      target: 'http://localhost:8801',
      changeOrigin: true
    })
  );
}; 