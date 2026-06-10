const { api } = require('../../../utils/request');

Page({
  data: {
    id: null,
    isEdit: false,
    name: '',
    code: '',
    destination: '',
    startDate: '',
    endDate: '',
    status: 'upcoming',
    saving: false
  },

  statusOptions: [
    { value: 'upcoming', label: '即将出发' },
    { value: 'ongoing', label: '进行中' },
    { value: 'ended', label: '已结束' }
  ],

  onLoad(options) {
    if (options.id) {
      this.setData({ id: options.id, isEdit: true });
      this.loadTour(options.id);
    }
  },

  async loadTour(id) {
    try {
      const tour = await api.tours.detail(id);
      this.setData({
        name: tour.title || '',
        code: tour.code || '',
        destination: tour.destination || '',
        startDate: tour.startDate || '',
        endDate: tour.endDate || '',
        status: tour.status || 'upcoming'
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [field]: e.detail.value });
  },

  onPickDate(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [field]: e.detail.value });
  },

  onPickStatus(e) {
    const idx = e.detail.value;
    this.setData({ status: this.data.statusOptions[idx].value });
  },

  async onSave() {
    const { name, code, destination, startDate, endDate, status, saving, isEdit, id } = this.data;
    if (saving) return;
    if (!name.trim()) {
      wx.showToast({ title: '请输入行程名称', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    const data = {
      title: name.trim(),
      code: code ? code.trim() : undefined,
      destination: destination.trim(),
      startDate,
      endDate,
      status
    };

    try {
      if (isEdit) {
        await api.tours.update(id, data);
      } else {
        await api.tours.create(data);
      }
      wx.showToast({ title: isEdit ? '已更新' : '已创建', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1000);
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  }
});
