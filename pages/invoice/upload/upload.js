var { createBatchUploader, MAX_FILES } = require('./batch-uploader');

Page({
  data: {
    // Phase: 'idle' | 'processing' | 'done'
    phase: 'idle',

    // Progress
    totalCount: 0,
    completedCount: 0,
    progressPercent: 0,
    hasWaiting: false,

    // File list for rendering
    files: [],

    // Summary
    summary: { done: 0, failed: 0, duplicate: 0 },
    failedFiles: [],
    duplicateFiles: [],

    // Cancellation flag
    cancelled: false,
  },

  /** Batch uploader instance — created on first use */
  uploader: null,

  onLoad: function () {
    // Page initialized in idle state
  },

  /**
   * Choose files from WeChat chat.
   * Opens the system file picker for PDF/images.
   */
  onChooseFiles: function () {
    var that = this;
    wx.chooseMessageFile({
      count: MAX_FILES,
      type: 'file',
      success: function (res) {
        var tempFiles = res.tempFiles;
        if (!tempFiles || tempFiles.length === 0) {
          wx.showToast({ title: '未选择文件', icon: 'none' });
          return;
        }

        // Create batch uploader
        that.uploader = createBatchUploader({});

        // Map to expected format
        var filePaths = [];
        for (var i = 0; i < tempFiles.length; i++) {
          filePaths.push({
            path: tempFiles[i].path,
            name: tempFiles[i].name || ('file_' + (i + 1)),
            size: tempFiles[i].size || 0,
          });
        }

        // Add to queue
        that.uploader.addFiles(filePaths);

        // Get initial file list
        var files = that.uploader.getFiles();

        that.setData({
          phase: 'processing',
          totalCount: files.length,
          completedCount: 0,
          progressPercent: 0,
          files: files,
          hasWaiting: true,
          cancelled: false,
        });

        // Start processing
        that.startProcessing();
      },
      fail: function (err) {
        if (err && err.errMsg && err.errMsg.indexOf('cancel') < 0) {
          wx.showToast({ title: '选择文件失败', icon: 'none' });
        }
      },
    });
  },

  /**
   * Start processing the file queue.
   */
  startProcessing: function () {
    var that = this;
    if (!that.uploader) return;

    that.uploader.start(function (report) {
      // Ignore progress updates if cancelled
      if (that.data.cancelled) return;

      var done = report.completed;
      var failed = report.failed;
      var dup = report.duplicated;
      var total = report.total;
      var processed = done + failed + dup;
      var percent = total > 0 ? Math.floor((processed / total) * 100) : 0;

      that.setData({
        files: report.files,
        completedCount: done,
        totalCount: total,
        progressPercent: percent,
        hasWaiting: processed < total,
      });
    }).then(function (results) {
      if (that.data.cancelled) return;

      var failedFiles = [];
      var duplicateFiles = [];
      for (var i = 0; i < results.failed.length; i++) {
        failedFiles.push(results.failed[i]);
      }
      for (var j = 0; j < results.duplicate.length; j++) {
        duplicateFiles.push(results.duplicate[j]);
      }

      that.setData({
        phase: 'done',
        summary: results.summary,
        failedFiles: failedFiles,
        duplicateFiles: duplicateFiles,
        hasWaiting: false,
      });
    }).catch(function (err) {
      that.setData({
        phase: 'done',
        summary: { done: 0, failed: 0, duplicate: 0 },
        failedFiles: [],
        duplicateFiles: [],
      });
      wx.showToast({ title: '处理异常', icon: 'none' });
    });
  },

  /**
   * Cancel remaining tasks in the queue.
   */
  onCancel: function () {
    var that = this;
    wx.showModal({
      title: '确认取消',
      content: '取消后已完成的上传将保留，剩余文件不再处理。',
      confirmColor: '#FF3B30',
      success: function (res) {
        if (!res.confirm) return;

        that.setData({ cancelled: true });

        // Gather current results
        if (that.uploader) {
          var results = that.uploader.getResults();
          var failedFiles = [];
          var duplicateFiles = [];
          for (var i = 0; i < results.failed.length; i++) {
            failedFiles.push(results.failed[i]);
          }
          for (var j = 0; j < results.duplicate.length; j++) {
            duplicateFiles.push(results.duplicate[j]);
          }

          that.setData({
            phase: 'done',
            summary: results.summary,
            failedFiles: failedFiles,
            duplicateFiles: duplicateFiles,
            hasWaiting: false,
          });
        }
      },
    });
  },

  /**
   * Retry failed files only.
   */
  onRetryFailed: function () {
    if (!this.uploader) return;

    // Reset failed files back to waiting so start() picks them up
    var resetCount = this.uploader.resetFailed();
    if (resetCount === 0) {
      wx.showToast({ title: '没有需要重试的文件', icon: 'none' });
      return;
    }

    var that = this;
    that.setData({
      phase: 'processing',
      completedCount: 0,
      progressPercent: 0,
      hasWaiting: true,
      cancelled: false,
      files: that.uploader.getFiles(),
      totalCount: that.data.failedFiles.length,
    });

    that.startProcessing();
  },

  /**
   * Navigate back to the invoice list.
   */
  onBackToList: function () {
    wx.navigateBack({
      delta: 1,
      fail: function () {
        wx.switchTab({ url: '/pages/invoice/list/list' });
      },
    });
  },
});
