const { api } = require('../../../utils/request');

Page({
  data: {
    schemeId: '',
    guests: [],
    fileName: '',
    importing: false,
  },

  onLoad(options) {
    if (options.schemeId) {
      this.setData({ schemeId: options.schemeId });
    }
  },

  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx', 'xls', 'csv'],
      success: (res) => {
        const file = res.tempFiles[0];
        this.setData({ fileName: file.name });
        this.parseFile(file.path, file.name);
      },
    });
  },

  async parseFile(filePath, fileName) {
    this.setData({ importing: true });
    // Use wx.getFileSystemManager to read CSV; for XLSX, upload to server
    const ext = fileName.split('.').pop().toLowerCase();
    if (ext === 'csv') {
      const fs = wx.getFileSystemManager();
      fs.readFile({
        filePath,
        encoding: 'utf8',
        success: (res) => {
          const lines = res.data.trim().split('\n');
          const headers = lines[0].split(',').map(h => h.trim());
          const guests = lines.slice(1).map(line => {
            const vals = this._parseCsvLine(line);
            const guest = {};
            headers.forEach((h, i) => { guest[h] = vals[i] || ''; });
            return guest;
          }).filter(g => g.name || g['姓名']);
          this.setData({ guests, importing: false });
        },
        fail: () => {
          wx.showToast({ title: '读取失败', icon: 'none' });
          this.setData({ importing: false });
        },
      });
    } else {
      // XLSX: upload to server via request.js
      wx.showLoading({ title: '解析中...' });
      try {
        const data = await api.rooms.uploadExcel(this.data.schemeId, filePath);
        const guests = (data && data.guests) || (Array.isArray(data) ? data : []);
        this.setData({ guests, importing: false });
      } catch (e) {
        wx.showToast({ title: '解析失败', icon: 'none' });
      }
      wx.hideLoading();
    }
  },

  removeGuest(e) {
    const idx = e.currentTarget.dataset.index;
    const guests = this.data.guests;
    guests.splice(idx, 1);
    this.setData({ guests });
  },

  async confirmImport() {
    if (this.data.guests.length === 0) {
      wx.showToast({ title: '没有可导入的数据', icon: 'none' });
      return;
    }
    this.setData({ importing: true });
    try {
      // Map CSV-style fields to API fields
      const guests = this.data.guests.map(g => ({
        name: g.name || g['姓名'] || '',
        gender: g.gender || g['性别'] || (g.name?.endsWith('女士') ? 'female' : 'male'),
        age: g.age || g['年龄'] || null,
        phone: g.phone || g['电话'] || g['手机'] || '',
        idNumber: g.idNumber || g['身份证'] || g['证件号'] || '',
        roommate: g.roommate || g['室友'] || g['搭房'] || '',
      }));

      await api.rooms.addGuests(this.data.schemeId, guests);
      wx.showToast({ title: `已导入 ${guests.length} 人`, icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1000);
    } catch (err) {
      wx.showToast({ title: '导入失败', icon: 'none' });
    } finally {
      this.setData({ importing: false });
    }
  },

  previewGuest(e) {
    const guest = this.data.guests[e.currentTarget.dataset.index];
    const lines = Object.entries(guest)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`);
    wx.showModal({
      title: '成员信息',
      content: lines.join('\n'),
      showCancel: false,
    });
  },

  _parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  },
});
