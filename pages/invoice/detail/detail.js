const { api } = require('../../../utils/request');

/** 状态映射表 */
const STATUS_MAP = {
  approved: '已审核',
};

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

/** 格式化金额 */
function formatAmount(amount) {
  return amount ? Number(amount).toFixed(2) : '0.00';
}

/** 格式化日期 */
function formatDate(date) {
  if (!date) return '-';
  return String(date).slice(0, 10);
}

/**
 * 根据查验结果映射核销状态
 * 返回 { label, className, showSection, detailItems }
 */
function computeVerifyResult(verifyResult) {
  if (!verifyResult) return { showSection: false };

  var data = verifyResult.Data || verifyResult.data || verifyResult;
  var detailItems = [];

  // 尝试从 Data 中提取可展示的字段
  if (data.InvoiceCode) detailItems.push({ label: '查验发票代码', value: String(data.InvoiceCode) });
  if (data.InvoiceNumber) detailItems.push({ label: '查验发票号码', value: String(data.InvoiceNumber) });
  if (data.InvoiceDate) detailItems.push({ label: '查验开票日期', value: String(data.InvoiceDate) });
  if (data.InvoiceAmount) detailItems.push({ label: '查验金额', value: '¥' + String(data.InvoiceAmount) });

  // 状态字段
  var verifyStatus = data.VerifyStatus || data.verifyStatus || data.Status || data.status;
  var isValid = data.IsValid !== undefined ? data.IsValid : (data.isValid !== undefined ? data.isValid : undefined);

  var label;
  var className;
  if (isValid === true) {
    label = '核销正常';
    className = 'verify-ok';
  } else if (isValid === false) {
    label = '已被核销';
    className = 'verify-invalid';
  } else if (verifyStatus !== undefined && verifyStatus !== null) {
    var s = String(verifyStatus).toLowerCase();
    if (s === '00' || s === '01' || s === 'ok' || s === 'success' || s === 'valid') {
      label = '核销正常';
      className = 'verify-ok';
    } else {
      label = '已被核销';
      className = 'verify-invalid';
    }
  } else {
    label = '已查验';
    className = 'verify-checked';
  }

  if (verifyStatus !== undefined && verifyStatus !== null) {
    detailItems.push({ label: '查验状态码', value: String(verifyStatus) });
  }

  // 如果有查验请求ID也展示
  if (verifyResult.RequestId) {
    detailItems.push({ label: '查验请求ID', value: String(verifyResult.RequestId) });
  }

  return {
    showSection: true,
    verifyLabel: label,
    verifyClassName: className,
    verifyDetailItems: detailItems,
  };
}

Page({
  data: {
    invoice: null,
    loading: true,
    // 预计算字段（WXML不支持调用Page方法，必须在setData时预计算）
    statusText: '',
    amountText: '0.00',
    dateText: '-',
    // 扩展信息
    sellerNameText: '--',
    buyerNameText: '--',
    taxText: '--',
    sellerTaxNoText: '--',
    buyerTaxNoText: '--',
    typeTagText: '其他',
  },

  onLoad(options) {
    if (options.id) {
      this.loadInvoice(options.id);
    }
  },

  async loadInvoice(id) {
    try {
      var invoice = await api.invoices.detail(id);

      // 预计算所有模板需要的值
      var sellerNameText = invoice.sellerName || '--';
      var buyerNameText = invoice.buyerName || '--';
      var taxText = invoice.tax ? '¥' + Number(invoice.tax).toFixed(2) : '--';
      var sellerTaxNoText = invoice.sellerTaxNo || '--';
      var buyerTaxNoText = invoice.buyerTaxNo || '--';
      var typeTagText = TYPE_MAP[invoice.type] || '其他';
      var fileName = '';
      if (invoice.images && invoice.images.length > 0) {
        var path = invoice.images[0];
        var idx = path.lastIndexOf('/');
        fileName = idx >= 0 ? path.slice(idx + 1) : path;
      }

      // 核销查验结果
      var verifyData = computeVerifyResult(invoice.verifyResult);

      this.setData({
        invoice: invoice,
        loading: false,
        statusText: STATUS_MAP[invoice.status] || invoice.status || '',
        amountText: formatAmount(invoice.amount),
        dateText: formatDate(invoice.invoiceDate),
        sellerNameText: sellerNameText,
        buyerNameText: buyerNameText,
        taxText: taxText,
        sellerTaxNoText: sellerTaxNoText,
        buyerTaxNoText: buyerTaxNoText,
        typeTagText: typeTagText,
        fileName: fileName,
        showVerifySection: verifyData.showSection,
        verifyLabel: verifyData.verifyLabel || '',
        verifyClassName: verifyData.verifyClassName || '',
        verifyDetailItems: verifyData.verifyDetailItems || [],
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  /** 预览发票文件（PDF等，使用 wx.openDocument） */
  previewFile() {
    var invoice = this.data.invoice;
    if (!invoice || !invoice.images || invoice.images.length === 0) return;

    var fileUrl = invoice.images[0];
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

  /** 跳转编辑页 */
  onEdit() {
    var invoice = this.data.invoice;
    if (!invoice) return;
    wx.navigateTo({ url: '/pages/invoice/upload/upload?id=' + invoice.id });
  },

  /** 删除发票 */
  onDelete() {
    var invoice = this.data.invoice;
    if (!invoice) return;
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确认删除该发票？',
      confirmColor: '#FF3B30',
      success: async function(res) {
        if (!res.confirm) return;
        try {
          await api.invoices.remove(invoice.id);
          wx.showToast({ title: '删除成功', icon: 'success' });
          setTimeout(function() { wx.navigateBack(); }, 1500);
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      },
    });
  },
});
