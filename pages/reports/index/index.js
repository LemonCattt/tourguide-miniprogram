const { api } = require('../../../utils/request');

/** 分类映射 */
const CATEGORY_LABELS = {
  food: '餐饮',
  transport: '交通',
  ticket: '门票',
  shopping: '购物',
  hotel: '住宿',
  other: '其他',
};

/** 格式化金额 */
function formatAmount(a) {
  return a != null ? Number(a).toFixed(2) : '0.00';
}

/** 将 byCategory 对象转换为带预计算字段的数组 */
function preprocessByCategory(byCategory) {
  if (!byCategory) return [];
  const entries = Object.entries(byCategory);
  const maxVal = Math.max(...entries.map(([, v]) => Number(v) || 0), 0);
  return entries.map(([key, val]) => ({
    key,
    value: val,
    categoryLabel: CATEGORY_LABELS[key] || key,
    amountText: formatAmount(val),
    barWidth: maxVal > 0 ? Math.max(2, (Number(val) / maxVal) * 100) : 0,
  }));
}

Page({
  data: {
    overview: null,
    expenseReport: null,
    invoiceReport: null,
    loading: true,
    // 预计算字段（WXML不支持调用Page方法）
    expensesTotalText: '0.00',
    pendingAmountText: '0.00',
    categoryBars: [],
    invoiceTotalText: '0.00',
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const [overview, expenses, invoices] = await Promise.all([
        api.reports.overview().catch(() => null),
        api.reports.expenses().catch(() => null),
        api.reports.invoices().catch(() => null),
      ]);

      // 预计算所有WXML模板需要的值
      const expensesTotalText = formatAmount(overview?.expenses?.totalAmount);
      const pendingAmountText = formatAmount(overview?.invoices?.pendingAmount);
      const categoryBars = preprocessByCategory(expenses?.byCategory);
      const invoiceTotalText = formatAmount(invoices?.totalAmount);

      this.setData({
        overview,
        expenseReport: expenses,
        invoiceReport: invoices,
        expensesTotalText,
        pendingAmountText,
        categoryBars,
        invoiceTotalText,
        loading: false,
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },
});
