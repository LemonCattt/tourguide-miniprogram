const { api } = require('../../../utils/request');

Page({
  data: {
    id: '',
    tour: null,
    items: [],
    itemsByDate: {},
    expenseReport: null,
    loading: true
  },

  typeIcons: {
    transport: '🚌',
    hotel: '🏨',
    scenic: '🎯',
    meal: '🍽',
    other: '📌'
  },

  typeText: {
    transport: '交通',
    hotel: '住宿',
    scenic: '景点',
    meal: '餐饮',
    other: '其他'
  },

  statusText: {
    upcoming: '即将出发',
    ongoing: '进行中',
    ended: '已结束'
  },

  statusClass: {
    upcoming: 'badge-blue',
    ongoing: 'badge-green',
    ended: 'badge-gray'
  },

  onLoad(options) {
    this.setData({ id: options.id });
  },

  onShow() {
    this.loadDetail();
    this.loadItems();
    this.loadExpenseSummary();
  },

  async loadDetail() {
    try {
      const tour = await api.tours.detail(this.data.id);
      this.setData({ tour, loading: false });
    } catch (err) {
      this.setData({ loading: false });
    }
  },

  async loadItems() {
    try {
      const items = await api.tours.items(this.data.id);
      const grouped = {};
      (items || []).forEach(item => {
        const d = item.date;
        if (!grouped[d]) grouped[d] = [];
        grouped[d].push(item);
      });
      this.setData({ items, itemsByDate: grouped });
    } catch (err) { wx.showToast({ title: '加载行程项目失败', icon: 'none' }); }
  },

  async loadExpenseSummary() {
    try {
      this.setData({ expenseReport: await api.reports.expenses(this.data.id) });
    } catch (err) { wx.showToast({ title: '加载费用汇总失败', icon: 'none' }); }
  },

  formatAmount(v) {
    if (v == null) return '0';
    return Number(v).toFixed(2);
  },

  goExpenses() {
    wx.navigateTo({ url: '/pages/expenses/list/list?tourId=' + this.data.id });
  },

  goRooms() {
    wx.switchTab({ url: '/pages/room/list/list' });
  },

  goInvoices() {
    wx.switchTab({ url: '/pages/invoice/list/list' });
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/tours/form/form?id=' + this.data.id });
  }
});
