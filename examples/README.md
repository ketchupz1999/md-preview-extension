# Markdown 示例

> 标题、表格、代码与图表，让本地文档清晰易读。

## 排版与导航

用大纲跳转章节，在「文件」中切换文档。阅读区域随浏览器窗口和缩放调整，保留文件原有的目录组织方式。

**文字、代码和图表可以放在同一份文档里。** 无需导出网页，也不需要上传内容。

## 表格与代码

| 接口 | 请求体 | 说明 |
| --- | --- | --- |
| Documents/ListRecentFiles | `{"page":1,"pageSize":20}` | 返回最近的文档列表，按修改时间排序。 |
| Documents/GetFileDetails | `{"fileId":"guide.md"}` | 返回文件名、类型和大小。 |
| Documents/GetReadingPosition | `{"fileId":"guide.md"}` | 恢复这份文档上次的阅读位置。 |

```javascript
const document = {
  title: 'Getting started',
  format: 'markdown',
  tags: ['notes', 'guide'],
};
```

## 任务列表

- [x] 整理项目说明
- [x] 添加使用示例
- [ ] 补充常见问题

## 本地文件与链接

打开[离线与隐私](notes/离线与隐私.md)、[图表与时序](notes/图表与时序.md)或 [HTML 示例](preview.html)。

文件网址模式按本机路径解析相对链接；手动选择文件夹时，引用限制在所选文件夹内。源文件保持只读。
