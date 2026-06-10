const { api } = require('../../../utils/request');
const { requireAuth } = require('../../../utils/auth');

const PAGE_SIZE = 20;

/** 状态映射 */
const STATUS_MAP = {
  all: '全部',
  approved: '已审核',
};

/** 状态选项列表（用于picker） */
const STATUS_OPTIONS = ['all', 'approved'];

/** 发票类型映射 */
const TYPE_MAP = {
  vat_special: '专票',
  vat_normal: '普票',
  vat_electronic: '电子票',
  train_ticket: '火车票',
  taxi_receipt: '出租票',
  flight_itinerary: '机票',
  other: '其他',
};

/**
 * 根据查验结果映射核销状态标签
 * 返回 { label, className }，无查验结果时返回 null
 */
function verifyStatusLabel(verifyResult) {
  if (!verifyResult) return null;

  // 尝试从 Data 中提取状态信息
  var data = verifyResult.Data || verifyResult.data || verifyResult;

  // 常见字段：VerifyStatus (string), IsValid (bool), Status (string)
  var status = data.VerifyStatus || data.verifyStatus || data.Status || data.status;
  var isValid = data.IsValid !== undefined ? data.IsValid : (data.isValid !== undefined ? data.isValid : undefined);

  // 如果返回明确的有效/无效标识
  if (isValid === true) {
    return { label: '核销正常', className: 'verify-ok' };
  }
  if (isValid === false) {
    return { label: '已被核销', className: 'verify-invalid' };
  }

  // 根据状态码判断（常见编码：00/01=正常，其他=异常）
  if (status !== undefined && status !== null) {
    var s = String(status).toLowerCase();
    if (s === '00' || s === '01' || s === 'ok' || s === 'success' || s === 'valid') {
      return { label: '核销正常', className: 'verify-ok' };
    }
    return { label: '已被核销', className: 'verify-invalid' };
  }

  // 有查验记录但无明确状态 → 标记为"已查验"
  return { label: '已查验', className: 'verify-checked' };
}

Page({
  data: {
    list: [],
    loading: true,
    // 搜索相关
    keyword: '',
    filteredList: [],
    // 分页相关
    page: 1,
    hasMore: true,
    isLoadingMore: false,
    // 筛选相关
    statusFilter: 'all',
    statusOptions: STATUS_OPTIONS,
    statusLabels: STATUS_OPTIONS.map(function(s) { return STATUS_MAP[s]; }),
    statusPickerIndex: 0,
    tours: [],
    tourPickerIndex: 0,
    tourFilter: '',
    // 批量操作相关
    batchMode: false,
    selectedIds: [],
  },

  onShow() {
    if (!requireAuth()) return;
    this.loadTours();
    this.resetAndLoad();
  },

  /** 加载行程列表（用于筛选） */
  async loadTours() {
    try {
      var res = await api.tours.list({});
      var tours = res.items || res.data || res || [];
      this.setData({ tours: tours });
    } catch (err) {
      // 行程列表加载失败不影响发票列表
    }
  },

  /** 重置分页并重新加载 */
  resetAndLoad() {
    this.setData({ page: 1, hasMore: true, list: [], keyword: '' });
    this.loadList();
  },

  /** 构建查询参数 */
  buildParams() {
    var page = this.data.page;
    var statusFilter = this.data.statusFilter;
    var tourFilter = this.data.tourFilter;
    var params = { page: page, limit: PAGE_SIZE };
    if (statusFilter && statusFilter !== 'all') {
      params.status = statusFilter;
    }
    if (tourFilter) {
      params.tourId = tourFilter;
    }
    return params;
  },

  /** 预计算单个item的展示字段 */
  computeItemFields(item) {
    // 统一 ID 为字符串，避免 dataset（WXML 始终为 string）与 API 返回 number 的 indexOf 匹配失败
    item.id = String(item.id);

    // 卖方名称
    item.sellerNameText = item.sellerName || '--';

    // 发票类型标签
    item.typeTagText = TYPE_MAP[item.type] || '其他';

    // OCR失败标签
    item.ocrFailed = item.ocrFailed === true;

    // 税额
    item.taxText = item.tax ? '¥' + Number(item.tax).toFixed(2) : '--';

    // 创建时间
    item.createTimeText = item.createdAt ? String(item.createdAt).slice(0, 10) : '--';

    // 核销查验状态
    var verifyInfo = verifyStatusLabel(item.verifyResult);
    if (verifyInfo) {
      item.verifyLabel = verifyInfo.label;
      item.verifyClassName = verifyInfo.className;
    } else {
      item.verifyLabel = '';
      item.verifyClassName = '';
    }

    return item;
  },

  /** 加载发票列表（支持分页和筛选） */
  async loadList() {
    if (this.data.isLoadingMore) return;
    this.setData({ isLoadingMore: true, loading: this.data.page === 1 });

    try {
      var page = this.data.page;
      var list = this.data.list;
      var params = this.buildParams();
      var res = await api.invoices.list(params);
      var items = res.items || res.data || [];
      var total = res.total || 0;

      // 预计算每个item的展示字段
      for (var i = 0; i < items.length; i++) {
        items[i] = this.computeItemFields(items[i]);
      }

      var newList = page === 1 ? items : list.concat(items);
      var hasMore = newList.length < total;

      this.setData({
        list: newList,
        filteredList: this.filterByKeyword(newList, this.data.keyword),
        loading: false,
        isLoadingMore: false,
        hasMore: hasMore,
      });
      this._syncCheckedState();
    } catch (err) {
      this.setData({ loading: false, isLoadingMore: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /** 上拉加载更多 */
  onReachBottom() {
    if (!this.data.hasMore || this.data.isLoadingMore) return;
    this.setData({ page: this.data.page + 1 });
    this.loadList();
  },

  /** 状态筛选变更 */
  onStatusFilterChange(e) {
    var index = Number(e.detail.value);
    var statusFilter = STATUS_OPTIONS[index];
    this.setData({
      statusPickerIndex: index,
      statusFilter: statusFilter,
      page: 1,
      hasMore: true,
      list: [],
      selectedIds: [],
    });
    this.loadList();
  },

  /** 行程筛选变更 */
  onTourFilterChange(e) {
    var index = Number(e.detail.value);
    var tours = this.data.tours;
    var tourFilter = index === 0 ? '' : (tours[index - 1] && tours[index - 1].id || '');
    this.setData({
      tourPickerIndex: index,
      tourFilter: tourFilter,
      page: 1,
      hasMore: true,
      list: [],
      selectedIds: [],
    });
    this.loadList();
  },

  /** 重置筛选 */
  onResetFilters() {
    this.setData({
      statusFilter: 'all',
      statusPickerIndex: 0,
      tourFilter: '',
      tourPickerIndex: 0,
      keyword: '',
      selectedIds: [],
    });
    this.resetAndLoad();
  },

  /** 点击发票卡片 → 跳转详情 */
  onTapDetail(e) {
    if (this.data.batchMode) {
      this.toggleSelect(e);
      return;
    }
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/invoice/detail/detail?id=' + id });
  },

  /** 点击上传按钮 */
  onGoUpload() {
    wx.navigateTo({ url: '/pages/invoice/upload/upload' });
  },

  /** 预览发票文件（PDF等，使用 wx.openDocument） */
  onPreview(e) {
    var id = e.currentTarget.dataset.id;
    var list = this.data.list;
    var item = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { item = list[i]; break; }
    }
    if (!item) return;

    var images = item.images || item.imageUrls || [];
    if (images.length === 0) {
      wx.showToast({ title: '暂无文件可预览', icon: 'none' });
      return;
    }

    var fileUrl = images[0];
    var request = require('../../../utils/request');
    var fullUrl = fileUrl.indexOf('http') === 0 ? fileUrl : request.BASE_URL.replace('/api/v1', '') + fileUrl;

    wx.showLoading({ title: '加载中...' });
    wx.downloadFile({
      url: fullUrl,
      success: function(res) {
        wx.hideLoading();
        if (res.statusCode === 200) {
          wx.openDocument({ filePath: res.tempFilePath, showMenu: true });
        } else {
          wx.showToast({ title: '文件加载失败', icon: 'none' });
        }
      },
      fail: function() {
        wx.hideLoading();
        wx.showToast({ title: '文件加载失败', icon: 'none' });
      },
    });
  },

  /** 删除发票 */
  onDelete(e) {
    var id = e.currentTarget.dataset.id;
    var that = this;
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确认删除该发票？',
      confirmColor: '#FF3B30',
      success: async function(res) {
        if (!res.confirm) return;
        try {
          await api.invoices.remove(id);
          wx.showToast({ title: '删除成功', icon: 'success' });
          var list = that.data.list.filter(function(inv) { return inv.id !== id; });
          that.setData({
            list: list,
            filteredList: that.filterByKeyword(list, that.data.keyword),
          });
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      },
    });
  },

  // ========== 批量操作 ==========

  /** 进入/退出批量模式 */
  toggleBatchMode() {
    var batchMode = !this.data.batchMode;
    this.setData({ batchMode: batchMode, selectedIds: [] });
    this._syncCheckedState();
  },

  /** 切换选中（原生checkbox） */
  onCheckChange(e) {
    var id = String(e.currentTarget.dataset.id);
    var selectedIds = this.data.selectedIds.slice();
    var idx = selectedIds.indexOf(id);
    if (idx >= 0) {
      selectedIds.splice(idx, 1);
    } else {
      selectedIds.push(id);
    }
    this.setData({ selectedIds: selectedIds });
    this._syncCheckedState();
  },

  /** 切换选中（手动调用） */
  toggleSelect(e) {
    var id = String(e.currentTarget.dataset.id);
    var selectedIds = this.data.selectedIds.slice();
    var idx = selectedIds.indexOf(id);
    if (idx >= 0) {
      selectedIds.splice(idx, 1);
    } else {
      selectedIds.push(id);
    }
    console.log('[select] id=' + id + ' count=' + selectedIds.length);
    this.setData({ selectedIds: selectedIds });
    this._syncCheckedState();
  },

  /** 全选当前列表 */
  batchSelectAll() {
    var allIds = this.data.filteredList.map(function(inv) { return String(inv.id); });
    this.setData({ selectedIds: allIds });
    this._syncCheckedState();
  },

  /**
   * 将 selectedIds 同步到 filteredList 每一项的 _checked 字段。
   * WXML 中 checkbox 的 checked 绑定 {{item._checked}} 避免 indexOf 在模板表达式中不可用。
   */
  _syncCheckedState() {
    var selectedIds = this.data.selectedIds;
    var filteredList = this.data.filteredList;
    for (var i = 0; i < filteredList.length; i++) {
      filteredList[i]._checked = selectedIds.indexOf(filteredList[i].id) >= 0;
    }
    this.setData({ filteredList: filteredList });
  },

  /** 导出选中的发票到聊天 */
  onExportToChat: async function () {
    var selectedIds = this.data.selectedIds;
    if (selectedIds.length === 0) {
      wx.showToast({ title: '请选择发票', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '准备导出...' });

    try {
      var res = await api.invoices.exportData(selectedIds);
      // 调试日志：方便排查后端返回数据
      console.log('[export] res:', JSON.stringify(res));

      var summary = res.summary || {};
      var items = res.items || [];

      // 如果 items 为空，给友好提示
      if (items.length === 0) {
        wx.hideLoading();
        wx.showToast({ title: '未找到发票数据', icon: 'none', duration: 2500 });
        return;
      }

      // Robust count/totalAmount: prefer summary, fallback to items array
      var count = summary.count;
      var totalAmount = summary.totalAmount;
      if (count === undefined || count === null) {
        count = items.length;
      }
      if (totalAmount === undefined || totalAmount === null) {
        totalAmount = 0;
        for (var i = 0; i < items.length; i++) {
          totalAmount += Number(items[i].amount || 0);
        }
      }
      // Ensure numeric
      count = Number(count) || 0;
      totalAmount = Number(totalAmount) || 0;

      // Build chat message text
      var lines = [];
      lines.push('📋 发票报销汇总');
      lines.push('共 ' + count + ' 张发票，合计 ¥' + totalAmount.toFixed(2));
      lines.push('');

      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var typeLabel = TYPE_MAP[item.type] || '其他';
        var dateStr = item.invoiceDate || '--';
        var amountStr = item.amount ? '¥' + Number(item.amount).toFixed(2) : '--';
        var sellerStr = item.sellerName || '--';
        lines.push((i + 1) + '. [' + typeLabel + '] ' + dateStr + ' ' + amountStr + ' — ' + sellerStr);
      }

      var summaryText = lines.join('\n');

      // 构建发票清单（用于 ActionSheet 展示）
      var itemNames = items.map(function (item, i) {
        var name = item.invoiceNumber || ('发票' + (i + 1));
        var amount = item.amount ? ' ¥' + Number(item.amount).toFixed(2) : '';
        return name + amount;
      });

      // 微信 showActionSheet itemList 上限 6 项，超出时截断
      var displayedCount = items.length;
      if (itemNames.length > 6) {
        itemNames = itemNames.slice(0, 5);
        itemNames.push('共 ' + count + ' 张，已复制到剪贴板');
        displayedCount = 5;
      }

      wx.hideLoading();

      // 先弹 ActionSheet 让用户选发票下载/打开
      // 再在 complete 回调中执行剪贴板复制，避免 showModal 遮盖 ActionSheet
      wx.showActionSheet({
        itemList: itemNames,
        success: function (actionRes) {
          var idx = actionRes.tapIndex;
          // 如果点击的是最后一项提示文字，不做任何操作
          if (idx >= displayedCount) return;
          var item = items[idx];
          if (!item || !item.fileUrl) {
            wx.showToast({ title: '无文件可打开', icon: 'none' });
            return;
          }
          wx.showLoading({ title: '加载中...' });
          wx.downloadFile({
            url: item.fileUrl,
            success: function (downloadRes) {
              wx.hideLoading();
              if (downloadRes.statusCode === 200) {
                wx.openDocument({
                  filePath: downloadRes.tempFilePath,
                  fileType: 'pdf',
                  showMenu: true,
                  success: function () {
                    wx.showToast({ title: '点击右上角···发送', icon: 'none', duration: 2500 });
                  },
                  fail: function () {
                    wx.showToast({ title: '打开失败', icon: 'none' });
                  },
                });
              } else {
                wx.showToast({ title: '文件加载失败', icon: 'none' });
              }
            },
            fail: function () {
              wx.hideLoading();
              wx.showToast({ title: '下载失败', icon: 'none' });
            },
          });
        },
        complete: function () {
          // 在 ActionSheet 关闭后再复制剪贴板，避免弹框冲突
          wx.setClipboardData({
            data: summaryText,
            success: function () {
              wx.showToast({
                title: '汇总已复制，可前往微信聊天粘贴',
                icon: 'none',
                duration: 2500,
              });
            },
            fail: function () {
              wx.showToast({ title: '复制失败', icon: 'none' });
            },
          });
        },
      });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: (err && err.message) || '导出失败', icon: 'none' });
    }
  },

  /** 批量删除 */
  batchDelete() {
    var selectedIds = this.data.selectedIds;
    if (selectedIds.length === 0) {
      wx.showToast({ title: '请选择发票', icon: 'none' });
      return;
    }
    var that = this;
    wx.showModal({
      title: '确认批量删除',
      content: '确认删除选中的 ' + selectedIds.length + ' 张发票？此操作不可恢复。',
      confirmColor: '#FF3B30',
      success: async function(res) {
        if (!res.confirm) return;
        try {
          await api.invoices.batchDelete(selectedIds);
          wx.showToast({ title: '删除成功', icon: 'success' });
          that.setData({ selectedIds: [], batchMode: false });
          that.resetAndLoad();
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      },
    });
  },

  // ========== 搜索 ==========

  /** 搜索输入 */
  onSearchInput(e) {
    var keyword = e.detail.value || '';
    this.setData({ keyword: keyword });
    var filteredList = this.filterByKeyword(this.data.list, keyword);
    this.setData({ filteredList: filteredList });
    this._syncCheckedState();
  },

  /** 搜索确认 */
  onSearch() {
    var filteredList = this.filterByKeyword(this.data.list, this.data.keyword);
    this.setData({ filteredList: filteredList });
    this._syncCheckedState();
  },

  /** 根据关键词过滤列表 */
  filterByKeyword(list, keyword) {
    if (!keyword || !keyword.trim()) return list;
    var kw = keyword.trim().toLowerCase();
    return list.filter(function(item) {
      var name = (item.invoiceCode || '').toLowerCase();
      var company = (item.sellerName || item.buyerName || '').toLowerCase();
      var number = (item.invoiceNumber || '').toLowerCase();
      return name.indexOf(kw) >= 0 || company.indexOf(kw) >= 0 || number.indexOf(kw) >= 0;
    });
  },

  onPullDownRefresh() {
    this.resetAndLoad();
    wx.stopPullDownRefresh();
  },
});
