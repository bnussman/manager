'use strict';

const PORT = import.meta.env.PORT || 3000;
const HOST = import.meta.env.HOST || '0.0.0.0';

const protocol = import.meta.env.HTTPS === 'true' ? 'https' : 'http';
const apiProxyUrl = import.meta.env.REACT_APP_API_ROOT;

module.exports = {
  compress: true,
  https: protocol === 'https',
  host: HOST,
  port: PORT,
  historyApiFallback: {
    disableDotRule: true,
  },
  proxy: {
    '/api/v4': {
      changeOrigin: true,
      target: apiProxyUrl,
    },
  },
};
