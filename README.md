# echarts3-chinese-map-drill-down
Echarts3中国地图下钻至县级

v6
v5
v4
Hello from origin/master
local v3
local v2
local v1
预览地址：https://touxing.github.io/echarts3-chinese-map-drill-down/index.html

![map drill down](./static/img/map2.gif)

## 运行项目

### 1.git clone 项目

### 2.在根目录启动一个web服务器访问
使用vscode的同学可以直接用 `Go Live` 插件

## 新增功能

添加mock数据

- [x] 接入本地数据
  - 爬取城市数据不完整，有城市级数据的省份，查看 `mock/city` 目录，山东、河南 有下钻数据
  - [x] 直辖市二级下钻与三级数据入栈判断存在问题

> 地图资源参考: https://github.com/touxing/echarts-geo-json
