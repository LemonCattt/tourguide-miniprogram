/**
 * Unit tests for onExportToChat() method in pages/invoice/list/list.js
 *
 * Run: node test_onExportToChat.js
 */

'use strict';

const assert = require('assert');
const path = require('path');

// ============================================================
// Test state & helpers — async-safe runner
// ============================================================
let passed = 0;
let failed = 0;
const failures = [];
const testQueue = [];

function test(name, fn) {
  testQueue.push({ name: name, fn: fn });
}

async function runTests() {
  for (var i = 0; i < testQueue.length; i++) {
    var t = testQueue[i];
    try {
      var result = t.fn();
      // Await if it returns a thenable (Promise)
      if (result && typeof result.then === 'function') {
        await result;
      }
      passed++;
      console.log('  ✓ ' + t.name);
    } catch (e) {
      failed++;
      var msg = '  ✗ ' + t.name + '\n      ' + e.message.replace(/\n/g, '\n      ');
      console.log(msg);
      failures.push({ name: t.name, error: e.message });
    }
  }
}

function assertEqual(actual, expected, msg) {
  assert.strictEqual(actual, expected, msg);
}

function assertOk(value, msg) {
  assert.ok(value, msg);
}

function assertIncludes(haystack, needle, msg) {
  assert.ok(haystack.indexOf(needle) >= 0, msg || ('Expected "' + haystack + '" to include "' + needle + '"'));
}

// ============================================================
// Mock factories — fresh mocks for each test
// ============================================================

function createMockWx() {
  const calls = {
    showLoading: [],
    hideLoading: [],
    showToast: [],
    showModal: [],
    showActionSheet: [],
    setClipboardData: [],
    downloadFile: [],
    openDocument: [],
  };

  return {
    _calls: calls,
    showLoading: function (opts) { calls.showLoading.push(opts); },
    hideLoading: function (opts) { calls.hideLoading.push(opts || {}); },
    showToast: function (opts) { calls.showToast.push(opts); },
    showModal: function (opts) {
      calls.showModal.push(opts);
      // Store the callbacks so tests can fire them
      if (opts.success) calls.showModal._lastSuccess = opts.success;
    },
    showActionSheet: function (opts) {
      calls.showActionSheet.push(opts);
      if (opts.success) calls.showActionSheet._lastSuccess = opts.success;
      if (opts.fail) calls.showActionSheet._lastFail = opts.fail;
    },
    setClipboardData: function (opts) {
      calls.setClipboardData.push(opts);
      if (opts.success) calls.setClipboardData._lastSuccess = opts.success;
      if (opts.fail) calls.setClipboardData._lastFail = opts.fail;
    },
    downloadFile: function (opts) {
      calls.downloadFile.push(opts);
      if (opts.success) calls.downloadFile._lastSuccess = opts.success;
      if (opts.fail) calls.downloadFile._lastFail = opts.fail;
    },
    openDocument: function (opts) {
      calls.openDocument.push(opts);
      if (opts.success) calls.openDocument._lastSuccess = opts.success;
      if (opts.fail) calls.openDocument._lastFail = opts.fail;
    },
  };
}

function createExportDataResponse(overrides) {
  const defaults = {
    summary: { count: 3, totalAmount: 456.78 },
    items: [
      { id: '1', invoiceNumber: 'INV-001', type: 'vat_special', invoiceDate: '2025-01-15', amount: 123.45, sellerName: '公司A', fileUrl: 'https://example.com/inv1.pdf' },
      { id: '2', invoiceNumber: 'INV-002', type: 'vat_normal',  invoiceDate: '2025-02-20', amount: 234.56, sellerName: '公司B', fileUrl: 'https://example.com/inv2.pdf' },
      { id: '3', invoiceNumber: 'INV-003', type: 'vat_electronic', invoiceDate: '2025-03-10', amount: 98.77, sellerName: '公司C', fileUrl: 'https://example.com/inv3.pdf' },
    ],
  };
  if (overrides) {
    return Object.assign({}, defaults, overrides, {
      summary: overrides.summary !== undefined ? Object.assign({}, defaults.summary, overrides.summary) : defaults.summary,
      items: overrides.items !== undefined ? overrides.items : defaults.items,
    });
  }
  return defaults;
}

/**
 * Set up the page environment and load list.js with mocked dependencies.
 * Returns { pageConfig, mockWx }.
 */
function setupPage(mockApi) {
  // Reset global state
  delete require.cache[require.resolve('./pages/invoice/list/list')];

  const mockWx = createMockWx();
  global.wx = mockWx;

  // Intercept require for utils/request
  const Module = require('module');
  const origRequire = Module.prototype.require;
  let pageConfig = null;

  Module.prototype.require = function (id) {
    if (id.includes('utils/request')) {
      return { api: mockApi };
    }
    return origRequire.apply(this, arguments);
  };

  global.Page = function (config) {
    pageConfig = config;
  };

  // Load the page module
  require('./pages/invoice/list/list');

  // Restore require but KEEP global.wx alive — the async onExportToChat
  // accesses wx as a global at runtime (not via closure).
  Module.prototype.require = origRequire;
  delete global.Page;
  // NOTE: do NOT delete global.wx here; onExportToChat needs it at runtime

  return { pageConfig, mockWx };
}

/**
 * Create a mock page "this" context for calling onExportToChat.
 */
function createPageContext(mockWx, overrides) {
  return {
    data: Object.assign({ selectedIds: ['1', '2', '3'] }, overrides || {}),
    setData: function (obj) { Object.assign(this.data, obj); },
    _mockWx: mockWx,
  };
}

// ============================================================
// TEST SUITE
// ============================================================

console.log('\n=== onExportToChat() Unit Tests ===\n');

// ----------------------------------------------------------
// Category 1: Clipboard Logic Preservation
// ----------------------------------------------------------
console.log('--- Category 1: Clipboard Logic ---');

test('wx.setClipboardData is called with summary text on success', function () {
  const mockApi = { invoices: { exportData: () => Promise.resolve(createExportDataResponse()) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    const clipCalls = mockWx._calls.setClipboardData;
    assertEqual(clipCalls.length, 1, 'setClipboardData should be called once');

    const data = clipCalls[0].data;
    assertIncludes(data, '发票报销汇总', 'summary should contain header');
    assertIncludes(data, '共 3 张发票，合计 ¥456.78', 'summary should contain count and total');
    assertIncludes(data, '[专票] 2025-01-15 ¥123.45 — 公司A', 'summary should contain item 1');
    assertIncludes(data, '[普票] 2025-02-20 ¥234.56 — 公司B', 'summary should contain item 2');
    assertIncludes(data, '[电子票] 2025-03-10 ¥98.77 — 公司C', 'summary should contain item 3');
  });
});

test('wx.setClipboardData success triggers showModal with export info', function () {
  const mockApi = { invoices: { exportData: () => Promise.resolve(createExportDataResponse()) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    // Fire the clipboard success callback
    mockWx._calls.setClipboardData._lastSuccess();

    const modalCalls = mockWx._calls.showModal;
    assertEqual(modalCalls.length, 1, 'showModal should be called once');
    assertEqual(modalCalls[0].title, '导出成功', 'modal title should be 导出成功');
    assertIncludes(modalCalls[0].content, '发票汇总已复制到剪贴板', 'modal should mention clipboard');
    assertIncludes(modalCalls[0].content, '共 3 张，合计 ¥456.78', 'modal should show count and total');
    assertEqual(modalCalls[0].showCancel, false, 'modal should not have cancel button');
    assertEqual(modalCalls[0].confirmText, '知道了', 'confirm text should be 知道了');
  });
});

test('wx.setClipboardData fail triggers toast', function () {
  const mockApi = { invoices: { exportData: () => Promise.resolve(createExportDataResponse()) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    // Fire the clipboard fail callback
    mockWx._calls.setClipboardData._lastFail();

    const toastCalls = mockWx._calls.showToast;
    const failToast = toastCalls.find(function (t) { return t.title === '复制失败'; });
    assertOk(failToast, 'should show 复制失败 toast on clipboard failure');
    assertEqual(failToast.icon, 'none');
  });
});

test('summary uses fallback when summary.count is undefined — uses items.length', function () {
  const resp = createExportDataResponse({ summary: {} }); // no count/totalAmount
  const mockApi = { invoices: { exportData: () => Promise.resolve(resp) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    const data = mockWx._calls.setClipboardData[0].data;
    assertIncludes(data, '共 3 张发票', 'should fallback count to items.length');
    // totalAmount fallback: 123.45 + 234.56 + 98.77 = 456.78
    assertIncludes(data, '合计 ¥456.78', 'should compute totalAmount from items');
  });
});

test('summary uses fallback when summary fields are null — uses items', function () {
  const resp = createExportDataResponse({ summary: { count: null, totalAmount: null } });
  const mockApi = { invoices: { exportData: () => Promise.resolve(resp) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    const data = mockWx._calls.setClipboardData[0].data;
    assertIncludes(data, '共 3 张发票', 'should fallback count to items.length when null');
  });
});

// ----------------------------------------------------------
// Category 2: ActionSheet Interaction
// ----------------------------------------------------------
console.log('\n--- Category 2: ActionSheet Interaction ---');

test('wx.showActionSheet is called with correct itemList from items', function () {
  const mockApi = { invoices: { exportData: () => Promise.resolve(createExportDataResponse()) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    const asCalls = mockWx._calls.showActionSheet;
    assertEqual(asCalls.length, 1, 'showActionSheet should be called once');

    const itemList = asCalls[0].itemList;
    assertEqual(itemList.length, 3, 'itemList should have 3 items');
    assertIncludes(itemList[0], 'INV-001', 'item should include invoiceNumber');
    assertIncludes(itemList[0], '¥123.45', 'item should include amount');
    assertIncludes(itemList[1], 'INV-002');
    assertIncludes(itemList[1], '¥234.56');
    assertIncludes(itemList[2], 'INV-003');
    assertIncludes(itemList[2], '¥98.77');
  });
});

test('ActionSheet item format: "发票号 ¥金额"', function () {
  const mockApi = { invoices: { exportData: () => Promise.resolve(createExportDataResponse()) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    const itemList = mockWx._calls.showActionSheet[0].itemList;
    // Pattern: invoiceNumber + ' ¥' + amount
    assertEqual(itemList[0], 'INV-001 ¥123.45');
  });
});

test('ActionSheet item uses fallback name when invoiceNumber is missing', function () {
  const resp = createExportDataResponse({
    items: [
      { id: '1', type: 'other', invoiceDate: '2025-01-15', amount: 50, fileUrl: 'https://x.com/a.pdf' },
      { id: '2', type: 'other', invoiceDate: '2025-02-20', amount: 60, fileUrl: 'https://x.com/b.pdf' },
    ],
  });
  const mockApi = { invoices: { exportData: () => Promise.resolve(resp) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    const itemList = mockWx._calls.showActionSheet[0].itemList;
    assertIncludes(itemList[0], '发票1', 'should use "发票1" as fallback name');
    assertIncludes(itemList[1], '发票2', 'should use "发票2" as fallback name');
  });
});

test('ActionSheet item omits amount when amount is falsy', function () {
  const resp = createExportDataResponse({
    items: [
      { id: '1', invoiceNumber: 'INV-A', type: 'other', invoiceDate: '2025-01-15', amount: 0, fileUrl: 'https://x.com/a.pdf' },
    ],
    summary: { count: 1, totalAmount: 0 },
  });
  const mockApi = { invoices: { exportData: () => Promise.resolve(resp) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    const itemList = mockWx._calls.showActionSheet[0].itemList;
    // amount is 0, which is falsy, so no amount suffix
    assertEqual(itemList[0], 'INV-A', 'should not append empty amount');
  });
});

test('ActionSheet truncation: >6 items → first 5 + hint', function () {
  const items = [];
  for (var i = 0; i < 10; i++) {
    items.push({
      id: String(i + 1),
      invoiceNumber: 'INV-' + String(i + 1).padStart(3, '0'),
      type: 'other',
      invoiceDate: '2025-01-01',
      amount: 100,
      fileUrl: 'https://example.com/inv' + (i + 1) + '.pdf',
    });
  }
  const resp = createExportDataResponse({ items: items, summary: { count: 10, totalAmount: 1000 } });
  const mockApi = { invoices: { exportData: () => Promise.resolve(resp) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    const itemList = mockWx._calls.showActionSheet[0].itemList;
    assertEqual(itemList.length, 6, 'truncated list should have exactly 6 entries');
    assertIncludes(itemList[0], 'INV-001', 'first item should be item 0');
    assertIncludes(itemList[4], 'INV-005', 'fifth item should be item 4');
    assertIncludes(itemList[5], '共 10 张，已复制到剪贴板', 'last item should be hint');
  });
});

test('ActionSheet: no truncation when exactly 6 items', function () {
  const items = [];
  for (var i = 0; i < 6; i++) {
    items.push({
      id: String(i + 1),
      invoiceNumber: 'INV-' + String(i + 1).padStart(3, '0'),
      type: 'other',
      invoiceDate: '2025-01-01',
      amount: 100,
      fileUrl: 'https://example.com/inv' + (i + 1) + '.pdf',
    });
  }
  const resp = createExportDataResponse({ items: items, summary: { count: 6, totalAmount: 600 } });
  const mockApi = { invoices: { exportData: () => Promise.resolve(resp) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    const itemList = mockWx._calls.showActionSheet[0].itemList;
    assertEqual(itemList.length, 6, 'exactly 6 items should not be truncated');
    assertEqual(itemList[5], 'INV-006 ¥100.00', 'last item should be real item, not hint');
  });
});

// displayedCount guard — new tests for the fix
test('displayedCount guard: non-truncated (≤6 items), out-of-range tap is ignored', function () {
  const mockApi = { invoices: { exportData: () => Promise.resolve(createExportDataResponse()) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    // 3 items, tap index 3 (out of range) — should be ignored
    mockWx._calls.showActionSheet._lastSuccess({ tapIndex: 3 });
    const dlCalls = mockWx._calls.downloadFile;
    assertEqual(dlCalls.length, 0, 'out-of-range tap should not trigger download');
  });
});

test('displayedCount guard: truncated (>6 items), tap on valid item still works', function () {
  const items = [];
  for (var i = 0; i < 10; i++) {
    items.push({
      id: String(i + 1),
      invoiceNumber: 'INV-' + String(i + 1).padStart(3, '0'),
      type: 'other',
      invoiceDate: '2025-01-01',
      amount: 100,
      fileUrl: 'https://example.com/inv' + (i + 1) + '.pdf',
    });
  }
  const resp = createExportDataResponse({ items: items, summary: { count: 10, totalAmount: 1000 } });
  const mockApi = { invoices: { exportData: () => Promise.resolve(resp) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    // Tap valid item at index 3 (item[3] = INV-004)
    mockWx._calls.showActionSheet._lastSuccess({ tapIndex: 3 });
    const dlCalls = mockWx._calls.downloadFile;
    assertEqual(dlCalls.length, 1, 'valid item tap should trigger download');
    assertEqual(dlCalls[0].url, 'https://example.com/inv4.pdf', 'should download correct item');
  });
});

// ----------------------------------------------------------
// Category 3: Download + Open Logic
// ----------------------------------------------------------
console.log('\n--- Category 3: Download + Open Logic ---');

test('ActionSheet item tap triggers downloadFile with correct URL', function () {
  const mockApi = { invoices: { exportData: () => Promise.resolve(createExportDataResponse()) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    // Simulate tapping item index 0
    mockWx._calls.showActionSheet._lastSuccess({ tapIndex: 0 });

    const dlCalls = mockWx._calls.downloadFile;
    assertEqual(dlCalls.length, 1, 'downloadFile should be called');
    assertEqual(dlCalls[0].url, 'https://example.com/inv1.pdf', 'should use correct fileUrl');
  });
});

test('ActionSheet item tap shows loading before download', function () {
  const mockApi = { invoices: { exportData: () => Promise.resolve(createExportDataResponse()) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    // Check that loading was shown BEFORE export (during export)
    const allLoadings = mockWx._calls.showLoading;
    const exportLoading = allLoadings.find(function (l) { return l.title === '准备导出...'; });
    assertOk(exportLoading, 'should show 准备导出 loading at start');

    // After export, hideLoading is called
    const hideCalls = mockWx._calls.hideLoading;
    assertOk(hideCalls.length >= 1, 'hideLoading should be called at least once after export');
  });
});

test('Item with no fileUrl shows toast and does NOT download', function () {
  const resp = createExportDataResponse({
    items: [
      { id: '1', invoiceNumber: 'INV-001', type: 'other', invoiceDate: '2025-01-15', amount: 50 },
      // No fileUrl
    ],
    summary: { count: 1, totalAmount: 50 },
  });
  const mockApi = { invoices: { exportData: () => Promise.resolve(resp) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    // Simulate tapping item
    mockWx._calls.showActionSheet._lastSuccess({ tapIndex: 0 });

    const toastCalls = mockWx._calls.showToast;
    const noFileToast = toastCalls.find(function (t) { return t.title === '无文件可打开'; });
    assertOk(noFileToast, 'should show 无文件可打开 toast');

    const dlCalls = mockWx._calls.downloadFile;
    assertEqual(dlCalls.length, 0, 'downloadFile should NOT be called when no fileUrl');
  });
});

test('downloadFile success → openDocument with showMenu:true and fileType:pdf', function () {
  const mockApi = { invoices: { exportData: () => Promise.resolve(createExportDataResponse()) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    mockWx._calls.showActionSheet._lastSuccess({ tapIndex: 0 });

    // Simulate downloadFile success
    mockWx._calls.downloadFile._lastSuccess({ tempFilePath: '/tmp/inv1.pdf', statusCode: 200 });

    const odCalls = mockWx._calls.openDocument;
    assertEqual(odCalls.length, 1, 'openDocument should be called');
    assertEqual(odCalls[0].filePath, '/tmp/inv1.pdf', 'should pass tempFilePath');
    assertEqual(odCalls[0].fileType, 'pdf', 'fileType should be pdf');
    assertEqual(odCalls[0].showMenu, true, 'showMenu should be true');
  });
});

test('openDocument success shows toast with send hint', function () {
  const mockApi = { invoices: { exportData: () => Promise.resolve(createExportDataResponse()) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    mockWx._calls.showActionSheet._lastSuccess({ tapIndex: 0 });
    mockWx._calls.downloadFile._lastSuccess({ tempFilePath: '/tmp/inv1.pdf', statusCode: 200 });

    // Simulate openDocument success
    mockWx._calls.openDocument._lastSuccess();

    const toastCalls = mockWx._calls.showToast;
    const sendToast = toastCalls.find(function (t) { return t.title && t.title.indexOf('发送') >= 0; });
    assertOk(sendToast, 'should show toast about sending via menu');
    assertEqual(sendToast.duration, 2500, 'toast duration should be 2500ms');
  });
});

test('openDocument fail shows toast 打开失败', function () {
  const mockApi = { invoices: { exportData: () => Promise.resolve(createExportDataResponse()) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    mockWx._calls.showActionSheet._lastSuccess({ tapIndex: 0 });
    mockWx._calls.downloadFile._lastSuccess({ tempFilePath: '/tmp/inv1.pdf', statusCode: 200 });

    // Simulate openDocument fail
    mockWx._calls.openDocument._lastFail();

    const toastCalls = mockWx._calls.showToast;
    const failToast = toastCalls.find(function (t) { return t.title === '打开失败'; });
    assertOk(failToast, 'should show 打开失败 toast');
  });
});

test('downloadFile fail shows toast 下载失败 and hides loading', function () {
  const mockApi = { invoices: { exportData: () => Promise.resolve(createExportDataResponse()) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    mockWx._calls.showActionSheet._lastSuccess({ tapIndex: 0 });

    // Simulate downloadFile fail
    mockWx._calls.downloadFile._lastFail();

    const toastCalls = mockWx._calls.showToast;
    const failToast = toastCalls.find(function (t) { return t.title === '下载失败'; });
    assertOk(failToast, 'should show 下载失败 toast');

    // hideLoading should have been called (at export completion + on download fail)
    const hideCalls = mockWx._calls.hideLoading;
    assertOk(hideCalls.length >= 2, 'hideLoading should be called for export and download fail');
  });
});

test('loading is shown during download and hidden on completion', function () {
  const mockApi = { invoices: { exportData: () => Promise.resolve(createExportDataResponse()) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    mockWx._calls.showActionSheet._lastSuccess({ tapIndex: 0 });

    // Loading should be shown for download
    const dlLoadings = mockWx._calls.showLoading.filter(function (l) { return l.title === '加载中...'; });
    assertEqual(dlLoadings.length, 1, 'should show 加载中... during download');

    mockWx._calls.downloadFile._lastSuccess({ tempFilePath: '/tmp/inv1.pdf', statusCode: 200 });

    // hideLoading should be called after successful download
    const hideCalls = mockWx._calls.hideLoading;
    assertOk(hideCalls.length >= 2, 'hideLoading called after export and after download');
  });
});

// ----------------------------------------------------------
// Category 4: Error handling & edge cases
// ----------------------------------------------------------
console.log('\n--- Category 4: Error Handling & Edge Cases ---');

test('empty selection shows toast and returns early', function () {
  const mockApi = { invoices: { exportData: () => Promise.resolve(createExportDataResponse()) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx, { selectedIds: [] });

  return pageConfig.onExportToChat.call(ctx).then(function () {
    const toastCalls = mockWx._calls.showToast;
    const emptyToast = toastCalls.find(function (t) { return t.title === '请选择发票'; });
    assertOk(emptyToast, 'should show 请选择发票 toast');
    assertEqual(mockWx._calls.showLoading.length, 0, 'should not show loading for empty selection');
  });
});

test('API call failure shows error toast and hides loading', function () {
  const mockApi = {
    invoices: {
      exportData: function () { return Promise.reject(new Error('网络异常')); },
    },
  };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    const toastCalls = mockWx._calls.showToast;
    const errToast = toastCalls.find(function (t) { return t.title === '网络异常'; });
    assertOk(errToast, 'should show error message from Error object');

    const hideCalls = mockWx._calls.hideLoading;
    assertOk(hideCalls.length >= 1, 'should hide loading on error');
  });
});

test('API call failure with no message shows default 导出失败', function () {
  const mockApi = {
    invoices: {
      exportData: function () { return Promise.reject({}); },
    },
  };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    const toastCalls = mockWx._calls.showToast;
    const errToast = toastCalls.find(function (t) { return t.title === '导出失败'; });
    assertOk(errToast, 'should show default 导出失败 message');
  });
});

test('items with missing optional fields do not crash summary generation', function () {
  const resp = createExportDataResponse({
    items: [
      { id: '1', invoiceNumber: 'INV-001', type: 'unknown_type', invoiceDate: null, amount: undefined, sellerName: null, fileUrl: 'https://x.com/a.pdf' },
    ],
    summary: { count: 1, totalAmount: 0 },
  });
  const mockApi = { invoices: { exportData: () => Promise.resolve(resp) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    const data = mockWx._calls.setClipboardData[0].data;
    assertIncludes(data, '[其他]', 'unknown type should map to 其他');
    assertIncludes(data, '--', 'null invoiceDate should render as --');
    assertIncludes(data, '¥0.00', 'undefined amount should render as 0.00');
    assertIncludes(data, '--', 'null sellerName should render as --');
  });
});

test('ActionSheet hint tap (>6 items) should be guarded — regression check', function () {
  // When items > 6, the ActionSheet shows first 5 + "共X张，已复制到剪贴板" at index 5.
  // The guard `if (idx >= items.length) return;` does NOT catch this case because
  // items.length (e.g., 10) > idx (5).
  // Expected: tapping the hint should be a no-op (no download).
  // BUG CONFIRMED: downloadFile IS called for items[5] instead of returning early.

  const items = [];
  for (var i = 0; i < 10; i++) {
    items.push({
      id: String(i + 1),
      invoiceNumber: 'INV-' + String(i + 1).padStart(3, '0'),
      type: 'other',
      invoiceDate: '2025-01-01',
      amount: 100,
      fileUrl: 'https://example.com/inv' + (i + 1) + '.pdf',
    });
  }
  const resp = createExportDataResponse({ items: items, summary: { count: 10, totalAmount: 1000 } });
  const mockApi = { invoices: { exportData: () => Promise.resolve(resp) } };
  const { pageConfig, mockWx } = setupPage(mockApi);
  const ctx = createPageContext(mockWx);

  return pageConfig.onExportToChat.call(ctx).then(function () {
    // Tapping the hint item at index 5 (the "共X张，已复制到剪贴板" row)
    mockWx._calls.showActionSheet._lastSuccess({ tapIndex: 5 });

    // BUG: The guard `if (idx >= items.length) return;` does not catch idx=5
    // when items.length=10. downloadFile IS incorrectly called.
    const dlCalls = mockWx._calls.downloadFile;
    // Expected: 0 (hint tap should be no-op). Actual: 1 (downloads items[5]).
    assertEqual(dlCalls.length, 0,
      'BUG: Hint tap should not trigger downloadFile. ' +
      'Got ' + dlCalls.length + ' downloadFile calls. ' +
      'Guard `idx >= items.length` fails when items.length > 6. ' +
      'Fix: check against truncated count, e.g., `idx >= Math.min(items.length, 5)` or track isTruncated flag.');
  });
});

// ----------------------------------------------------------
// Syntax Check
// ----------------------------------------------------------
console.log('\n--- Category 5: Syntax Check ---');

test('source file passes node --check (no syntax errors)', function () {
  // Already loaded successfully by setupPage, but verify explicitly
  const { execSync } = require('child_process');
  try {
    execSync('node --check pages/invoice/list/list.js', { cwd: __dirname, stdio: 'pipe' });
  } catch (e) {
    assert.fail('Syntax error in list.js: ' + e.stderr.toString());
  }
});

// ============================================================
// Main: run all tests and report
// ============================================================

runTests().then(function () {
  console.log('\n========================================');
  console.log('  Test Report');
  console.log('========================================');
  console.log('  Total:  ' + (passed + failed));
  console.log('  Passed: ' + passed);
  console.log('  Failed: ' + failed);
  console.log('========================================\n');

  if (failures.length > 0) {
    console.log('Failures:');
    failures.forEach(function (f) {
      console.log('  - ' + f.name + ': ' + f.error);
    });
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
});
