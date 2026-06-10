const { api } = require('../../../utils/request');

/** 格式化金额 */
function formatAmount(amount) {
  return amount ? Number(amount).toFixed(2) : '0.00';
}

/** 分类映射 */
const CATEGORY_MAP = {
  transport: '交通',
  hotel: '住宿',
  food: '餐饮',
  office: '办公',
  other: '其他',
};

Page({
  data: {
    invoices: [],
    selectedIds: [],
    optimizeResult: null,
    loading: false,
    tourId: '',
    tours: [],
    tourPickerIndex: 0,
    totalAmount: '0.00',
    totalTax: '0.00',
  },

  onLoad(options) {
    if (options.tourId) {
      this.setData({ tourId: options.tourId });
    }
    this.loadTours();
    this.loadInvoices();
  },

  async loadTours() {
    try {
      const res = await api.tours.list({});
      const tours = res.items || res.data || res || [];
      this.setData({ tours });
    } catch (err) {
      wx.showToast({ title: '行程加载失败', icon: 'none' });
    }
  },

  async loadInvoices() {
    const params = {};
    if (this.data.tourId) params.tourId = this.data.tourId;
    try {
      const res = await api.invoices.list(params);
      // 后端返回格式: { items: [...], total: N } 或直接数组
      const invoices = (res.items || res.data || res || []).map((inv) => ({
        ...inv,
        amountText: formatAmount(inv.amount),
        categoryText: CATEGORY_MAP[inv.category] || inv.category || '-',
      }));
      this.setData({ invoices });
      this.recalcTotals();
    } catch (err) {
      wx.showToast({ title: '发票加载失败', icon: 'none' });
    }
  },

  /** 根据选中发票重新计算总金额和税额 */
  recalcTotals() {
    const { invoices, selectedIds } = this.data;
    const selected = invoices.filter((inv) => selectedIds.indexOf(inv.id) >= 0);
    const totalAmount = selected.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    // 默认税率6%，后端优化结果会给出精确值
    const totalTax = totalAmount * 0.06;
    this.setData({
      totalAmount: formatAmount(totalAmount),
      totalTax: formatAmount(totalTax),
    });
  },

  onTourChange(e) {
    const tourId = this.data.tours[e.detail.value]?.id || '';
    this.setData({ tourId, tourPickerIndex: Number(e.detail.value), optimizeResult: null }, () => this.loadInvoices());
  },

  toggleSelect(e) {
    const id = e.currentTarget.dataset.id;
    const selectedIds = this.data.selectedIds.slice();
    const idx = selectedIds.indexOf(id);
    if (idx >= 0) {
      selectedIds.splice(idx, 1);
    } else {
      selectedIds.push(id);
    }
    this.setData({ selectedIds, optimizeResult: null });
    this.recalcTotals();
  },

  selectAll() {
    const allIds = this.data.invoices.map((i) => i.id);
    this.setData({ selectedIds: allIds, optimizeResult: null });
    this.recalcTotals();
  },

  clearSelection() {
    this.setData({ selectedIds: [], optimizeResult: null, totalAmount: '0.00', totalTax: '0.00' });
  },

  async doOptimize() {
    const selected = this.data.selectedIds;
    if (selected.length === 0) {
      wx.showToast({ title: '请选择发票', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    wx.showLoading({ title: '优化中...' });

    try {
      // 并行请求优化，收集所有结果
      const results = await Promise.all(
        selected.map((id) => api.invoices.optimize({ id }))
      );

      wx.hideLoading();

      // 汇总优化结果
      let totalDeduction = 0;
      let totalOptAmount = 0;
      let totalOptTax = 0;
      const details = [];

      results.forEach((res, index) => {
        const deduction = Number(res.deduction || res.deductibleAmount || 0);
        const amount = Number(res.amount || 0);
        const tax = Number(res.tax || res.deductibleTax || 0);
        totalDeduction += deduction;
        totalOptAmount += amount;
        totalOptTax += tax;
        details.push({
          id: selected[index],
          deduction,
          amount,
          tax,
          suggestion: res.suggestion || res.reason || '',
        });
      });

      const optimizeResult = {
        deduction: formatAmount(totalDeduction),
        amount: formatAmount(totalOptAmount),
        tax: formatAmount(totalOptTax),
        details,
      };

      this.setData({
        optimizeResult,
        totalAmount: formatAmount(totalOptAmount),
        totalTax: formatAmount(totalOptTax),
        loading: false,
      });

      wx.showToast({ title: '优化完成', icon: 'success' });
    } catch (e) {
      wx.hideLoading();
      this.setData({ loading: false });
      wx.showToast({ title: '优化失败', icon: 'none' });
    }
  },
});
