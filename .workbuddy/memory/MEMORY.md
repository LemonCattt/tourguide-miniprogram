# MEMORY.md — tourguide 项目记忆

## 服务运行信息
- 项目路径: /www/tourguide
- PM2进程: tourguide (port 3000) + tourguide-web (port 3001, combined-server代理到3000)
- tourguide-api (port 3002): **进程已从PM2消失**，原因不明
- API地址: http://moladog.top:3000
- HTTPS外部访问: ❌ SSL握手失败（nginx/防火墙问题）
- Swagger: http://moladog.top:3001/api-docs (通过combined-server)

## 项目结构
项目路径: /www/tourguide | PM2: tourguide | port: 3000

### 已实现模块
- auth: 登录/注册/微信登录 (JWT)
- users: 用户管理
- tours: 行程管理 (Tour实体=行程计划,含name/description/startDate/endDate/destination/budget/status/maxParticipants/leaderId)
- invoices: 发票管理 (Invoice实体,title/amount/type(INCOME|EXPENSE)/category/description/invoiceNo/fileUrl/tourId/creatorId)
- rooms: 分房(Room实体,tourId/roomNo/floor/type/members/isAssigned)
- expenses: 费用记账(Expense实体,tourId/category/amount/payerId/description/receiptUrl/splitInfo)
- notifications: 通知(Notification实体,userId/title/content/type/isRead/relatedId)
- profile: 个人资料管理
- email: 邮箱管理
- reports: 数据报表
- system: 系统管理

### 需要新增/修改的模块(按项目文档)
1. announcements(公告): 新建模块
2. collaboration(团队协作): 新建 teams/members/tasks/comments 子模块
3. itineraries: 当前 tours 模块基本可用,但需确认 itinerary_plans 和 itineraries 表区分
4. 发票需增加: invoice_number, invoice_date, status(pending/used), optimize/batch-use
5. 费用需增加: reimbursement_status, expense_type, participants, currency, split_method
6. 通知需增加: notification_settings 表,更多类型
7. Email: 邮件同步/IMAP/发票识别
8. Admin: 用户管理/数据库管理

### 项目文档重要提示
- itineraries 表排序字段是 order_num(不是order)
- User表需支持 wechatOpenid
- JWT用Bearer Token认证(非Cookie)
- 发票金额优化组合: POST /api/invoices/optimize {targetAmount}
- 公告 attachments 是 JSONB: [{name, url}]
