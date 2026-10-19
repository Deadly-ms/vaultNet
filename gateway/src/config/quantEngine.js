function getQuantEngineUrl() {
  let rawUrl = (process.env.QUANT_ENGINE_URL || 'http://quant-engine:8000').trim();
  
  if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
    // If it looks like a local container/host without domain dots, use http, otherwise https
    if (rawUrl.startsWith('localhost') || rawUrl.startsWith('127.0.0.1') || !rawUrl.includes('.')) {
      rawUrl = `http://${rawUrl}`;
    } else {
      rawUrl = `https://${rawUrl}`;
    }
  }
  
  return rawUrl.replace(/\/+$/, '');
}

module.exports = { getQuantEngineUrl };
