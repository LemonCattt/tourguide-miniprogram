const { api } = require('../../../utils/request');

/** 格式化时间（相对时间） */
function timeFormat(t) {
  if (!t) return '';
  const d = new Date(t);
  const now = new Date();
  const diff = now - d;
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 截断文本 */
function truncate(content, len) {
  return content && content.length > len ? content.slice(0, len) + '...' : (content || '');
}

Page({
  data: {
    announcements: [],
    grouped: [],
    loading: true,
    expanded: {},
  },

  onShow() {
    this.loadAnnouncements();
  },

  async loadAnnouncements() {
    try {
      const rawList = await api.announcements.list({});
      // 预计算timeText和previewText，WXML不支持调用Page方法
      const announcements = (rawList || []).map((a) => ({
        ...a,
        timeText: timeFormat(a.createdAt || a.publishTime),
        previewText: truncate(a.content, 80),
      }));
      const grouped = this.groupByDestination(announcements);
      const expanded = {};
      if (grouped.length > 0) expanded[grouped[0].destination] = true;
      this.setData({ announcements, grouped, expanded, loading: false });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  groupByDestination(list) {
    const map = {};
    list.forEach((a) => {
      const dest = a.destination || '通用公告';
      if (!map[dest]) map[dest] = [];
      map[dest].push(a);
    });
    return Object.entries(map).map(([destination, items]) => ({
      destination,
      count: items.length,
      items,
    }));
  },

  toggleGroup(e) {
    const dest = e.currentTarget.dataset.dest;
    const expanded = this.data.expanded;
    expanded[dest] = !expanded[dest];
    this.setData({ expanded });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/announcements/detail/detail?id=${id}` });
  },
});
