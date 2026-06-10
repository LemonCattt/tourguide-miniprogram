const { getToken } = require('./utils/request');

App({
  onLaunch() {
    const token = getToken();
    const userInfo = wx.getStorageSync('userInfo');

    if (token && userInfo) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
      this.globalData.isLogin = true;
    }
  },

  globalData: {
    token: null,
    userInfo: null,
    isLogin: false,
  }
});
