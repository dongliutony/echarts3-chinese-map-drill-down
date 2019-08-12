# echarts3-chinese-map-drill-down
Echarts3中国地图下钻至县级

demo：https://touxing.github.io/echarts3-chinese-map-drill-down/index.html

![map drill down](./static/img/map.gif)

## 更新（2019-5-13）

添加mock数据

- [x] 接入本地数据
  - 爬取城市数据不完整，有城市级数据的省份，查看 `mock/city` 目录，山东、河南 有下钻数据
  - [x] 直辖市二级下钻与三级数据入栈判断存在问题