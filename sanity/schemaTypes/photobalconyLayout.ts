import { defineArrayMember, defineField, defineType } from "sanity";

const photoReference = defineArrayMember({
  type: "reference",
  to: [{ type: "photo" }],
  options: {
    disableNew: true,
  },
});

const countItems = (items: unknown[] | undefined) => items?.length ?? 0;

export const photobalconyLayoutType = defineType({
  name: "photobalconyLayout",
  title: "影像阳台布局",
  type: "document",
  fieldsets: [
    {
      name: "hero",
      title: "主视觉",
      options: { collapsible: true, collapsed: false },
    },
    {
      name: "spring",
      title: "春季模块",
      options: { collapsible: true, collapsed: false },
    },
    {
      name: "winter",
      title: "冬季模块",
      options: { collapsible: true, collapsed: false },
    },
    {
      name: "summer",
      title: "夏季模块",
      options: { collapsible: true, collapsed: false },
    },
  ],
  fields: [
    defineField({
      name: "title",
      title: "名称",
      type: "string",
      initialValue: "影像阳台布局",
      readOnly: true,
    }),
    defineField({
      name: "heroPhoto",
      title: "主视觉照片",
      type: "reference",
      fieldset: "hero",
      to: [{ type: "photo" }],
      options: { disableNew: true },
      description: "/photobalcony 顶部的全宽图片。",
    }),
    defineField({
      name: "mayTitle",
      title: "第一组模块标题",
      type: "string",
      fieldset: "spring",
      initialValue: "2026",
      description: "显示在第一组轮播上方的标题。",
    }),
    defineField({
      name: "mayPhotos",
      title: "第一组轮播照片",
      type: "array",
      fieldset: "spring",
      of: [photoReference],
      description: "位于第一组标题下方的主轮播。",
      validation: (Rule) => Rule.max(12).warning("建议最多 12 张照片。"),
    }),
    defineField({
      name: "marchTitle",
      title: "第二组模块标题",
      type: "string",
      fieldset: "spring",
      initialValue: "Jul 2026",
      description: "同时显示在竖幅照片行和后方宽幅轮播上方。",
    }),
    defineField({
      name: "marchPortraitPhotos",
      title: "第二组竖幅照片行",
      type: "array",
      fieldset: "spring",
      of: [photoReference],
      description: "位于第二组标题下方的横向竖幅照片行。",
      validation: (Rule) => Rule.max(12).warning("建议最多 12 张照片。"),
    }),
    defineField({
      name: "marchWidePhotos",
      title: "第二组宽幅轮播",
      type: "array",
      fieldset: "spring",
      of: [photoReference],
      description: "位于第二组竖幅照片行之后的宽幅轮播。",
      validation: (Rule) => Rule.max(12).warning("建议最多 12 张照片。"),
    }),
    defineField({
      name: "februaryTitle",
      title: "第三组模块标题",
      type: "string",
      fieldset: "winter",
      initialValue: "May - Jun 2026",
      description: "显示在 2 月轮播上方的标题。",
    }),
    defineField({
      name: "februaryPhotos",
      title: "第三组轮播照片",
      type: "array",
      fieldset: "winter",
      of: [photoReference],
      description: "位于第三组标题下方的轮播。",
      validation: (Rule) => Rule.max(12).warning("建议最多 12 张照片。"),
    }),
    defineField({
      name: "januaryTitle",
      title: "第四组模块标题",
      type: "string",
      fieldset: "winter",
      initialValue: "Apr 2026",
      description: "显示在 1 月网格上方的标题。",
    }),
    defineField({
      name: "januaryPhotos",
      title: "第四组网格照片",
      type: "array",
      fieldset: "winter",
      of: [photoReference],
      description: "位于第四组标题下方的网格。",
      validation: (Rule) => Rule.max(12).warning("建议最多 12 张照片。"),
    }),
    defineField({
      name: "winterTitle",
      title: "冬季模块标题",
      type: "string",
      fieldset: "winter",
      initialValue: "Mar 2026",
      description: "显示在宽幅网格上方的标题。",
    }),
    defineField({
      name: "winterPhotos",
      title: "第五组网格照片",
      type: "array",
      fieldset: "winter",
      of: [photoReference],
      description: "位于第五组标题下方的宽幅网格。",
      validation: (Rule) => Rule.max(12).warning("建议最多 12 张照片。"),
    }),
    defineField({
      name: "summerTitle",
      title: "夏季模块标题",
      type: "string",
      fieldset: "summer",
      initialValue: "Jan - Feb 2026",
      description: "显示在底部最终堆叠图上方的标题。",
    }),
    defineField({
      name: "summerPhotos",
      title: "第六组堆叠照片",
      type: "array",
      fieldset: "summer",
      of: [photoReference],
      description: "/photobalcony 底部的最终纵向堆叠。",
      validation: (Rule) => Rule.max(12).warning("建议最多 12 张照片。"),
    }),
  ],
  preview: {
    select: {
      title: "title",
      heroTitle: "heroPhoto.title",
      heroImage: "heroPhoto.image",
      mayPhotos: "mayPhotos",
      marchPortraitPhotos: "marchPortraitPhotos",
      marchWidePhotos: "marchWidePhotos",
      februaryPhotos: "februaryPhotos",
      januaryPhotos: "januaryPhotos",
      winterPhotos: "winterPhotos",
      summerPhotos: "summerPhotos",
    },
    prepare({
      title,
      heroTitle,
      heroImage,
      mayPhotos,
      marchPortraitPhotos,
      marchWidePhotos,
      februaryPhotos,
      januaryPhotos,
      winterPhotos,
      summerPhotos,
    }) {
      const configuredCount =
        countItems(mayPhotos) +
        countItems(marchPortraitPhotos) +
        countItems(marchWidePhotos) +
        countItems(februaryPhotos) +
        countItems(januaryPhotos) +
        countItems(winterPhotos) +
        countItems(summerPhotos);

      return {
        title: title || "影像阳台布局",
        subtitle: heroTitle
          ? `主视觉：${heroTitle} / 模块照片 ${configuredCount} 张`
          : `模块照片 ${configuredCount} 张`,
        media: heroImage,
      };
    },
  },
});
