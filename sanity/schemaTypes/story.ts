import { defineArrayMember, defineField, defineType } from "sanity";
import { orderRankField, orderRankOrdering } from "@sanity/orderable-document-list";

export const storyType = defineType({
  name: "story",
  title: "手记",
  type: "document",
  fieldsets: [
    {
      name: "identity",
      title: "手记信息",
      options: { collapsible: true, collapsed: false },
    },
    {
      name: "cover",
      title: "封面与关联照片",
      options: { collapsible: true, collapsed: false },
    },
    {
      name: "body",
      title: "正文",
      options: { collapsible: true, collapsed: false },
    },
    {
      name: "safety",
      title: "显示设置",
      options: { collapsible: true, collapsed: true },
    },
    {
      name: "ai",
      title: "AI 生成信息",
      options: { collapsible: true, collapsed: true },
    },
  ],
  fields: [
    orderRankField({ type: "story", newItemPosition: "before" }),
    defineField({
      name: "title",
      title: "标题",
      type: "string",
      fieldset: "identity",
      description: "手记的主标题，同时用于生成 URL 标识。",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "URL 标识",
      type: "slug",
      fieldset: "identity",
      options: { source: "title", maxLength: 96 },
      description:
        "用于 /journal/<slug> 的 URL 地址段。当前前端同时支持使用此标识，以及根据封面照片文件名推导出的回退值。",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "publishedAt",
      title: "发布时间",
      type: "datetime",
      fieldset: "identity",
      description:
        "用于 /journal 的排序与站点地图 lastmod。设置为未来时间时，手记会在该时间之前从列表中隐藏。",
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: "isPinned",
      title: "Pin to top",
      type: "boolean",
      fieldset: "identity",
      initialValue: false,
      description: "When enabled, this story appears before non-pinned stories in /journal.",
    }),
    defineField({
      name: "pinOrder",
      title: "Pin order",
      type: "number",
      fieldset: "identity",
      initialValue: 100,
      hidden: ({ parent }) => parent?.isPinned !== true,
      description: "When multiple stories are pinned, smaller numbers appear first.",
    }),
    defineField({
      name: "excerpt",
      title: "摘要",
      type: "text",
      rows: 3,
      fieldset: "identity",
      description: "在 /journal 卡片以及灯箱入口中显示的简短简介，建议控制在 140 字以内。",
    }),
    defineField({
      name: "coverPhoto",
      title: "封面照片",
      type: "reference",
      to: [{ type: "photo" }],
      fieldset: "cover",
      description:
        "在 /journal 中作为主图以及手记页的头图。公开手记必须设置封面照片。",
      options: { disableNew: true },
      validation: (Rule) => Rule.required().error("公开手记必须设置封面照片。"),
    }),
    defineField({
      name: "relatedPhotos",
      title: "关联照片",
      type: "array",
      fieldset: "cover",
      of: [
        defineArrayMember({
          type: "reference",
          to: [{ type: "photo" }],
          options: { disableNew: true },
        }),
      ],
      description: "可选的相册，会出现在手记底部。已被隐藏的照片被引用时仍会显示在这里。",
    }),
    defineField({
      name: "body",
      title: "正文",
      type: "array",
      fieldset: "body",
      of: [
        defineArrayMember({ type: "block" }),
        defineArrayMember({
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "替代文本",
              type: "string",
              description: "图片内嵌于手记正文中时，建议填写以满足无障碍要求。",
            }),
          ],
        }),
      ],
      description: "富文本正文。行内图片直接在这里上传，不必另外建立照片文档。",
    }),
    defineField({
      name: "isHidden",
      title: "从网站隐藏",
      type: "boolean",
      fieldset: "safety",
      initialValue: false,
      description: "在不删除文档的前提下，让此手记从 /journal、站点地图以及所有交叉引用中隐藏。",
    }),
    defineField({ name: "aiGenerated", title: "AI 生成", type: "boolean", fieldset: "ai", readOnly: true }),
    defineField({ name: "aiModel", title: "AI 模型", type: "string", fieldset: "ai", readOnly: true }),
    defineField({ name: "aiPrompt", title: "生成提示词", type: "text", rows: 4, fieldset: "ai", readOnly: true }),
    defineField({ name: "sourcePhoto", title: "来源照片", type: "reference", to: [{ type: "photo" }], fieldset: "ai", readOnly: true }),
  ],
  orderings: [
    orderRankOrdering,
    {
      title: "最新优先",
      name: "publishedAtDesc",
      by: [
        { field: "isHidden", direction: "asc" },
        { field: "isPinned", direction: "desc" },
        { field: "pinOrder", direction: "asc" },
        { field: "publishedAt", direction: "desc" },
      ],
    },
    {
      title: "标题 A-Z",
      name: "titleAsc",
      by: [{ field: "title", direction: "asc" }],
    },
  ],
  preview: {
    select: {
      title: "title",
      excerpt: "excerpt",
      publishedAt: "publishedAt",
      pinned: "isPinned",
      pinOrder: "pinOrder",
      hidden: "isHidden",
      coverImage: "coverPhoto.image",
    },
    prepare({ title, excerpt, publishedAt, pinned, pinOrder, hidden, coverImage }) {
      const dateLabel = publishedAt ? new Date(publishedAt).toISOString().slice(0, 10) : "未设置日期";
      const status = hidden ? "已隐藏" : "正常显示";
      const pinnedLabel = pinned ? `置顶 ${pinOrder ?? 100}` : null;
      const excerptLabel = excerpt ? `"${excerpt.slice(0, 60)}${excerpt.length > 60 ? "…" : ""}"` : null;

      return {
        title,
        subtitle: [dateLabel, pinnedLabel, status, excerptLabel].filter(Boolean).join(" / "),
        media: coverImage,
      };
    },
  },
});
