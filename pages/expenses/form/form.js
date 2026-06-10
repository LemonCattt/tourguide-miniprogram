const { api } = require('../../../utils/request');

const CATEGORIES = [
  { value: 'food', label: '餐饮' },
  { value: 'transport', label: '交通' },
  { value: 'ticket', label: '门票' },
  { value: 'shopping', label: '购物' },
  { value: 'hotel', label: '住宿' },
  { value: 'other', label: '其他' },
];

const TYPES = [
  { value: 'team', label: '团队费用' },
  { value: 'personal', label: '个人费用' },
];

Page({
  data: {
    isEdit: false,
    id: '',
    tours: [],
    tourPickerIndex: 0,
    categories: CATEGORIES,
    categoryPickerIndex: 5,
    types: TYPES,
    typePickerIndex: 0,
    form: {
      tourId: '',
      category: 'other',
      type: 'team',
      amount: '',
      note: '',
      expenseDate: '',
    },
    submitting: false,
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ isEdit: true, id: options.id });
      this.loadExpense(options.id);
    }
    if (options.tourId) {
      this.setData({ 'form.tourId': options.tourId });
    }
    this.loadTours();
    if (!this.data.isEdit) {
      this.setData({ 'form.expenseDate': this.today() });
    }
  },

  today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  async loadTours() {
    try {
      const tours = await api.tours.list({});
      this.setData({ tours, tourPickerIndex: this._calcTourIndex(tours) });
    } catch (err) { /* silent */ }
  },

  async loadExpense(id) {
    try {
      const expense = await api.expenses.detail(id);
      this.setData({
        form: {
          tourId: expense.tripId || '',
          category: expense.category || 'other',
          type: expense.type || 'team',
          amount: String(expense.amount || ''),
          note: expense.note || '',
          expenseDate: (expense.expenseDate || '').slice(0, 10),
        },
        tourPickerIndex: this._calcTourIndex(this.data.tours, expense.tourId),
        categoryPickerIndex: CATEGORIES.findIndex(c => c.value === (expense.category || 'other')) || 5,
        typePickerIndex: TYPES.findIndex(t => t.value === (expense.type || 'team')) || 0,
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onTourChange(e) {
    const tour = this.data.tours[e.detail.value];
    this.setData({ 'form.tourId': tour?.id || '', tourPickerIndex: Number(e.detail.value) });
  },

  onCategoryChange(e) {
    this.setData({ 'form.category': CATEGORIES[e.detail.value].value, categoryPickerIndex: Number(e.detail.value) });
  },

  onTypeChange(e) {
    this.setData({ 'form.type': TYPES[e.detail.value].value, typePickerIndex: Number(e.detail.value) });
  },

  onInputAmount(e) {
    this.setData({ 'form.amount': e.detail.value });
  },

  onInputNote(e) {
    this.setData({ 'form.note': e.detail.value });
  },

  onDateChange(e) {
    this.setData({ 'form.expenseDate': e.detail.value });
  },

  async submit() {
    const { form, isEdit, id } = this.data;
    if (!form.amount || Number(form.amount) <= 0) {
      wx.showToast({ title: '请输入金额', icon: 'none' });
      return;
    }
    if (!form.note.trim()) {
      wx.showToast({ title: '请输入备注', icon: 'none' });
      return;
    }
    if (!form.expenseDate) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const payload = {
        tripId: form.tourId || null,
        category: form.category,
        amount: Number(form.amount),
        note: form.note.trim(),
        expenseDate: form.expenseDate,
      };

      if (isEdit) {
        await api.expenses.update(id, payload);
      } else {
        await api.expenses.create(payload);
      }
      wx.showToast({ title: isEdit ? '已更新' : '已记录', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1000);
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  _calcTourIndex(tours, tourId) {
    const tid = tourId || this.data.form.tourId;
    const idx = tours.findIndex(t => t.id === tid);
    return idx >= 0 ? idx : 0;
  },
});
