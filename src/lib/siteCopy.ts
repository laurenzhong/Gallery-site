export type SiteCopy = {
  navigation: {
    home: string;
    photography: string;
    balcony: string;
    journal: string;
    about: string;
    photoNotes: string;
  };
  pages: {
    photography: string;
    loading: string;
    notFound: string;
    backHome: string;
    returnToArchive: string;
    photoNotesKicker: string;
    photoNotesTitle: string;
    photostoryAboutTitle: string;
    photostoryMetadataTitle: string;
    photostoryMetadataDescription: string;
    photostoryJournalTitle: string;
    photostoryJournalDescription: string;
    previewBannerTag: string;
    previewBannerText: string;
    footerPreviewKicker: string;
    footerPreviewTitle: string;
  };
  sections: {
    featured: string;
    photographyArchive: string;
    categories: string;
    harbor: string;
    about: string;
    explore: string;
    contactDetails: string;
    follow: string;
    photoDetails: string;
    stories: string;
    journalNote: string;
    aboutPhotographer: string;
    gear: string;
    contact: string;
    metadata: string;
    relatedPhoto: string;
    landscape: string;
    quiet: string;
    city: string;
  };
  controls: {
    openMenu: string;
    closeMenu: string;
    backToTop: string;
    previous: string;
    next: string;
    openPhoto: string;
    closePhoto: string;
    selectPhoto: string;
    copyLink: string;
    copied: string;
    slideshow: string;
    openStories: string;
    readFieldNotes: string;
  };
  metadata: {
    date: string;
    location: string;
    camera: string;
    lens: string;
    aperture: string;
    shutter: string;
    iso: string;
    focalLength: string;
  };
  footer: {
    basedIn: string;
    builtWith: string;
    tagline: string;
    aboutText: string;
    top: string;
    copyright: string;
  };
};

export const defaultSiteCopy: SiteCopy = {
  navigation: {
    home: "Home",
    photography: "Photography",
    balcony: "Balcony View",
    journal: "Journal",
    about: "About",
    photoNotes: "Photo Notes",
  },
  pages: {
    photography: "Photography",
    loading: "Loading this entry.",
    notFound: "This entry is not available.",
    backHome: "Back to Queenstown.top",
    returnToArchive: "Return to the photography archive",
    photoNotesKicker: "Photo Notes",
    photoNotesTitle: "Field notes behind selected photographs.",
    photostoryAboutTitle: "关于摄影师",
    photostoryMetadataTitle: "照片参数",
    photostoryMetadataDescription: "点击任意照片可以查看完整的 EXIF 信息——拍摄日期、地点、器材和参数。",
    photostoryJournalTitle: "创作手记",
    photostoryJournalDescription: "每张照片背后都有当时的场景、天气、心情。下面是几篇示例。",
    previewBannerTag: "测试模块",
    previewBannerText: "这是一个内容侧功能的预览版,用于评估效果。所有文字和参数都是基于现有照片的填充示例,可以稍后替换成真实内容或删除。访问 /photostory 查看。",
    footerPreviewKicker: "Design study",
    footerPreviewTitle: "Footer Background",
  },
  sections: {
    featured: "Featured photography groups",
    photographyArchive: "Photography archive",
    categories: "Photo categories",
    harbor: "Harbor",
    about: "About",
    explore: "Explore",
    contact: "Contact",
    follow: "Follow",
    photoDetails: "Photo details",
    stories: "Stories",
    journalNote: "Journal Note",
    aboutPhotographer: "关于摄影师",
    gear: "器材",
    contactDetails: "联系",
    metadata: "Metadata",
    relatedPhoto: "Related Photo",
    landscape: "Landscape",
    quiet: "Quiet moments",
    city: "City",
  },
  controls: {
    openMenu: "Open menu",
    closeMenu: "Close menu",
    backToTop: "Back to top",
    previous: "Previous",
    next: "Next",
    openPhoto: "Open photo",
    closePhoto: "Close photo details",
    selectPhoto: "Select photo",
    copyLink: "Copy link",
    copied: "Copied",
    slideshow: "slideshow",
    openStories: "Open photo notes and stories",
    readFieldNotes: "Read locations, camera settings, and field notes behind selected photographs.",
  },
  metadata: {
    date: "Date",
    location: "Location",
    camera: "Camera",
    lens: "Lens",
    aperture: "Aperture",
    shutter: "Shutter",
    iso: "ISO",
    focalLength: "Focal",
  },
  footer: {
    basedIn: "Based in Zhejiang",
    builtWith: "Built with React + Vite",
    tagline: "A quiet photography archive - landscape, harbor light, city edges, and small travel fragments.",
    aboutText:
      "Queenstown.top is a quiet photography archive shaped around landscape, harbor light, city edges, and small travel fragments. The site keeps images large, direct, and close to the rhythm of a visual notebook.",
    top: "Top",
    copyright: "All rights reserved",
  },
};

export function mergeSiteCopy(value?: Partial<SiteCopy>): SiteCopy {
  return {
    ...defaultSiteCopy,
    ...value,
    navigation: { ...defaultSiteCopy.navigation, ...value?.navigation },
    pages: { ...defaultSiteCopy.pages, ...value?.pages },
    sections: { ...defaultSiteCopy.sections, ...value?.sections },
    controls: { ...defaultSiteCopy.controls, ...value?.controls },
    metadata: { ...defaultSiteCopy.metadata, ...value?.metadata },
    footer: { ...defaultSiteCopy.footer, ...value?.footer },
  };
}
