const { api } = require('../../../utils/request');
const { requireAuth } = require('../../../utils/auth');

Page({
  data: {
    schemes: [],
    loading: true
  },

  onShow() {
    if (!requireAuth()) return;
    this.loadSchemes();
  },

  async loadSchemes() {
    this.setData({ loading: true });
    try {
      const res = await api.rooms.schemes();
      this.setData({ schemes: res.data || res || [], loading: false });
    } catch (err) {
      this.setData({ loading: false });
    }
  },

  goDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: '/pages/room/detail/detail?id=' + id });
  },

  goImport() {
    wx.navigateTo({ url: '/pages/room/import/import' });
  },

  onPullDownRefresh() {
    this.loadSchemes().finally(() => wx.stopPullDownRefresh());
  }
});
