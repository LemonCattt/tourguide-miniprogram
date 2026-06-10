const { api } = require('../../utils/request');

Page({
  data: {
    isLogin: false,
    userInfo: {},
    greeting: '',
    stats: { tours: 0, invoices: 0, amount: '0' },
    recentTours: []
  },

  onLoad() {
    this.checkLogin();
  },

  onShow() {
    const wasLogin = this.data.isLogin;
    this.checkLogin();
    // 刚登录成功则刷新数据
    if (!wasLogin && this.data.isLogin) {
      this.loadDashboard();
    }
  },

  checkLogin() {
    const token = wx.getStorageSync('access_token');
    const userInfo = wx.getStorageSync('userInfo') || {};
    const isLogin = !!(token && userInfo);
    const hour = new Date().getHours();
    const name = userInfo.nickname || '领队';
    const greeting = hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';

    this.setData({
      isLogin,
      userInfo,
      greeting: isLogin ? `${greeting}，${name}` : '欢迎使用领队助手'
    });

    if (isLogin) {
      this.loadDashboard();
    }
  },

  async loadDashboard() {
    if (!this.data.isLogin) return;

    try {
      const overview = await api.reports.overview();
      this.setData({
        'stats.tours': overview.tours?.active || 0,
        'stats.invoices': overview.invoices?.pending || 0,
        'stats.amount': this.formatAmount(overview.invoices?.pendingAmount || 0)
      });
    } catch (err) {
      // 非核心功能，静默失败
    }

    try {
      const toursData = await api.tours.list();
      this.setData({
        recentTours: (toursData.data || toursData || []).slice(0, 5)
      });
    } catch (err) {
      // 非核心功能，静默失败
    }
  },

  formatAmount(val) {
    if (val >= 10000) return (val / 10000).toFixed(1) + 'w';
    if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
    return String(val);
  },

  /** 统一鉴权守卫 */
  requireLogin() {
    if (!this.data.isLogin) {
      wx.navigateTo({ url: '/pages/login/login' });
      return false;
    }
    return true;
  },

  onTapLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onTapInvoiceUpload() {
    if (!this.requireLogin()) return;
    wx.navigateTo({ url: '/pages/invoice/upload/upload' });
  },

  onTapRoomImport() {
    if (!this.requireLogin()) return;
    wx.navigateTo({ url: '/pages/room/import/import' });
  },

  onTapExpense() {
    if (!this.requireLogin()) return;
    wx.navigateTo({ url: '/pages/expenses/form/form' });
  },

  onTapStat(e) {
    if (!this.requireLogin()) return;
    const { type } = e.currentTarget.dataset;
    if (type === 'tours') wx.switchTab({ url: '/pages/tours/list/list' });
    if (type === 'invoices') wx.switchTab({ url: '/pages/invoice/list/list' });
  },

  onTapTour(e) {
    if (!this.requireLogin()) return;
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/tours/detail/detail?id=${id}` });
  },

  onPullDownRefresh() {
    this.loadDashboard().finally(() => wx.stopPullDownRefresh());
  }
});
