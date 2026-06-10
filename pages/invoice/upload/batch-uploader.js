/**
 * Batch uploader — task queue manager for invoice upload.
 *
 * Maintains a file queue with per-file state tracking.
 * Processes files sequentially (one at a time) because WeChat's
 * wx.uploadFile only supports single-file uploads.
 *
 * State machine:
 *   waiting → uploading → ocr → saving → done
 *                                   ↘ failed
 *   waiting → duplicate (skipped by frontend dedup)
 */

var { api } = require('../../../utils/request');

/** Maximum number of files allowed in one batch */
var MAX_FILES = 20;

/** Allowed file extensions */
var ALLOWED_EXTS = ['pdf', 'jpg', 'jpeg', 'png'];

/**
 * Create a new batch uploader instance.
 *
 * @param {Object} options
 * @param {string} [options.tripId] - Trip ID to associate
 * @param {string} [options.type] - Invoice type hint
 * @param {string} [options.category] - Business category
 */
function createBatchUploader(options) {
  options = options || {};

  /** @type {Array<{path: string, name: string, size: number, state: string, result: Object|null, error: string|null}>} */
  var files = [];
  var tripId = options.tripId || '';
  var type = options.type || '';
  var category = options.category || '';

  /**
   * Get file extension in lowercase.
   */
  function getExt(name) {
    if (!name) return '';
    var parts = String(name).split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  /**
   * Add files to the queue. Deduplicates by (path + size).
   * Files with unsupported extensions are marked as failed immediately.
   *
   * @param {Array<{path: string, name: string, size: number}>} filePaths
   * @returns {number} Number of files actually added
   */
  function addFiles(filePaths) {
    if (!filePaths || !filePaths.length) return 0;

    var added = 0;
    var seen = {};
    // Build lookup of existing files
    for (var i = 0; i < files.length; i++) {
      var key = files[i].path + '|' + files[i].size;
      seen[key] = true;
    }

    for (var i = 0; i < filePaths.length; i++) {
      var f = filePaths[i];
      var key = f.path + '|' + f.size;
      var ext = getExt(f.name);

      // Dedup
      if (seen[key]) {
        files.push({
          path: f.path,
          name: f.name || '',
          size: f.size || 0,
          state: 'duplicate',
          result: null,
          error: '重复文件',
        });
        seen[key] = true;
        continue;
      }

      // Extension check
      if (ALLOWED_EXTS.indexOf(ext) < 0) {
        files.push({
          path: f.path,
          name: f.name || '',
          size: f.size || 0,
          state: 'failed',
          result: null,
          error: '不支持的文件类型: .' + ext,
        });
        seen[key] = true;
        continue;
      }

      // Max files check
      var totalAllowed = 0;
      for (var j = 0; j < files.length; j++) {
        if (files[j].state === 'waiting') totalAllowed++;
      }
      if (totalAllowed >= MAX_FILES) {
        // This file exceeds the limit — still track it
        files.push({
          path: f.path,
          name: f.name || '',
          size: f.size || 0,
          state: 'failed',
          result: null,
          error: '超过单次上传上限(' + MAX_FILES + '个)',
        });
        seen[key] = true;
        continue;
      }

      files.push({
        path: f.path,
        name: f.name || '',
        size: f.size || 0,
        state: 'waiting',
        result: null,
        error: null,
      });
      seen[key] = true;
      added++;
    }

    return added;
  }

  /**
   * Start processing the queue — uploads files one by one.
   *
   * @param {Function} onProgress - Callback(report) called after each file completes.
   *   report = { total, completed, failed, duplicated, current, files }
   */
  function start(onProgress) {
    return new Promise(function (resolve, reject) {
      processNext(onProgress, resolve, reject);
    });
  }

  /**
   * Reset all failed files back to waiting state so they can be retried.
   * Also resets done/duplicate states to keep internal counters consistent.
   * Done and duplicate files are NOT reset — only failed ones are retried.
   *
   * @returns {number} Number of files reset to waiting
   */
  function resetFailed() {
    var count = 0;
    for (var i = 0; i < files.length; i++) {
      if (files[i].state === 'failed') {
        files[i].state = 'waiting';
        files[i].error = null;
        count++;
      }
    }
    return count;
  }

  /**
   * Process the next waiting file in the queue.
   */
  function processNext(onProgress, resolve, reject) {
    // Find next waiting file
    var idx = -1;
    for (var i = 0; i < files.length; i++) {
      if (files[i].state === 'waiting') {
        idx = i;
        break;
      }
    }

    // All done — gather results
    if (idx < 0) {
      resolve(getResults());
      return;
    }

    var file = files[idx];
    file.state = 'uploading';
    notifyProgress(onProgress);

    api.invoices.uploadAndCreate(file.path, tripId, type, category)
      .then(function (result) {
        file.state = 'done';
        file.result = result;
        notifyProgress(onProgress);
        processNext(onProgress, resolve, reject);
      })
      .catch(function (err) {
        // Check for duplicate (HTTP 409)
        if (err && err.code === 409) {
          file.state = 'duplicate';
          file.error = '发票已存在';
          file.result = err.data || null;
        } else {
          file.state = 'failed';
          file.error = (err && err.message) || '上传失败';
        }
        notifyProgress(onProgress);
        processNext(onProgress, resolve, reject);
      });
  }

  /**
   * Notify progress callback with current queue status.
   */
  function notifyProgress(onProgress) {
    if (typeof onProgress !== 'function') return;

    var total = files.length;
    var completed = 0;
    var failedCount = 0;
    var duplicateCount = 0;
    var currentFile = null;

    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (f.state === 'done') completed++;
      if (f.state === 'failed') failedCount++;
      if (f.state === 'duplicate') duplicateCount++;
      if (f.state === 'uploading' || f.state === 'ocr' || f.state === 'saving') {
        currentFile = f;
      }
    }

    onProgress({
      total: total,
      completed: completed,
      failed: failedCount,
      duplicated: duplicateCount,
      current: currentFile,
      files: files,
    });
  }

  /**
   * Get final results summary.
   *
   * @returns {{ done: Array, failed: Array, duplicate: Array, summary: { total: number, done: number, failed: number, duplicate: number } }}
   */
  function getResults() {
    var done = [];
    var failed = [];
    var duplicate = [];

    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (f.state === 'done') {
        done.push(f);
      } else if (f.state === 'failed') {
        failed.push(f);
      } else if (f.state === 'duplicate') {
        duplicate.push(f);
      }
    }

    return {
      done: done,
      failed: failed,
      duplicate: duplicate,
      summary: {
        total: files.length,
        done: done.length,
        failed: failed.length,
        duplicate: duplicate.length,
      },
    };
  }

  /**
   * Get current file list for UI rendering.
   */
  function getFiles() {
    return files;
  }

  /**
   * Clear the queue and reset state.
   */
  function clear() {
    files = [];
  }

  return {
    addFiles: addFiles,
    start: start,
    resetFailed: resetFailed,
    getResults: getResults,
    getFiles: getFiles,
    clear: clear,
  };
}

module.exports = {
  createBatchUploader: createBatchUploader,
  MAX_FILES: MAX_FILES,
};
