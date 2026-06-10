const { api } = require('../../../utils/request');

/** 格式化时间 */
function timeFormat(t) {
  if (!t) return '';
  const d = new Date(t);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

Page({
  data: {
    ann: null,
    loading: true,
    // 预计算字段
    timeText: '',
  },

  onLoad(options) {
    if (options.id) {
      this.loadAnnouncement(options.id);
    }
  },

  async loadAnnouncement(id) {
    try {
      const ann = await api.announcements.detail(id);
      this.setData({
        ann,
        loading: false,
        timeText: timeFormat(ann.createdAt || ann.publishTime),
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },
});
