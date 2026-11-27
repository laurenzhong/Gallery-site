import { defineArrayMember, defineField, defineType } from "sanity";
import { photoReference, photoReferenceArray } from "./photoReference";

const countItems = (items: unknown[] | undefined) => items?.length ?? 0;

export const homepageLayoutType = defineType({
  name: "homepageLayout",
  title: "首页布局",
  type: "document",
  fieldsets: [
    {
      name: "feature",
      title: "顶部特色卡片",
      options: { collapsible: true, collapsed: false },
    },
    {
      name: "main",
      title: "首页主要模块",
      options: { collapsible: true, collapsed: false },
    },
    {
      name: "plants",
      title: "Harbor 模块",
      options: { collapsible: true, collapsed: false },
    },
  ],
  fields: [
    defineField({
      name: "title",
      title: "名称",
      type: "string",
      initialValue: "首页布局",
      readOnly: true,
    }),
    defineField({
      name: "featureCards",
      title: "特色卡片",
      type: "array",
      fieldset: "feature",
      description:
        "主视觉下方的三张卡片。第一张通常链接到 /photobalcony。未配置的模块会保留自动回退布局。",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({
              name: "title",
              title: "卡片标题",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "photo",
              title: "卡片照片",
              ...photoReference,
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "href",
              title: "可选链接",
              type: "string",
              description: "例如：/photobalcony。不需要跳转时请留空。",
            }),
          ],
          preview: {
            select: {
              title: "title",
              subtitle: "href",
              media: "photo.image",
            },
          },
        }),
      ],
      validation: (Rule) => Rule.max(3).warning("首页当前最多显示三张特色卡片。"),
    }),
    defineField({
      name: "landscapePhotos",
      title: "山野轮播照片",
      ...photoReferenceArray,
      fieldset: "main",
      description: "第一个山野轮播。建议使用 8–24 张照片；留空时使用分类回退内容。",
      validation: (Rule) => Rule.max(24).warning("建议最多 24 张照片。"),
    }),
    defineField({
      name: "quietPhotos",
      title: "静谧方格照片",
      ...photoReferenceArray,
      fieldset: "main",
      description: "山野轮播后的方格模块。建议使用 4–8 张照片；留空时使用方图回退内容。",
      validation: (Rule) => Rule.max(8).warning("建议最多 8 张照片。"),
    }),
    defineField({
      name: "bannerOnePhoto",
      title: "第一张宽幅横图",
      ...photoReference,
      fieldset: "main",
      description: "位于方格模块与城市轮播之间的宽幅横图。",
    }),
    defineField({
      name: "cityPhotos",
      title: "城市轮播照片",
      ...photoReferenceArray,
      fieldset: "main",
      description: "城市轮播。建议使用 8–22 张照片；留空时使用分类回退内容。",
      validation: (Rule) => Rule.max(22).warning("建议最多 22 张照片。"),
    }),
    defineField({
      name: "plantsHeroPhoto",
      title: "Harbor 横幅",
      ...photoReference,
      fieldset: "plants",
      description: "Harbor 模块开头的宽幅横图。",
    }),
    defineField({
      name: "plantsCarouselPhotos",
      title: "Harbor 轮播照片",
      ...photoReferenceArray,
      fieldset: "plants",
      description: "Harbor 轮播。建议使用 8–18 张照片；留空时使用分类回退内容。",
      validation: (Rule) => Rule.max(18).warning("建议最多 18 张照片。"),
    }),
    defineField({
      name: "plantsFeaturePhoto",
      title: "Harbor 特色照片",
      ...photoReference,
      fieldset: "plants",
      description: "Harbor 模块内的单张特色照片，可选。",
    }),
    defineField({
      name: "plantsStackPhotos",
      title: "Harbor 全宽堆叠照片",
      ...photoReferenceArray,
      fieldset: "plants",
      description: "Harbor 模块内的全宽照片堆叠。建议使用 3–6 张照片。",
      validation: (Rule) => Rule.max(8).warning("建议最多 8 张照片。"),
    }),
    defineField({
      name: "plantsSquarePhotos",
      title: "Harbor 方格照片",
      ...photoReferenceArray,
      fieldset: "plants",
      description: "Harbor 模块底部的方格组。建议使用 4–8 张照片。",
      validation: (Rule) => Rule.max(8).warning("建议最多 8 张照片。"),
    }),
  ],
  preview: {
    select: {
      title: "title",
      featureCards: "featureCards",
      landscapePhotos: "landscapePhotos",
      quietPhotos: "quietPhotos",
      cityPhotos: "cityPhotos",
      plantsCarouselPhotos: "plantsCarouselPhotos",
      plantsStackPhotos: "plantsStackPhotos",
      plantsSquarePhotos: "plantsSquarePhotos",
    },
    prepare({
      title,
      featureCards,
      landscapePhotos,
      quietPhotos,
      cityPhotos,
      plantsCarouselPhotos,
      plantsStackPhotos,
      plantsSquarePhotos,
    }) {
      const configuredCount =
        countItems(featureCards) +
        countItems(landscapePhotos) +
        countItems(quietPhotos) +
        countItems(cityPhotos) +
        countItems(plantsCarouselPhotos) +
        countItems(plantsStackPhotos) +
        countItems(plantsSquarePhotos);

      return {
        title: title || "首页布局",
        subtitle: configuredCount
          ? `已在首页模块中选择 ${configuredCount} 张照片`
          : "未配置的模块会使用自动回退布局",
      };
    },
  },
});
