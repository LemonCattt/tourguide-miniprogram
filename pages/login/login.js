const { api, saveToken } = require('../../utils/request');

Page({
  data: {
    isLoading: false,
    agreedPrivacy: false
  },

  onLoad() {
    const token = wx.getStorageSync('access_token');
    if (token && wx.getStorageSync('userInfo')) {
      this.goBack();
    }
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  onTogglePrivacy() {
    this.setData({ agreedPrivacy: !this.data.agreedPrivacy });
  },

  openServiceAgreement() {
    wx.navigateTo({
      url: '/pages/webview/webview?url=' + encodeURIComponent('https://moladog.top/agreement/service') + '&title=用户服务协议'
    });
  },

  openPrivacyPolicy() {
    wx.navigateTo({
      url: '/pages/webview/webview?url=' + encodeURIComponent('https://moladog.top/agreement/privacy') + '&title=隐私政策'
    });
  },

  async handleLogin() {
    if (this.data.isLoading) return;
    if (!this.data.agreedPrivacy) {
      wx.showModal({
        title: '温馨提示',
        content: '请先阅读并同意《用户服务协议》和《隐私政策》',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }
    this.setData({ isLoading: true });

    try {
      const { code } = await wx.login();
      const res = await api.auth.wechatLogin(code);

      if (res.accessToken) {
        saveToken(res.accessToken, res.refreshToken || null);
        if (res.user) {
          wx.setStorageSync('userInfo', res.user);
          getApp().globalData.userInfo = res.user;
          getApp().globalData.isLogin = true;
        }

        wx.showToast({ title: '登录成功', icon: 'success', duration: 1200 });
        setTimeout(() => {
          this.goBack();
        }, 1200);
      } else {
        throw new Error('登录响应异常');
      }
    } catch (err) {
      const msg = err.code === -1
        ? '网络异常，请检查连接后重试'
        : err.message || '登录失败，请重试';
      wx.showToast({ title: msg, icon: 'none', duration: 2500 });
    } finally {
      this.setData({ isLoading: false });
    }
  }
});
