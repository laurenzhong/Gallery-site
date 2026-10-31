import type { StructureResolver } from "sanity/structure";
import { orderableDocumentListDeskItem } from "@sanity/orderable-document-list";
import { PublishingChecklistDashboard } from "./components/PublishingChecklistDashboard";

const photoOrdering = [{ field: "sortOrder", direction: "asc" as const }];
const storyOrdering = [{ field: "orderRank", direction: "asc" as const }];
const categoryOrdering = [{ field: "sortOrder", direction: "asc" as const }];

const photoList = (
  S: Parameters<StructureResolver>[0],
  title: string,
  filter: string,
  params?: Record<string, unknown>,
) => {
  const list = S.documentTypeList("photo").title(title).filter(filter).defaultOrdering(photoOrdering);
  return params ? list.params(params) : list;
};

const storyList = (S: Parameters<StructureResolver>[0], title: string, filter: string) =>
  S.documentTypeList("story").title(title).filter(filter).defaultOrdering(storyOrdering);

const homepageReferenceFilter = `
  _type == "photo" &&
  count(*[_type in ["homepageLayout", "pageLayout"] && references(^._id)]) > 0
`;

const siteHeroReferenceFilter = `
  _type == "photo" &&
  count(*[_type == "siteSettings" && heroPhoto._ref == ^._id]) > 0
`;

const homepageFeatureCardFilter = `
  _type == "photo" &&
  count(*[_type == "homepageLayout" && ^._id in featureCards[].photo._ref]) > 0
`;

const homepageArrayReferenceFilter = (field: string) => `
  _type == "photo" &&
  count(*[_type == "homepageLayout" && ^._id in ${field}[]._ref]) > 0
`;

const homepageSingleReferenceFilter = (field: string) => `
  _type == "photo" &&
  count(*[_type == "homepageLayout" && ${field}._ref == ^._id]) > 0
`;

const photobalconyReferenceFilter = `
  _type == "photo" &&
  count(*[_type == "photobalconyLayout" && references(^._id)]) > 0
`;

const photobalconyArrayReferenceFilter = (field: string) => `
  _type == "photo" &&
  count(*[_type == "photobalconyLayout" && ^._id in ${field}[]._ref]) > 0
`;

const photobalconySingleReferenceFilter = (field: string) => `
  _type == "photo" &&
  count(*[_type == "photobalconyLayout" && ${field}._ref == ^._id]) > 0
`;

const journalCoverFilter = `
  _type == "photo" &&
  count(*[_type == "story" && coverPhoto._ref == ^._id]) > 0
`;

const journalRelatedFilter = `
  _type == "photo" &&
  count(*[_type == "story" && ^._id in relatedPhotos[]._ref]) > 0
`;

const anyPageOrStoryReferenceFilter = `
  count(*[
    _type in ["homepageLayout", "pageLayout", "photobalconyLayout", "siteSettings", "story"] &&
    references(^._id)
  ]) > 0
`;

const photoInboxNeedsSetupFilter = `
  _type == "photo" &&
  (
    !defined(image.asset._ref) ||
    !defined(category._ref) ||
    !defined(slug.current) ||
    !defined(sortOrder) ||
    (
      isHidden != true &&
      !(${anyPageOrStoryReferenceFilter})
    )
  )
`;

const visibleStoryFilter = `
  _type == "story" &&
  isHidden != true &&
  (!defined(publishedAt) || dateTime(publishedAt) <= dateTime(now()))
`;

const hiddenPhotoUsedByVisibleStoriesFilter = `
  _type == "photo" &&
  isHidden == true &&
  count(*[${visibleStoryFilter} && references(^._id)]) > 0
`;

const hiddenPhotoUsedByPhotobalconyFilter = `
  _type == "photo" &&
  isHidden == true &&
  count(*[_type == "photobalconyLayout" && references(^._id)]) > 0
`;

const homepageLayoutEmptyModulesFilter = `
  _type == "homepageLayout" &&
  (
    !defined(featureCards[0]) ||
    !defined(landscapePhotos[0]) ||
    !defined(quietPhotos[0]) ||
    !defined(bannerOnePhoto._ref) ||
    !defined(cityPhotos[0]) ||
    !defined(plantsHeroPhoto._ref) ||
    !defined(plantsCarouselPhotos[0]) ||
    !defined(plantsStackPhotos[0]) ||
    !defined(plantsSquarePhotos[0])
  )
`;

const photobalconyLayoutEmptyModulesFilter = `
  _type == "photobalconyLayout" &&
  (
    !defined(heroPhoto._ref) ||
    !defined(mayPhotos[0]) ||
    !defined(marchPortraitPhotos[0]) ||
    !defined(marchWidePhotos[0]) ||
    !defined(februaryPhotos[0]) ||
    !defined(januaryPhotos[0]) ||
    !defined(winterPhotos[0]) ||
    !defined(summerPhotos[0])
  )
`;

const slugify = (s: string) => {
  const ascii = s.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  if (ascii) return ascii;
  let hash = 0;
  for (let index = 0; index < s.length; index += 1) {
    hash = ((hash << 5) - hash + s.charCodeAt(index)) | 0;
  }
  return `c${(hash >>> 0).toString(36)}`;
};

const categoryPhotoItem = (S: Parameters<StructureResolver>[0], title: string) =>
  S.listItem()
    .id(`category-photos-${slugify(title)}`)
    .title(title)
    .schemaType("photo")
    .child(photoList(S, title, '_type == "photo" && category->title == $category', { category: title }));

const li = (S: Parameters<StructureResolver>[0], id: string) => S.listItem().id(id);

export const structure: StructureResolver = (S, context) =>
  S.list()
    .id("gallery")
    .title("Gallery 内容管理")
    .items([
      li(S, "publishing-checklist")
        .title("发布检查")
        .child(
          S.list()
            .id("publishing-checklist-list")
            .title("发布检查")
            .items([
              li(S, "publishing.overview")
                .title("概览")
                .child(S.component(PublishingChecklistDashboard).id("publishing-checklist-overview").title("概览")),
              li(S, "publishing.hidden-homepage-photos")
                .title("首页在用但已隐藏的照片")
                .schemaType("photo")
                .child(photoList(S, "首页在用但已隐藏的照片", `${homepageReferenceFilter} && isHidden == true`)),
              li(S, "publishing.hidden-photobalcony-photos")
                .title("影像阳台在用但已隐藏的照片")
                .schemaType("photo")
                .child(photoList(S, "影像阳台在用但已隐藏的照片", hiddenPhotoUsedByPhotobalconyFilter)),
              li(S, "publishing.hidden-story-photos")
                .title("可见手记在用但已隐藏的照片")
                .schemaType("photo")
                .child(photoList(S, "可见手记在用但已隐藏的照片", hiddenPhotoUsedByVisibleStoriesFilter)),
              li(S, "publishing.stories-missing-cover")
                .title("缺少封面的可见手记")
                .schemaType("story")
                .child(storyList(S, "缺少封面的可见手记", `${visibleStoryFilter} && !defined(coverPhoto._ref)`)),
              li(S, "publishing.hidden-stories")
                .title("从网站隐藏的手记")
                .schemaType("story")
                .child(storyList(S, "从网站隐藏的手记", '_type == "story" && isHidden == true')),
              li(S, "publishing.photos-missing-image")
                .title("缺少图片资源的照片")
                .schemaType("photo")
                .child(photoList(S, "缺少图片资源的照片", '_type == "photo" && !defined(image.asset._ref)')),
              li(S, "publishing.photos-missing-category")
                .title("缺少分类的照片")
                .schemaType("photo")
                .child(photoList(S, "缺少分类的照片", '_type == "photo" && !defined(category._ref)')),
              li(S, "publishing.photos-missing-alt-text")
                .title("缺少替代文本的照片")
                .schemaType("photo")
                .child(photoList(S, "缺少替代文本的照片", '_type == "photo" && isHidden != true && !defined(altText)')),
              li(S, "publishing.multiple-hero-flags")
                .title("被标记多个主视觉备选的照片")
                .schemaType("photo")
                .child(
                  photoList(
                    S,
                    "被标记多个主视觉备选的照片",
                    '_type == "photo" && isHero == true && count(*[_type == "photo" && isHero == true]) > 1',
                  ),
                ),
              li(S, "publishing.empty-homepage-modules")
                .title("首页布局未配置的模块")
                .schemaType("homepageLayout")
                .child(
                  S.documentTypeList("homepageLayout")
                    .title("首页布局未配置的模块")
                    .filter(homepageLayoutEmptyModulesFilter),
                ),
              li(S, "publishing.empty-photobalcony-modules")
                .title("影像阳台布局未配置的模块")
                .schemaType("photobalconyLayout")
                .child(
                  S.documentTypeList("photobalconyLayout")
                    .title("影像阳台布局未配置的模块")
                    .filter(photobalconyLayoutEmptyModulesFilter),
                ),
            ]),
        ),
      li(S, "content-control")
        .title("页面内容控制")
        .child(
          S.list()
            .id("content-control-list")
            .title("页面内容控制")
            .items([
              li(S, "content-control.site-copy")
                .title("全站文案")
                .schemaType("siteCopy")
                .child(
                  S.document()
                    .schemaType("siteCopy")
                    .documentId("siteCopy-main")
                    .title("全站文案"),
                ),
              li(S, "content-control.home-layout")
                .title("首页通用布局")
                .schemaType("pageLayout")
                .child(
                  S.document()
                    .schemaType("pageLayout")
                    .documentId("pageLayout-home")
                    .title("首页通用布局"),
                ),
              li(S, "content-control.photobalcony-layout")
                .title("影像阳台通用布局")
                .schemaType("pageLayout")
                .child(
                  S.document()
                    .schemaType("pageLayout")
                    .documentId("pageLayout-photobalcony")
                    .title("影像阳台通用布局"),
                ),
              S.divider(),
              li(S, "content-control.page-content-home")
                .title("首页受控内容（新模型）")
                .schemaType("pageContent")
                .child(
                  S.document()
                    .schemaType("pageContent")
                    .documentId("pageContent-home")
                    .title("首页受控内容"),
                ),
              li(S, "content-control.page-content-photobalcony")
                .title("影像阳台受控内容（新模型）")
                .schemaType("pageContent")
                .child(
                  S.document()
                    .schemaType("pageContent")
                    .documentId("pageContent-photobalcony")
                    .title("影像阳台受控内容"),
                ),
            ]),
        ),
      li(S, "photos-inbox")
        .title("照片收件箱")
        .child(
          S.list()
            .id("photos-inbox-list")
            .title("照片收件箱")
            .items([
              li(S, "photos-inbox.needs-setup")
                .title("需要补全信息")
                .schemaType("photo")
                .child(photoList(S, "需要补全信息", photoInboxNeedsSetupFilter)),
              li(S, "photos-inbox.no-image")
                .title("缺少图片资源")
                .schemaType("photo")
                .child(photoList(S, "缺少图片资源", '_type == "photo" && !defined(image.asset._ref)')),
              li(S, "photos-inbox.no-category")
                .title("缺少分类")
                .schemaType("photo")
                .child(photoList(S, "缺少分类", '_type == "photo" && !defined(category._ref)')),
              li(S, "photos-inbox.no-slug")
                .title("缺少 URL 标识")
                .schemaType("photo")
                .child(photoList(S, "缺少 URL 标识", '_type == "photo" && !defined(slug.current)')),
              li(S, "photos-inbox.no-sort-order")
                .title("缺少排序值")
                .schemaType("photo")
                .child(photoList(S, "缺少排序值", '_type == "photo" && !defined(sortOrder)')),
              li(S, "photos-inbox.unplaced-visible")
                .title("可见但尚未被使用")
                .schemaType("photo")
                .child(
                  photoList(
                    S,
                    "可见但尚未被使用",
                    `_type == "photo" && isHidden != true && !(${anyPageOrStoryReferenceFilter})`,
                  ),
                ),
              li(S, "photos-inbox.without-stories")
                .title("未关联手记")
                .schemaType("photo")
                .child(
                  photoList(
                    S,
                    "未关联手记",
                    '_type == "photo" && count(*[_type == "story" && references(^._id)]) == 0',
                  ),
                ),
              li(S, "photos-inbox.recent")
                .title("最近修改")
                .schemaType("photo")
                .child(
                  S.documentTypeList("photo")
                    .title("最近修改")
                    .filter('_type == "photo"')
                    .defaultOrdering([{ field: "_updatedAt", direction: "desc" }]),
                ),
            ]),
        ),
      li(S, "photo-placement")
        .title("照片位置")
        .child(
          S.list()
            .id("photo-placement-list")
            .title("照片位置")
            .items([
              li(S, "photo-placement.all-visible")
                .title("网站中所有可见照片")
                .schemaType("photo")
                .child(photoList(S, "网站中所有可见照片", '_type == "photo" && isHidden != true')),
              li(S, "photo-placement.hidden")
                .title("从网站隐藏的照片")
                .schemaType("photo")
                .child(photoList(S, "从网站隐藏的照片", '_type == "photo" && isHidden == true')),
              S.divider(),
              li(S, "photo-placement.homepage")
                .title("首页")
                .child(
                  S.list()
                    .id("photo-placement-homepage-list")
                    .title("首页")
                    .items([
                      li(S, "photo-placement.homepage.settings")
                        .title("主视觉设置")
                        .schemaType("siteSettings")
                        .child(
                          S.document()
                            .schemaType("siteSettings")
                            .documentId("siteSettings-main")
                            .title("主视觉设置"),
                        ),
                      li(S, "photo-placement.homepage.hero-photo")
                        .title("当前主视觉照片")
                        .schemaType("photo")
                        .child(photoList(S, "当前主视觉照片", siteHeroReferenceFilter)),
                      li(S, "photo-placement.homepage.layout")
                        .title("首页布局编辑器")
                        .schemaType("homepageLayout")
                        .child(
                          S.document()
                            .schemaType("homepageLayout")
                            .documentId("homepageLayout-main")
                            .title("首页布局编辑器"),
                        ),
                      S.divider(),
                      li(S, "photo-placement.homepage.feature-cards")
                        .title("顶部特色卡片")
                        .schemaType("photo")
                        .child(photoList(S, "顶部特色卡片", homepageFeatureCardFilter)),
                      li(S, "photo-placement.homepage.landscape")
                        .title("山野轮播")
                        .schemaType("photo")
                        .child(photoList(S, "山野轮播", homepageArrayReferenceFilter("landscapePhotos"))),
                      li(S, "photo-placement.homepage.quiet")
                        .title("静谧方格")
                        .schemaType("photo")
                        .child(photoList(S, "静谧方格", homepageArrayReferenceFilter("quietPhotos"))),
                      li(S, "photo-placement.homepage.banner-one")
                        .title("第一张宽幅横图")
                        .schemaType("photo")
                        .child(photoList(S, "第一张宽幅横图", homepageSingleReferenceFilter("bannerOnePhoto"))),
                      li(S, "photo-placement.homepage.city")
                        .title("城市轮播")
                        .schemaType("photo")
                        .child(photoList(S, "城市轮播", homepageArrayReferenceFilter("cityPhotos"))),
                      li(S, "photo-placement.homepage.plants-banner")
                        .title("Harbor 横幅")
                        .schemaType("photo")
                        .child(photoList(S, "Harbor 横幅", homepageSingleReferenceFilter("plantsHeroPhoto"))),
                      li(S, "photo-placement.homepage.plants-carousel")
                        .title("Harbor 轮播")
                        .schemaType("photo")
                        .child(photoList(S, "Harbor 轮播", homepageArrayReferenceFilter("plantsCarouselPhotos"))),
                      li(S, "photo-placement.homepage.plants-feature")
                        .title("Harbor 特色图")
                        .schemaType("photo")
                        .child(photoList(S, "Harbor 特色图", homepageSingleReferenceFilter("plantsFeaturePhoto"))),
                      li(S, "photo-placement.homepage.plants-stack")
                        .title("Harbor 全宽堆叠")
                        .schemaType("photo")
                        .child(photoList(S, "Harbor 全宽堆叠", homepageArrayReferenceFilter("plantsStackPhotos"))),
                      li(S, "photo-placement.homepage.plants-squares")
                        .title("Harbor 方格组")
                        .schemaType("photo")
                        .child(photoList(S, "Harbor 方格组", homepageArrayReferenceFilter("plantsSquarePhotos"))),
                    ]),
                ),
              li(S, "photo-placement.photobalcony")
                .title("影像阳台")
                .child(
                  S.list()
                    .id("photo-placement-photobalcony-list")
                    .title("影像阳台")
                    .items([
                      li(S, "photo-placement.photobalcony.layout")
                        .title("影像阳台布局编辑器")
                        .schemaType("photobalconyLayout")
                        .child(
                          S.document()
                            .schemaType("photobalconyLayout")
                            .documentId("photobalconyLayout-main")
                            .title("影像阳台布局编辑器"),
                        ),
                      S.divider(),
                      li(S, "photo-placement.photobalcony.all")
                        .title("影像阳台全部照片")
                        .schemaType("photo")
                        .child(photoList(S, "影像阳台全部照片", photobalconyReferenceFilter)),
                      li(S, "photo-placement.photobalcony.hero")
                        .title("主视觉")
                        .schemaType("photo")
                        .child(photoList(S, "影像阳台主视觉", photobalconySingleReferenceFilter("heroPhoto"))),
                      li(S, "photo-placement.photobalcony.may")
                        .title("第一组轮播")
                        .schemaType("photo")
                        .child(photoList(S, "第一组轮播", photobalconyArrayReferenceFilter("mayPhotos"))),
                      li(S, "photo-placement.photobalcony.march-portraits")
                        .title("第二组竖幅照片行")
                        .schemaType("photo")
                        .child(
                          photoList(
                            S,
                            "第二组竖幅照片行",
                            photobalconyArrayReferenceFilter("marchPortraitPhotos"),
                          ),
                        ),
                      li(S, "photo-placement.photobalcony.march-wide")
                        .title("第二组宽幅轮播")
                        .schemaType("photo")
                        .child(photoList(S, "第二组宽幅轮播", photobalconyArrayReferenceFilter("marchWidePhotos"))),
                      li(S, "photo-placement.photobalcony.february")
                        .title("第三组轮播")
                        .schemaType("photo")
                        .child(photoList(S, "第三组轮播", photobalconyArrayReferenceFilter("februaryPhotos"))),
                      li(S, "photo-placement.photobalcony.january")
                        .title("第四组网格")
                        .schemaType("photo")
                        .child(photoList(S, "第四组网格", photobalconyArrayReferenceFilter("januaryPhotos"))),
                      li(S, "photo-placement.photobalcony.winter")
                        .title("第五组网格")
                        .schemaType("photo")
                        .child(photoList(S, "第五组网格", photobalconyArrayReferenceFilter("winterPhotos"))),
                      li(S, "photo-placement.photobalcony.summer")
                        .title("第六组堆叠")
                        .schemaType("photo")
                        .child(photoList(S, "第六组堆叠", photobalconyArrayReferenceFilter("summerPhotos"))),
                    ]),
                ),
              li(S, "photo-placement.journal")
                .title("日志")
                .child(
                  S.list()
                    .id("photo-placement-journal-list")
                    .title("日志")
                    .items([
                      li(S, "photo-placement.journal.cover")
                        .title("手记封面照片")
                        .schemaType("photo")
                        .child(photoList(S, "手记封面照片", journalCoverFilter)),
                      li(S, "photo-placement.journal.related")
                        .title("手记关联照片")
                        .schemaType("photo")
                        .child(photoList(S, "手记关联照片", journalRelatedFilter)),
                      li(S, "photo-placement.journal.no-story")
                        .title("未关联手记的照片")
                        .schemaType("photo")
                        .child(
                          photoList(
                            S,
                            "未关联手记的照片",
                            '_type == "photo" && count(*[_type == "story" && references(^._id)]) == 0',
                          ),
                        ),
                    ]),
                ),
            ]),
        ),
      li(S, "homepage")
        .title("首页")
        .child(
          S.list()
            .id("homepage-list")
            .title("首页")
            .items([
              li(S, "homepage.layout")
                .title("首页布局")
                .schemaType("homepageLayout")
                .child(
                  S.document()
                    .schemaType("homepageLayout")
                    .documentId("homepageLayout-main")
                    .title("首页布局"),
                ),
              li(S, "homepage.site-settings")
                .title("站点设置 / 主视觉")
                .schemaType("siteSettings")
                .child(S.document().schemaType("siteSettings").documentId("siteSettings-main").title("站点设置 / 主视觉")),
              li(S, "homepage.hero-flagged")
                .title("主视觉备选标记的照片")
                .schemaType("photo")
                .child(photoList(S, "主视觉备选标记的照片", '_type == "photo" && isHero == true')),
              li(S, "homepage.visible")
                .title("首页可见照片")
                .schemaType("photo")
                .child(photoList(S, "首页可见照片", '_type == "photo" && isHidden != true')),
              li(S, "homepage.hidden")
                .title("首页隐藏照片")
                .schemaType("photo")
                .child(photoList(S, "首页隐藏照片", '_type == "photo" && isHidden == true')),
            ]),
        ),
      li(S, "homepage-sections")
        .title("首页模块")
        .child(
          S.list()
            .id("homepage-sections-list")
            .title("首页模块")
            .items([
              li(S, "homepage-sections.all-categories")
                .title("全部分类")
                .schemaType("category")
                .child(S.documentTypeList("category").title("全部分类").defaultOrdering(categoryOrdering)),
              S.divider(),
              categoryPhotoItem(S, "山野"),
              categoryPhotoItem(S, "建筑"),
              categoryPhotoItem(S, "日出日落"),
              categoryPhotoItem(S, "森林"),
              categoryPhotoItem(S, "河流"),
              categoryPhotoItem(S, "海洋"),
              categoryPhotoItem(S, "石塘度假区"),
              categoryPhotoItem(S, "花朵"),
            ]),
        ),
      li(S, "journal")
        .title("日志")
        .child(
          S.list()
            .id("journal-list")
            .title("日志")
            .items([
              orderableDocumentListDeskItem({
                type: "story",
                id: "journal.all-stories",
                title: "全部手记",
                S,
                context,
              }),
              li(S, "journal.stories-missing-cover")
                .title("缺少封面的手记")
                .schemaType("story")
                .child(storyList(S, "缺少封面的手记", '_type == "story" && !defined(coverPhoto._ref)')),
              li(S, "journal.photos-with-stories")
                .title("已关联手记的照片")
                .schemaType("photo")
                .child(
                  photoList(
                    S,
                    "已关联手记的照片",
                    '_type == "photo" && count(*[_type == "story" && references(^._id)]) > 0',
                  ),
                ),
              li(S, "journal.photos-without-stories")
                .title("未关联手记的照片")
                .schemaType("photo")
                .child(
                  photoList(
                    S,
                    "未关联手记的照片",
                    '_type == "photo" && count(*[_type == "story" && references(^._id)]) == 0',
                  ),
                ),
            ]),
        ),
      li(S, "photo-safety")
        .title("照片安全检查")
        .child(
          S.list()
            .id("photo-safety-list")
            .title("照片安全检查")
            .items([
              li(S, "photo-safety.all-photos")
                .title("全部照片")
                .schemaType("photo")
                .child(S.documentTypeList("photo").title("全部照片").defaultOrdering(photoOrdering)),
              li(S, "photo-safety.visible-photos")
                .title("可见的照片")
                .schemaType("photo")
                .child(photoList(S, "可见的照片", '_type == "photo" && isHidden != true')),
              li(S, "photo-safety.hidden-photos")
                .title("已隐藏的照片")
                .schemaType("photo")
                .child(photoList(S, "已隐藏的照片", '_type == "photo" && isHidden == true')),
              li(S, "photo-safety.photos-referenced-by-stories")
                .title("被手记引用的照片")
                .schemaType("photo")
                .child(
                  photoList(
                    S,
                    "被手记引用的照片",
                    '_type == "photo" && count(*[_type == "story" && references(^._id)]) > 0',
                  ),
                ),
              li(S, "photo-safety.photos-referenced-by-homepage")
                .title("在首页中使用的照片")
                .schemaType("photo")
                .child(photoList(S, "在首页中使用的照片", homepageReferenceFilter)),
              li(S, "photo-safety.hidden-homepage-photos")
                .title("首页在用但已隐藏的照片")
                .schemaType("photo")
                .child(photoList(S, "首页在用但已隐藏的照片", `${homepageReferenceFilter} && isHidden == true`)),
            ]),
        ),
    ]);
