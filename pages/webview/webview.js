Page({
  data: {
    url: ''
  },

  onLoad(options) {
    const url = decodeURIComponent(options.url || '');
    const title = options.title || '';
    if (title) {
      wx.setNavigationBarTitle({ title });
    }
    this.setData({ url });
  },

  onMessage(e) {
    // 接收 webview postMessage
  }
});
