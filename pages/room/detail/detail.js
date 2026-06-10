const { api } = require('../../../utils/request');

Page({
  data: {
    id: '',
    scheme: null,
    rooms: [],
    loading: true
  },

  onLoad(options) {
    this.setData({ id: options.id });
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const scheme = await api.rooms.schemeDetail(this.data.id);
      const rooms = await api.rooms.getRooms(this.data.id);
      this.setData({ scheme, rooms, loading: false });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载分房详情失败', icon: 'none' });
    }
  },

  goImport() {
    wx.navigateTo({ url: '/pages/room/import/import?schemeId=' + this.data.id });
  }
});
