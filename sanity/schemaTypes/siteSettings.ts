import { defineArrayMember, defineField, defineType } from "sanity";
import { photoReference } from "./photoReference";

export const siteSettingsType = defineType({
  name: "siteSettings",
  title: "站点设置",
  type: "document",
  fieldsets: [
    {
      name: "identity",
      title: "站点信息",
      options: { collapsible: true, collapsed: false },
    },
    {
      name: "hero",
      title: "首页主视觉",
      options: { collapsible: true, collapsed: false },
    },
    {
      name: "about",
      title: "关于页",
      options: { collapsible: true, collapsed: false },
    },
    {
      name: "social",
      title: "联系方式",
      options: { collapsible: true, collapsed: true },
    },
  ],
  fields: [
    defineField({
      name: "siteTitle",
      title: "网站标题",
      type: "string",
      fieldset: "identity",
      description: "用于浏览器标签页以及首页 <title>，同时作为 Studio 列表中的文档标题。",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "heroPhoto",
      title: "首页主视觉照片",
      ...photoReference,
      fieldset: "hero",
      description:
        "首页首屏显示的主图，优先级高于任何「主视觉备选」标记。引用已被隐藏的照片时会显示校验提示，但仍可保存。",
      validation: (Rule) =>
        Rule.custom(async (value, context) => {
          if (!value?._ref) return true;
          const client = context.getClient({ apiVersion: "2025-02-19" });
          const doc = await client.fetch(`*[_id == $id][0]{ isHidden, title }`, { id: value._ref });
          if (!doc) return "引用的照片已不存在。";
          if (doc.isHidden) {
            return `"${doc.title}" 当前处于隐藏状态。首页会忽略该照片，回退到主视觉备选或默认照片，直到你取消隐藏或重新选择其他照片。`;
          }
          return true;
        }),
    }),
    defineField({
      name: "heroSubtitle",
      title: "主视觉副标题",
      type: "string",
      fieldset: "hero",
      description: "预留的主视觉文案字段。当前首页主视觉仅展示图片，尚未使用此字段。",
    }),
    defineField({
      name: "aboutName",
      title: "关于页作者姓名",
      type: "string",
      fieldset: "about",
      description: "显示在 /about 顶部的姓名。未填写时会回退到静态兜底中的作者名。",
    }),
    defineField({
      name: "aboutLocation",
      title: "关于页地点",
      type: "string",
      fieldset: "about",
      description: "简短的所在地说明，例如「浙江台州 / 上海」。",
    }),
    defineField({
      name: "aboutBio",
      title: "关于页自我介绍",
      type: "array",
      fieldset: "about",
      of: [defineArrayMember({ type: "block" })],
      description: "/about 页的正文，多个段落会按顺序渲染。",
    }),
    defineField({
      name: "aboutImage",
      title: "关于页照片",
      type: "image",
      fieldset: "about",
      description: "为 /about 页上传照片，横图和竖图都可使用。",
      fields: [
        defineField({
          name: "alt",
          title: "替代文字",
          type: "string",
          description: "用一句话描述照片中能看到的内容。",
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: "caption",
          title: "照片图注",
          type: "string",
        }),
      ],
    }),
    defineField({
      name: "gear",
      title: "器材清单",
      type: "array",
      fieldset: "about",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({
              name: "name",
              title: "名称",
              type: "string",
              description: "简短的分类标签，例如「机身」。",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "value",
              title: "内容",
              type: "string",
              description: "对应的器材，例如「Sony A7M4」。",
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: {
            select: { title: "name", subtitle: "value" },
          },
        }),
      ],
      description: "在 /about 页中展示的相机 / 器材列表。",
    }),
    defineField({
      name: "socialLinks",
      title: "社交链接",
      type: "array",
      fieldset: "social",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({
              name: "label",
              title: "名称",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "value",
              title: "显示文本",
              type: "string",
              description: "面向用户的展示文案，例如「@gallery」。",
            }),
            defineField({
              name: "href",
              title: "网址",
              type: "url",
              description: "包含协议头的完整网址。",
              validation: (Rule) =>
                Rule.uri({
                  scheme: ["http", "https", "mailto", "tel"],
                  allowRelative: false,
                }),
            }),
          ],
          preview: {
            select: { title: "label", subtitle: "value" },
          },
        }),
      ],
      description: "在 /about 页以及页脚图标中展示。第一条链接会被视作主要联系方式。",
    }),
  ],
  preview: {
    select: {
      title: "siteTitle",
      heroTitle: "heroPhoto.title",
      heroImage: "heroPhoto.image",
      hiddenHero: "heroPhoto.isHidden",
      subtitle: "heroSubtitle",
    },
    prepare({ title, heroTitle, heroImage, hiddenHero, subtitle }) {
      const heroLabel = heroTitle
        ? hiddenHero
          ? `主视觉：${heroTitle}（已隐藏）`
          : `主视觉：${heroTitle}`
        : "尚未设置主视觉";
      const subtitleParts = [heroLabel, subtitle].filter(Boolean);
      return {
        title: title || "站点设置",
        subtitle: subtitleParts.join(" / "),
        media: heroImage,
      };
    },
  },
});
