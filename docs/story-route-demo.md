# Story route demo

路线叙事页现在由 [`StoryRoutePage`](../src/components/StoryRoutePage.tsx) 统一渲染。每条路线只需要提供一个 `StoryRoute` 配置：轨迹、地图边界、章节站点和照片 ID。

## 新增路线

1. 把 GPX、GeoJSON 或 OSM 轨迹归一化为 `[latitude, longitude]`，生成 `src/data/*Track.ts`。
2. 在 `src/data/routes/` 新建路线配置。
3. 每个章节填写 `trackIndex`，它必须对应完整轨迹中的点索引。
4. 需要额外地图标注时，在 `points` 中增加路线点；它们不会生成完整叙事章节。
5. 用 `photoIds` 绑定照片库中的稳定照片 ID；一个站点或路线点可以绑定多张照片。
6. 在 `App.tsx` 增加一个入口 wrapper，传入 `StoryRoutePage`。

当前提供的 GPX 示例入口是 `/experiments/trail-route-gpx-demo`，轨迹来自用户提供的 `2025-12-31+10+18+12.gpx`，归一化数据在 [`gpxTrailDemoTrack.ts`](../src/data/gpxTrailDemoTrack.ts)，配置在 [`gpxTrailDemo.ts`](../src/data/routes/gpxTrailDemo.ts)。示例会额外显示 12 个细分路线点；示例照片使用现有照片库中的 ID，替换 `photoIds` 即可换成实际路线照片。

## 在 CMS 中维护地图路线

Sanity Studio 的「地图 → 地图路线」支持直接上传 GPX。填写路线名称和 slug，上传 GPX，在「地图标注点」中填写名称、纬度、经度，并通过「关联照片」选择照片。保存并发布后，`/experiments/photo-map` 会自动读取这条路线；关联照片会显示在对应标注点上。照片仍建议在「照片库 → 导入照片」中填写 EXIF GPS 或手动地图坐标。

没有 GPX 时，可以在「手动轨迹点」中录入至少两个坐标。路线设置为「显示在地图上」后才会出现在前端；隐藏或未发布的路线不会被读取。

## 站点数据示例

```ts
{
  id: "ridge-view",
  title: "Ridge view",
  localTitle: "山脊观景点",
  coordinate: [28.953862, 120.850907],
  trackIndex: 1054,
  distanceKm: 5.8,
  time: "15:20",
  elevationM: 886,
  note: "A long climb reaches the upper shoulder.",
  photoIds: ["photo-006", "photo-007"],
}
```
