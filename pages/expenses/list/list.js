const { api } = require('../../../utils/request');

/** 分类映射 */
const CATEGORY_MAP = {
  food: '餐饮',
  transport: '交通',
  ticket: '门票',
  shopping: '购物',
  hotel: '住宿',
  other: '其他',
};

Page({
  data: {
    tourId: '',
    list: [],
    summary: null,
    loading: true,
  },

  onLoad(options) {
    this.setData({ tourId: options.tourId || '' });
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const params = this.data.tourId ? { tourId: this.data.tourId } : {};
      const [listRes, summaryRes] = await Promise.all([
        api.expenses.list(params),
        this.data.tourId ? api.expenses.summary(params) : null,
      ]);
      // 预计算categoryText，WXML不支持调用Page方法
      const rawList = listRes || [];
      const list = rawList.map((item) => ({
        ...item,
        categoryText: CATEGORY_MAP[item.category] || item.category || '其他',
      }));
      this.setData({
        list,
        summary: summaryRes,
        loading: false,
      });
    } catch (err) {
      this.setData({ loading: false });
    }
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/expenses/form/form?tourId=' + this.data.tourId });
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },
});
