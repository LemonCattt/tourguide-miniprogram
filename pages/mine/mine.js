const { api, clearToken } = require('../../utils/request');
const { requireAuth } = require('../../utils/auth');

Page({
  data: {
    userInfo: {},
    stats: { invoiceCount: 0, roomTaskCount: 0 },
    cacheSize: '0 KB'
  },

  onShow() {
    if (!requireAuth()) return;
    this.loadUserInfo();
    this.loadStats();
    this.loadCacheSize();
  },

  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({ userInfo });
  },

  async loadStats() {
    try {
      const overview = await api.reports.overview();
      this.setData({
        'stats.invoiceCount': overview.invoices?.pending || 0,
        'stats.roomTaskCount': overview.tours?.active || 0
      });
    } catch (err) {
      // 静默失败，统计非核心功能
    }
  },

  loadCacheSize() {
    try {
      const res = wx.getStorageInfoSync();
      const size = res.currentSize > 1024
        ? (res.currentSize / 1024).toFixed(1) + ' MB'
        : res.currentSize + ' KB';
      this.setData({ cacheSize: size });
    } catch (e) { /* ignore */ }
  },

  onTapAbout() {
    wx.showModal({
      title: '领队助手',
      content: '专业领队管理工具\n\n功能：行程管理 · 发票识别 · 智能分房\n版本：v2.0.0',
      showCancel: false
    });
  },

  onClearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除缓存吗？',
      success: (res) => {
        if (res.confirm) {
          const token = wx.getStorageSync('access_token');
          const userInfo = wx.getStorageSync('userInfo');
          wx.clearStorageSync();
          if (token) wx.setStorageSync('access_token', token);
          if (userInfo) wx.setStorageSync('userInfo', userInfo);
          this.loadCacheSize();
          wx.showToast({ title: '已清除', icon: 'success' });
        }
      }
    });
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          clearToken();
          wx.reLaunch({ url: '/pages/login/login' });
        }
      }
    });
  }
});
