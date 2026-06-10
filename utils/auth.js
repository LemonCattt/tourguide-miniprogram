/**
 * 鉴权守卫 — 未登录弹窗引导，不强制跳转
 * @returns {boolean} 是否已登录
 */
function requireAuth() {
  const token = wx.getStorageSync('access_token');
  if (token) return true;

  wx.showModal({
    title: '需要登录',
    content: '该功能需要登录后才能使用',
    confirmText: '去登录',
    cancelText: '返回首页',
    success: (res) => {
      if (res.confirm) {
        wx.navigateTo({ url: '/pages/login/login' });
      } else {
        wx.switchTab({ url: '/pages/index/index' });
      }
    }
  });
  return false;
}

module.exports = { requireAuth };
