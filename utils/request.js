const { BASE_URL } = require('./config');

function getToken() {
  return wx.getStorageSync('access_token');
}

function getRefreshToken() {
  return wx.getStorageSync('refresh_token');
}

function saveToken(accessToken, refreshToken) {
  wx.setStorageSync('access_token', accessToken);
  if (refreshToken) wx.setStorageSync('refresh_token', refreshToken);
}

function clearToken() {
  wx.removeStorageSync('access_token');
  wx.removeStorageSync('refresh_token');
  wx.removeStorageSync('userInfo');
}

let refreshing = null;

async function doRefreshToken() {
  if (refreshing) return refreshing;
  const rt = getRefreshToken();
  if (!rt) return null;

  refreshing = new Promise((resolve) => {
    wx.request({
      url: BASE_URL + '/auth/refresh',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { refreshToken: rt },
      success: (res) => {
        if (res.statusCode === 200 && res.data.accessToken) {
          saveToken(res.data.accessToken, res.data.refreshToken);
          resolve(res.data.accessToken);
        } else {
          clearToken();
          resolve(null);
        }
      },
      fail: () => {
        clearToken();
        resolve(null);
      }
    });
  });

  refreshing.finally(() => { refreshing = null; });
  return refreshing;
}

function request(options) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    const header = { 'Content-Type': 'application/json' };
    if (token) header['Authorization'] = 'Bearer ' + token;
    if (options.header) Object.assign(header, options.header);

    wx.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data,
      header,
      success: async (res) => {
        if (res.statusCode === 401 && getToken() && !options._retry) {
          const newToken = await doRefreshToken();
          if (newToken) {
            return resolve(request({ ...options, _retry: true }));
          }
          clearToken();
          const pages = getCurrentPages();
          if (pages.length > 0 && pages[pages.length - 1].route !== 'pages/login/login') {
            wx.redirectTo({ url: '/pages/login/login' });
          }
          return reject({ code: 401, message: '登录已过期，请重新登录' });
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const body = res.data;
          resolve(body && body.success !== undefined ? body.data : body);
        } else {
          const msg = (res.data && res.data.message) || '请求失败';
          reject({ code: res.statusCode, message: msg, data: res.data });
        }
      },
      fail: (err) => {
        reject({ code: -1, message: '网络异常，请检查连接', detail: err });
      }
    });
  });
}

function get(options) {
  return request({ ...options, method: 'GET' });
}

function post(options) {
  return request({ ...options, method: 'POST' });
}

function patch(options) {
  return request({ ...options, method: 'PATCH' });
}

function put(options) {
  return request({ ...options, method: 'PUT' });
}

function del(options) {
  return request({ ...options, method: 'DELETE' });
}

function upload(filePath, options = {}) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    const header = {};
    if (token) header['Authorization'] = 'Bearer ' + token;

    // 所有请求走本地后端
    const url = BASE_URL + (options.url || '');

    wx.uploadFile({
      url,
      filePath,
      name: options.name || 'file',
      header,
      formData: options.formData,
      success: (res) => {
        try {
          const body = JSON.parse(res.data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body && body.success !== undefined ? body.data : body);
          } else {
            reject({ code: res.statusCode, message: body.message || '上传失败' });
          }
        } catch (e) {
          reject({ code: -1, message: '解析响应失败' });
        }
      },
      fail: (err) => {
        reject({ code: -1, message: '网络异常', detail: err });
      }
    });
  });
}

const api = {
  auth: {
    wechatLogin: (code) => post({ url: '/auth/wechat-login', data: { code } }),
    refresh: () => doRefreshToken(),
  },
  tours: {
    list: (params) => get({ url: '/tours', data: params }),
    detail: (id) => get({ url: '/tours/' + id }),
    detailWithItems: (id) => get({ url: '/tours/' + id + '/details' }),
    items: (tourId) => get({ url: '/tour-items/tour/' + tourId }),
    create: (data) => post({ url: '/tours', data }),
    update: (id, data) => patch({ url: '/tours/' + id, data }),
    remove: (id) => del({ url: '/tours/' + id }),
  },
  invoices: {
    list: (params) => get({ url: '/invoices', data: params }),
    detail: (id) => get({ url: '/invoices/' + id }),
    create: (data) => post({ url: '/invoices', data }),
    update: (id, data) => patch({ url: '/invoices/' + id, data }),
    remove: (id) => del({ url: '/invoices/' + id }),
    optimize: (data) => post({ url: '/invoices/optimize', data }),
    batchDelete: (ids) => post({ url: '/invoices/batch-delete', data: { ids } }),
    ocrRecognize: (imageUrl, invoiceType) => {
      var data = { imageUrl: imageUrl };
      if (invoiceType) data.invoiceType = invoiceType;
      return post({ url: '/invoices/ocr-recognize', data: data });
    },
    batchCreate: (items) => post({ url: '/invoices/batch-create', data: { items } }),
    /** 一体化上传并创建发票 */
    uploadAndCreate: (filePath, tripId, type, category) => {
      var formData = {};
      if (tripId) formData.tripId = tripId;
      if (type) formData.type = type;
      if (category) formData.category = category;
      return upload(filePath, {
        url: '/invoices/upload-and-create',
        name: 'file',
        formData: formData,
      });
    },
    /** 获取导出数据（含预签名URL） */
    exportData: (ids) => post({ url: '/invoices/export-data', data: { ids: ids.join(',') } }),
  },
  expenses: {
    list: (params) => get({ url: '/expenses', data: params }),
    detail: (id) => get({ url: '/expenses/' + id }),
    create: (data) => post({ url: '/expenses', data }),
    update: (id, data) => patch({ url: '/expenses/' + id, data }),
    remove: (id) => del({ url: '/expenses/' + id }),
    summary: (params) => get({ url: '/expenses/summary', data: params }),
  },
  rooms: {
    schemes: (params) => get({ url: '/rooms/schemes', data: params }),
    schemeDetail: (id) => get({ url: '/rooms/schemes/' + id }),
    createScheme: (data) => post({ url: '/rooms/schemes', data }),
    updateScheme: (id, data) => patch({ url: '/rooms/schemes/' + id, data }),
    deleteScheme: (id) => del({ url: '/rooms/schemes/' + id }),
    guests: (schemeId) => get({ url: '/rooms/schemes/' + schemeId + '/guests' }),
    addGuests: (schemeId, guests) => post({ url: '/rooms/schemes/' + schemeId + '/guests/bulk', data: { guests } }),
    uploadExcel: (schemeId, filePath) => upload(filePath, { url: '/rooms/schemes/' + schemeId + '/import' }),
    updateGuest: (id, data) => patch({ url: '/rooms/guests/' + id, data }),
    deleteGuest: (id) => del({ url: '/rooms/guests/' + id }),
    autoAssign: (schemeId) => post({ url: '/rooms/schemes/' + schemeId + '/auto-assign' }),
    resetAssign: (schemeId) => post({ url: '/rooms/schemes/' + schemeId + '/reset-assign' }),
    getRooms: (schemeId) => get({ url: '/rooms/schemes/' + schemeId + '/rooms' }),
    createRoom: (schemeId, data) => post({ url: '/rooms/schemes/' + schemeId + '/rooms', data }),
    updateRoom: (id, data) => patch({ url: '/rooms/rooms/' + id, data }),
    deleteRoom: (id) => del({ url: '/rooms/' + id }),
    assignGuest: (guestId, roomId) => post({ url: '/rooms/guests/' + guestId + '/assign', data: { roomId } }),
    unassignGuest: (guestId) => post({ url: '/rooms/guests/' + guestId + '/unassign' }),
  },
  reports: {
    overview: () => get({ url: '/reports/overview' }),
    trip: (tripId) => get({ url: '/reports/trip/' + tripId }),
    invoices: () => get({ url: '/reports/invoices' }),
    expenses: (tourId) => get({ url: '/reports/expenses', data: { tourId } }),
    rooms: (tourId) => get({ url: '/reports/rooms', data: { tourId } }),
  },
  announcements: {
    list: (params) => get({ url: '/announcements', data: params }),
    detail: (id) => get({ url: '/announcements/' + id }),
    unreadCount: () => get({ url: '/announcements/unread-count' }),
    create: (data) => post({ url: '/announcements', data }),
    update: (id, data) => patch({ url: '/announcements/' + id, data }),
    remove: (id) => del({ url: '/announcements/' + id }),
    markAsRead: (id) => post({ url: '/announcements/' + id + '/read' }),
  },
  profile: {
    get: () => get({ url: '/auth/profile' }),
    update: (data) => patch({ url: '/profile', data }),
    updatePassword: (data) => patch({ url: '/profile/password', data }),
  },
  upload: {
    file: (filePath, name) => upload(filePath, { url: '/upload', name: name || 'file' }),
  },
};

module.exports = { request, get, post, patch, put, del, upload, api, BASE_URL, saveToken, clearToken, getToken };
