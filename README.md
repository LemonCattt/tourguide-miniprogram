# 领队助手 - 微信小程序

## 项目简介

领队助手是一款专为团队领队打造的微信小程序工具，核心功能包括：

- **📄 发票管理**：上传 PDF 发票自动 OCR 识别，支持发票列表管理
- **🏨 智能分房**：导入 Excel 名单自动分房，支持男女分开和自定义规则
- **🔌 可扩展**：模块化架构，方便后续功能扩展

## 技术栈

- 微信小程序原生框架
- 微信云开发（云函数 + 云数据库 + 云存储）
- WXML + WXSS + JavaScript

## 项目结构

```
├── app.js              # 应用入口
├── app.json            # 应用配置（页面路由、TabBar）
├── app.wxss            # 全局样式
├── project.config.json # 项目配置
├── pages/
│   ├── login/          # 微信一键登录
│   ├── index/          # 首页（功能导航+数据概览）
│   ├── invoice/        # 发票模块
│   │   ├── list/       # 发票列表
│   │   ├── upload/     # 上传发票+OCR识别
│   │   └── detail/     # 发票详情
│   ├── room/           # 分房模块
│   │   ├── list/       # 分房任务列表
│   │   ├── import/     # 导入Excel+分房预览
│   │   └── detail/     # 分房详情
│   └── mine/           # 个人中心
├── components/         # 公共组件（可扩展）
├── utils/              # 工具库
│   ├── api.js          # API 封装（数据库+云函数）
│   ├── auth.js         # 登录认证模块
│   └── util.js         # 通用工具函数
├── cloudfunctions/     # 云函数
│   ├── login/          # 微信登录（获取openid）
│   ├── ocrInvoice/     # 发票OCR识别
│   └── parseExcel/     # Excel解析
└── images/             # 图片资源
```

## 快速开始

### 1. 准备工作

- 注册微信小程序账号（[mp.weixin.qq.com](https://mp.weixin.qq.com)）
- 获取 AppID
- 开通云开发能力

### 2. 配置修改

修改 `project.config.json` 中的 `appid` 字段：
```json
"appid": "你的小程序AppID"
```

修改 `app.js` 中的云开发环境 ID：
```javascript
wx.cloud.init({
  env: '你的云开发环境ID',
  traceUser: true
})
```

### 3. 数据库初始化

在微信云开发控制台中创建以下集合：

#### users 集合（用户表）
```
{
  "_id": "自动生成",
  "openid": "用户OpenID",
  "nickName": "微信用户",
  "avatarUrl": "",
  "createTime": "创建时间",
  "updateTime": "更新时间"
}
```
权限：仅创建者可读写

#### invoices 集合（发票表）
```
{
  "_id": "自动生成",
  "openid": "用户OpenID",
  "fileID": "云存储文件ID",
  "invoiceType": "增值税发票",
  "invoiceCode": "",
  "invoiceNo": "",
  "invoiceDate": "",
  "amount": "发票金额",
  "taxAmount": "税额",
  "companyName": "开票方",
  "taxNo": "纳税人识别号",
  "companyAddress": "",
  "buyerName": "",
  "buyerTaxNo": "",
  "category": "分类",
  "remark": "备注",
  "status": "normal",
  "createTime": "创建时间",
  "updateTime": "更新时间"
}
```
权限：仅创建者可读写

#### room_tasks 集合（分房任务表）
```
{
  "_id": "自动生成",
  "openid": "用户OpenID",
  "title": "任务名称",
  "hotelName": "酒店名称",
  "fileID": "云存储Excel文件ID",
  "rooms": [...],
  "personCount": 0,
  "roomCount": 0,
  "maleCount": 0,
  "femaleCount": 0,
  "status": "completed",
  "createTime": "创建时间",
  "updateTime": "更新时间"
}
```
权限：仅创建者可读写

### 4. 云函数部署

在微信开发者工具中：
1. 右键 `cloudfunctions/login` → 上传并部署
2. 右键 `cloudfunctions/ocrInvoice` → 上传并部署
3. 右键 `cloudfunctions/parseExcel` → 上传并部署（需先执行 `npm install` 安装 xlsx 依赖）

### 5. 开通微信 OCR 能力

在微信公众平台 → 开发 → 开发管理 → 接口设置中，开通「OCR识别」能力（可选，用于发票识别）

### 6. Excel 导入格式说明

上传分房名单时，Excel 文件需包含以下列表头（支持别名）：

| 姓名(必填) | 性别(可选) | 手机(可选) | 备注(可选) |
|-----------|-----------|-----------|-----------|
| 张三       | 男        | 138xxx    | 队长       |
| 李四       | 女        | 139xxx    |            |

支持的表头别名：
- 姓名：`姓名` / `名字` / `人员` / `名称` / `name`
- 性别：`性别` / `gender` / `男女`

### 7. 上传 TabBar 图标

在 `images/tab/` 目录下放置所需的 TabBar 图标（见 README.md）

## 核心特性

### 微信一键登录
- 使用 `wx.login` + 云函数获取 openid
- 自动创建/更新用户信息
- 支持头像昵称同步

### PDF 发票 OCR
- 支持上传 PDF 文件
- 调用微信云 OCR 能力自动识别
- 识别字段：发票类型、代码、号码、日期、金额、税额、开票方、纳税人识别号
- 支持手动补充备注和分类

### Excel 自动分房
- 支持 .xlsx/.xls 格式
- 智能匹配姓名、性别等表头
- 支持男女分开 / 随机分配两种模式
- 支持 2/3/4 人/间的房间配置
- 分房结果可视化预览

### 可扩展架构
- 模块化设计：页面按功能独立拆分
- 工具函数统一封装（api.js / util.js / auth.js）
- 新增功能只需添加 new 页面和对应的云函数

## 后续扩展建议

- [ ] 行程管理模块（行程安排、集合点、时间线）
- [ ] 费用结算模块（AA制计算、费用分摊）
- [ ] 签到打卡模块
- [ ] 公告通知模块
- [ ] 数据导出（PDF/Excel 导出报告）
- [ ] 团队群组协作

## License

MIT
