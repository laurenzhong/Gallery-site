import { defineField, defineType } from "sanity";

export const placeType = defineType({
  name: "place",
  title: "地点",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "名称",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "URL 标识",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: "parent", title: "上级地点", type: "reference", to: [{ type: "place" }] }),
    defineField({ name: "country", title: "国家 / 地区", type: "string" }),
    defineField({ name: "aliases", title: "别名", type: "array", of: [{ type: "string" }] }),
    defineField({ name: "sortOrder", title: "排序", type: "number", initialValue: 100 }),
    defineField({ name: "isVisible", title: "显示在筛选中", type: "boolean", initialValue: true }),
  ],
  orderings: [{ title: "按排序值", name: "sortOrderAsc", by: [{ field: "sortOrder", direction: "asc" }] }],
  preview: { select: { title: "title", parent: "parent.title", country: "country" }, prepare: ({ title, parent, country }) => ({ title, subtitle: [parent, country].filter(Boolean).join(" · ") }) },
});
