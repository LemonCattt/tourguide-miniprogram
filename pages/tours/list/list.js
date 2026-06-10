const { api } = require('../../../utils/request');
const { requireAuth } = require('../../../utils/auth');

/** 状态映射 */
const STATUS_MAP = {
  upcoming: '即将出发',
  ongoing: '进行中',
  ended: '已结束',
};

Page({
  data: {
    tours: [],
    loading: true,
  },

  onShow() {
    if (!requireAuth()) return;
    this.loadTours();
  },

  async loadTours() {
    this.setData({ loading: true });
    try {
      const res = await api.tours.list();
      const rawTours = res.data || res || [];
      // 预计算statusText，WXML不支持调用Page方法
      const tours = rawTours.map((t) => ({
        ...t,
        statusText: STATUS_MAP[t.status] || t.status || '',
      }));
      this.setData({ tours, loading: false });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    }
  },

  goDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/tours/detail/detail?id=${id}` });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/tours/form/form' });
  },

  onPullDownRefresh() {
    this.loadTours().finally(() => wx.stopPullDownRefresh());
  },
});
