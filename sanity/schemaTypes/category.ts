import { defineField, defineType } from "sanity";
import { photoReference } from "./photoReference";

export const categoryType = defineType({
  name: "category",
  title: "分类",
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
    defineField({
      name: "description",
      title: "简介",
      type: "text",
      rows: 3,
      description: "显示在栏目卡片上的简短介绍，仅支持纯文本，建议控制在 200 个字符以内。",
    }),
    defineField({
      name: "coverPhoto",
      title: "封面照片",
      ...photoReference,
      description:
        "分类卡片的主图。隐藏照片仍会在这里显示；除非正在准备新栏目，否则请优先使用可见照片。",
    }),
    defineField({
      name: "sortOrder",
      title: "排序",
      type: "number",
      initialValue: 100,
      description: "数值越小，分类在侧栏和首页中的显示位置越靠前。",
    }),
    defineField({
      name: "isVisible",
      title: "显示在网站上",
      type: "boolean",
      initialValue: true,
      description: "关闭后，该分类会从首页和分类导航中隐藏，但不会删除此内容。",
    }),
  ],
  orderings: [
    {
      title: "按排序值",
      name: "sortOrderAsc",
      by: [{ field: "sortOrder", direction: "asc" }],
    },
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "slug.current",
    },
  },
});
