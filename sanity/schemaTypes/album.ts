import { defineField, defineType } from "sanity";

export const albumType = defineType({
  name: "album",
  title: "相册",
  type: "document",
  fields: [
    defineField({ name: "title", title: "名称", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "slug", title: "URL 标识", type: "slug", options: { source: "title", maxLength: 96 }, validation: (Rule) => Rule.required() }),
    defineField({ name: "description", title: "简介", type: "text", rows: 3, description: "可选。用于说明相册主题或拍摄计划。" }),
    defineField({ name: "coverPhoto", title: "封面照片", type: "reference", to: [{ type: "photo" }], options: { disableNew: true } }),
    defineField({ name: "sortOrder", title: "排序", type: "number", initialValue: 100, description: "数值越小，相册在列表中的位置越靠前。" }),
    defineField({ name: "isVisible", title: "显示在相册列表中", type: "boolean", initialValue: true, description: "关闭后不会从导入选择和相册筛选中显示，但不会删除照片。" }),
  ],
  orderings: [{ title: "按排序值", name: "sortOrderAsc", by: [{ field: "sortOrder", direction: "asc" }] }],
  preview: { select: { title: "title", subtitle: "description", media: "coverPhoto.image" } },
});
