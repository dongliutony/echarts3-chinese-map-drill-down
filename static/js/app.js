/**
 * @author hotsuitor@qq.com
 * @createTime 2018/2/23
 * @version v3.0  2018/4/3
 * @version v3.1  2018/4/10
 * @version v3.3  2018/4/12
 */
//地图容器
var chart = echarts.init(document.getElementById("main"));
chart.showLoading();

loadMap(searchtime);
/**
 * 封装绘制地图函数，month 改变 map重新渲染
 */
function loadMap(searchtime) {
  let mapName = "中国";
  //绘制全国地图
  $.getJSON(chinaJson, function(data) {
    chart.hideLoading();
    mapChina = data;
    let d = []; //临时数据
    for (var i = 0; i < data.features.length; i++) {
      d.push({
        id: data.features[i].id,
        name: data.features[i].properties.name
      });
    }
    $("#select-date").val(searchtime);

    //注册地图
    echarts.registerMap(mapName, data);
    //绘制地图，样式，第一次渲染
    renderMap(mapName, data);

    /**获取省份数据*/
    Promise.all([ajaxRequest(getProvNumberUrl, searchtime)]).then(
      result => {
        let [curMonthResult, lastMonthResult, curMonCompar] = result;
        if (curMonthResult.errcode == 1) {
          /**通过id关联地图上对应位置的数据 */
          d.forEach(function(val) {
            curMonthResult.msg.forEach(function(val2, index) {
              if (val.id === val2.provinceid) {
                customerNum.push({
                  id: val.id,
                  name: val.name,
                  value: val2.num
                });
              }
            });
          });
          if (lastMonthResult) {
            if (lastMonthResult.errcode == 1) {
              customerNum.forEach(function(val) {
                lastMonthResult.msg.forEach(function(val2, index) {
                  if (val.id == val2.provinceid) {
                    linkRelativeRatio.push({
                      id: val.id,
                      name: val.name,
                      value: val.value / val2.num
                    });
                  }
                });
              });
            }
          }
        }
        //获取最大值，并排序
        let maxData = getMaxDataAndSort(customerNum);
        //绘制地图，拿到数据后再渲染一次
        renderMap(mapName, data, customerNum, maxData.maxData);
        getRegionPreMonthRatio(maxData.maxDataId, searchtime);
      },
      error => {
        console.log("拿不到省份数据");
      }
    );
  });
}


//地图单击事件
chart.on("click", function(params) {
  //隐藏右键返回菜单
  $("#contextMenu").hide();
  let tmpObj = {};
  let d = [];
  if (params.name in provinces) {
    //二级直辖市数据渲染
    if (special.indexOf(params.name) >= 0) {
      let postData2 = {
        parentid: "provinceid",
        value: params.data.id
      };
      Promise.all([ajaxRequest(getCityNumberUrl, searchtime, postData2)]).then(
        result => {
          let [curMonthResult, lastMonthData] = result;
          let tmp = [];
          if (curMonthResult.errcode == 1) {
            getAreaNumber(
              params.name,
              curMonthResult.msg[0].cityid,
              searchtime
            );
          }
        },
        error => {
          console.log("请求市级数据失败", e);
        }
      );
    }
    //如果点击的是34个省、市、自治区，绘制选中地区的二级地图
    $.getJSON(provinceJson + provinces[params.name] + ".json", function(
      data
    ) {
      echarts.registerMap(params.name, data);
      for (var i = 0; i < data.features.length; i++) {
        d.push({
          name: data.features[i].properties.name
        });
      }
      renderMap(params.name, d);
      if (params.data.id !== "undifiend") {
        getCityNumber(params.name, params.data.id, searchtime, data);
      }
    });
  } else {
    //显示县级地图
    $.getJSON(cityJson + cityMap[params.name] + ".json", function(
      data
    ) {
      echarts.registerMap(params.name, data);
      let d = [];
      for (var i = 0; i < data.features.length; i++) {
        d.push({
          name: data.features[i].properties.name
        });
      }
      renderMap(params.name, d);
      if (params.data.cityid) {
        let postData3 = {
          parentid: "cityid",
          value: params.data.cityid
        };
        Promise.all([
          ajaxRequest(getAreaNumberUrl, searchtime, postData3)
        ]).then(
          result => {
            let [curMonthResult, lastMonthData] = result;
            let tmp = [];
            if (curMonthResult.errcode == 1) {
              // console.log('204', res.msg[0].cityid, res.msg[0].city)
              //这里传递的城市名有问题“北京市”，渲染地图的名字是“北京”，所以地图名要用原来的名字渲染
              getAreaNumber(params.name, params.data.cityid, searchtime);
            }
          },
          error => {
            console.log("请求市级数据失败", e);
          }
        );
      }
    });
  }
  /**
   * 绑定数据入栈事件
   */
  let n = 1;
  if (special.indexOf(params.seriesName) == -1) {
    n = 2;
  }
  //TODO  2级下钻会有问题
  if (mapStack.length < n) {
    //将上一级地图信息压入mapStack
    mapStack.push({
      mapName: curMap.mapName,
      mapJson: curMap.mapJson,
      colorMax: curMap.colorMax,
      sortData: curMap.sortData,
      titledata: curMap.titledata
    });
    console.log("数据入栈", mapStack);
  }
});

/**
 * 右键直接返回上一级
 */
chart.on("contextmenu", params => {
  goBack();
});
/**
 * 左上角返回按钮
 */
$("#goBack").on("click", function() {
  goBack();
});

/**
 * 封装返回上一级事件
 */
function goBack() {
  //获取上一级地图信息
  let map = mapStack.pop();
  if (!map) {
    console.log("没有入栈数据");
    // alert('已经到达最上一级地图了');
    return;
  }
  echarts.registerMap(map.mapName, map.mapJson);
  sortData = map.sortData;
  titledata = map.titledata;
  renderMap(map.mapName, map.mapJson, map.sortData, map.colorMax);
}

// 图例开关的行为只会触发 legendselectchanged 事件
// chart.on("legendselectchanged", function(params) {
//   console.log('407',params)
//   // 获取点击图例的选中状态
//   var isSelected = params.selected[params.name];
//   // 在控制台中打印 ["客户数量(人)", "客户数环比", "销售额(元)", "销售额环比数据"],
//   console.log((isSelected ? "选中了" : "取消选中了") + "图例" +params.name);
//   switch (params.name) {
//     case "客户数环比":
//       window.location.href =
//         "http://192.168.0.147/echarts/customer/customerRatioMap.html";
//       break;
//     case "销售额(元)":
//       window.location.href =
//         "http://192.168.0.147/echarts/customer/saleDataMap.html";
//       break;
//     case "销售额环比数据":
//       window.location.href =
//         "http://192.168.0.147/echarts/customer/saleRatioMap.html";
//       break;
//     default:
//       break;
//   }
//   // 打印所有图例的状态
//   console.log(params.selected);
// });

$("#cus-num").on("click", function() {
  window.location.href = "#";
  window.event.returnValue = false;
});
$("#cus-percent").on("click", function() {
  window.location.href = baseUrl + "customerRatioMap" + argTmonth;
  window.event.returnValue = false; //不加这个无法跳转
});
$("#sale-count").on("click", function() {
  window.location.href = baseUrl + "saleDataMap" + argTmonth;
  window.event.returnValue = false;
});
$("#sale-percent").on("click", function() {
  window.location.href = baseUrl + "saleRatioMap" + argTmonth;
  window.event.returnValue = false;
});

/**
 *
 * @param {地图标题} map
 * @param {客户数} customerNum
 * @param {地图json数据} mapJson
 * @param {最大颜色值} colorMax
 */
function renderMap(map, mapJson, customerNum, colorMax = 1500) {
  //地图配置参数，参数按顺序渲染
  option = {
    backgroundColor: "#F7EED6", //地图画布背景颜色  "#F7EED6"米黄色  "#efefef"灰色
    title: {
      //地图文本
      text: map,
      subtext: "右键返回上一级",
      left: "center",
      textStyle: {
        color: "#000",
        fontSize: 26,
        fontWeight: "normal",
        fontFamily: "Microsoft YaHei"
      },
      subtextStyle: {
        color: "rgb(55, 75, 113)",
        fontSize: 18,
        fontWeight: "normal",
        fontFamily: "Microsoft YaHei"
      }
    },
    // tooltip: {
    //   padding: 0,
    //   enterable: false,
    //   transitionDuration: 1,
    //   textStyle: {
    //     color: "#000",
    //     decoration: "none"
    //   },
    //   formatter: function(params) {
    //     console.log(params);
    //     let tipHtml = `
    //       <div style="height:360px;width:450px;border-radius:5px;background:#fff;box-shadow:0 0 10px 5px #aaa">
    //          <div style="height:40px;width:100%;border-radius:5px;background:#F8F9F9;border-bottom:1px solid #F0F0F0; text-align: center;">
    //               <span style="line-height:40px;">
    //               ${params.name}
    //               </span>
    //               <span style="color: #111; font-size: 12px;">---表示平均数</span>
    //           <div id="tooltipBarId" style="height:300px;width:100%;border-radius:0 0 5px 0;background:#fff"></div>
    //       </div>
    //       `;
    //     setTimeout(function() {
    //       tooltipCharts(params);
    //     }, 10);
    //     return tipHtml;
    //   }
    // },

    tooltip: {
      //提示框信息
      trigger: "item",
      formatter: "{b}\n{c}人"
    },
    toolbox: {
      //工具box
      show: true,
      orient: "vertical",
      left: "right",
      top: "center",
      right: 20,
      feature: {
        dataView: { readOnly: false },
        restore: {},
        saveAsImage: {}
      },
      iconStyle: {
        normal: {
          color: "#fff"
        }
      }
    },
    //左下角的颜色条
    visualMap: {
      show: true,
      min: 0,
      max: colorMax,
      left: "left",
      top: "bottom",
      text: ["高", "低"], // 文本，默认为数值文本
      calculable: true,
      // seriesIndex: [1],    //会使颜色失效
      color: ["#c05050", "#e5cf0d", "#5ab1ef"], //色阶范围
      dimension: 0
    },
    grid: {
      left: 130,
      top: 100,
      botton: 40,
      width: "20%"
    },
    xAxis: [
      {
        position: "top",
        type: "value",
        boundaryGap: false,
        splitLine: {
          show: false
        },
        axisLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          color: "#ff461f"
        }
      }
    ],
    yAxis: [
      {
        type: "category",
        data: titledata,
        triggerEvent: true,
        axisTick: {
          alignWithLabel: true
        },
        axisLine: {
          show: true,
          lineStyle: {
            show: true,
            color: "#2ec7c9"
          }
        }
      }
    ],
    series: [
      {
        name: map, //上面的下钻用到seriesName绑定下一级，换name绑定
        type: "map",
        map: map,
        roam: false,
        height: "100%",
        zoom: 0.75,
        z: 1,
        label: {
          //地图上的文本标签
          normal: {
            show: true,
            position: "inside", //文本标签显示的位置
            textStyle: {
              color: "#fff", //文本颜色
              fontSize: 14
            },
            formatter: "{b}\n{c}" //文本上显示的值  data:[{name: "地名", value: 数据}],  {b}表示label信息,{c}代表value
          },
          emphasis: {
            show: true,
            position: "inside",
            textStyle: {
              color: "#fff",
              fontSize: 13
            }
          }
        },
        itemStyle: {
          normal: {
            areaColor: "#5ab1ef", //地图块颜色#DCE2F1  浅蓝#2B91B7
            borderColor: "#EBEBE4" //#EBEBE4灰色
          },
          emphasis: {
            areaColor: "rgb(254,153,78)" //s鼠标放上去，地图块高亮显示的颜色
          }
        },
        data: customerNum
      },
      {
        name: map,
        type: "bar",
        z: 4,
        label: {
          normal: {
            show: true
          },
          empahsis: {
            show: true
          }
        },
        itemStyle: {
          emphasis: {
            color: "rgb(254,153,78)"
          }
        },
        data: customerNum
      }
    ],
    // 初始动画的时长，支持回调函数，可以通过每个数据返回不同的 delay 时间实现更戏剧的初始动画效果：
    animationDuration: 1000,
    animationEasing: "cubicOut",
    // 数据更新动画的时长。
    animationDurationUpdate: 1000
  };

  //渲染地图
  chart.setOption(option);
  //保存当前状态数据，用于入栈出栈
  curMap = {
    mapName: map,
    mapJson: mapJson,
    colorMax: colorMax,
    sortData: sortData,
    titledata: titledata
  };
  console.log("curMap", curMap);
}

/**
 * 获取城市数据
 * @param {省份} name
 * @param {省份id} id
 * @param {月份} searchtime
 * @param {地图json数据} data
 */
function getCityNumber(name, id, searchtime, data) {
  let postData2 = {
    parentid: "provinceid",
    value: id
  };
  Promise.all([ajaxRequest(getCityNumberUrl, searchtime, postData2)]).then(
    result => {
      let [curMonthResult, lastMonthResult] = result;
      let tmp = [];
      if (curMonthResult.errcode == 1) {
        citySaleData = [];
        for (let i = 0; i < curMonthResult.msg.length; i++) {
          tmp.push({
            cityid: curMonthResult.msg[i].cityid, //需要加上cityid传递渲染，下一级地图渲染需要用到
            name: curMonthResult.msg[i].city,
            value: curMonthResult.msg[i].num
          });
        }
        if (lastMonthResult) {
          if (lastMonthResult.errcode == 1) {
            customerNum.forEach(function(val) {
              lastMonthResult.msg.forEach(function(val2, index) {
                if (val.id == val2.provinceid) {
                  linkRelativeRatio.push({
                    name: val.name,
                    value: val.value / val2.num
                  });
                }
              });
            });
          }
        }
        let maxData = getMaxDataAndSort(tmp);
        renderMap(name, data, tmp, maxData.maxData);
        getRegionPreMonthRatio(maxData.maxDataId, searchtime);
      }
    },
    error => {
      console.log("请求市级数据失败", e);
    }
  );
}

/**
 * 获取县区数据
 * @param {城市名} cityName
 * @param {城市id} cityId
 * @param {月份}  searchtime
 * @param {地图json数据} data
 */
function getAreaNumber(cityName, cityId, searchtime, data) {
  let postData3 = {
    parentid: "cityid",
    value: cityId
  };
  Promise.all([ajaxRequest(getAreaNumberUrl, searchtime, postData3)]).then(
    result => {
      let [curMonthResult, lastMonthResult] = result;
      let tmp = [];
      if (curMonthResult.errcode == 1) {
        areaSaleData = [];
        for (let i = 0; i < curMonthResult.msg.length; i++) {
          // 返回是一个数组，array({id: 1954, areaid: "440301", area: "深圳市", num: 0})
          tmp.push({
            areaid: curMonthResult.msg[i].areaid,
            name: curMonthResult.msg[i].area,
            value: curMonthResult.msg[i].num
          });
        }
        if (lastMonthResult) {
          if (lastMonthResult.errcode == 1) {
            customerNum.forEach(function(val) {
              lastMonthResult.msg.forEach(function(val2, index) {
                if (val.id == val2.provinceid) {
                  linkRelativeRatio.push({
                    name: val.name,
                    value: val.value / val2.num
                  });
                }
              });
            });
          }
        }
        let maxData = getMaxDataAndSort(tmp);
        renderMap(cityName, data, tmp, maxData.maxData);
        getRegionPreMonthRatio(maxData.maxDataId, searchtime)
      }
    },
    error => {
      console.log("获取县区数据失败", e);
    }
  );
}

let areaList = null;
let vm = new Vue({
  el: "#trend-line",
  data: {
    areaList: areaList,
    modalTitle: [],
    cpModalTitle: [],
    searchtime: searchtime,
    time: 0,
    otime: 0
  },
  methods: {
    setAreaList(data) {
      let $_self = this;
      $_self._data.areaList = data; //这里有个坑，_data
    }
  },
  watch: {
    modalTitle(val, oldVal) {
      let $_self = this;
      if (val.length > oldVal) {
        $_self._data.time++;
        $_self._data.cpModalTitle.push(val);
      } else {
        // $_self._data.time--;
      }
      //TODO 取消不请求数据
      if ($_self._data.time > $_self._data.otime) {
        // getRegionPreMonthRatio(val.slice(-1)[0], "2016");
        getRegionPreMonthRatio(val, $_self._data.searchtime);
      }
      console.log(val, oldVal);
    }
  }
});
/**
 *
 * @param {未排序数据} originData
 * @return {倒序排序的数据} maxData
 */
function getMaxDataAndSort(originData) {
  if (originData == "undefined") {
    return;
  }
  titledata = [];
  sortData = [];
  sortData = originData.sort(numDescSort);
  let maxData = sortData.slice(-1)[0]["value"];
  let maxDataId = sortData.slice(-1)[0]['id'];
  if (!maxDataId) {
    maxDataId = sortData.slice(-1)[0]['cityid'] ? sortData.slice(-1)[0]['cityid'] : sortData.slice(-1)[0]['areaid'];
  }
  for (let i = 0; i < sortData.length; i++) {
    titledata.push(sortData[i].name);
  }
  // areaList = sortData.slice().reverse()
  areaList = [...sortData].reverse();
  console.log(sortData);
  vm.setAreaList(areaList);
  console.log("areaList", areaList);
  return {
    maxDataId,
    maxData
  }
}
/**
 * 按月份筛选数据
 */
$("#select-date").change(function() {
  customerNum = [];
  let selMonth = $(this).val();
  loadMap(selMonth);
});

/**
 * 异步获取地区月份数据
 */
function getRegionPreMonthRatio(region, year) {
  let tmp = [];
  let tmp2 = [];
  let tmpMonth = [];
  let postRegion = {
    region: region,
    year: year
  };
  Promise.all([ajaxRequest(getRegionPreMonthCusUrl, "", postRegion)])
    .then(
      res => {
        console.log(res[0].msg, res);
        let [allMonthResult] = res;
        if (allMonthResult.errcode === 1) {
          console.log(allMonthResult.data);
          for (let i = 0; i < allMonthResult.data.region.length; i++) {
            tmp.push(Math.round(allMonthResult.data.region[i].customer_num));
            tmp2.push(
              Math.round(allMonthResult.data.region[i].averge_customer_num)
            );
            tmpMonth.push(allMonthResult.data.region[i].time);
          }
        }
        console.log("tmpMonth", tmpMonth);
        console.log("tmp", tmp);
        console.log("tmp2", tmp2);
        let option = {
          tooltip: {
            trigger: "axis"
          },
          dataset: {
            source: [tmpMonth, tmp, tmp2]
          }
        };
        modalChart.setOption(option);
        let tmpSession = {
          yearMonth: tmpMonth,
          region: tmp,
          level_region: tmp2
        };
        sessionStorage.setItem(region, JSON.stringify(tmpSession));
        console.log(sessionStorage.getItem(region));
        return [
          allMonthResult.data.region_name,
          allMonthResult.data.level_name,
          option
        ];
      },
      error => {
        console.log("拿不到数据");
      }
    )
    .then(res => {
      console.log("第一个then返回的数据", res);
      if (res) {
        loadLineTrend(res[0], res[1] + '平均');
        modalChart.setOption(res[3]);
      } else {
        vm._data.modalTitle = "没有数据";
        modalChart.clear();
        console.log("返回数据有问题，无法完成数据渲染", res);
      }
    });
}

let modalChart = echarts.init(document.getElementById("line-trend"));
/**
 * 渲染折线图
 * @param {*} region
 * @param {*} upRegion
 */
function loadLineTrend(region, upRegion) {
  // 指定图表的配置项和数据
  let option = {
    title: {
      text: region + "地区月份数据",
      subtext: ""
    },
    tooltip: {
      trigger: "axis"
    },
    dataset: {},
    legend: {
      data: [region, upRegion]
    },
    // toolbox: {
    //   show: true,
    //   right: "10%",
    //   feature: {
    //     dataZoom: {},
    //     dataView: { readOnly: false },
    //     magicType: { type: ["line", "bar"] },
    //     restore: {},
    //     saveAsImage: {}
    //   }
    // },
    xAxis: {
      type: "category",
      boundaryGap: ["10%", "10%"] //X轴两边留白策略
    },
    yAxis: {
      type: "value",
      axisLabel: {
        formatter: "{value}"
      }
    },
    series: [
      {
        name: region,
        type: "line",
        smooth: true,
        label: {
          normal: {
            show: true
          }
        },
        seriesLayoutBy: "row",
        markPoint: {
          data: [
            // { type: "max", name: "最大值" },
            // { type: "min", name: "最小值" }
          ]
        },
        markLine: {
          data: [{ type: "average", name: "平均值" }]
        }
      },
      {
        name: upRegion,
        type: "line",
        smooth: true,
        label: {
          normal: {
            show: true
          }
        },
        seriesLayoutBy: "row",
        markPoint: {
          data: [{ name: "最低", value: "mix" }]
        },
        markLine: {
          data: [{ type: "average", name: "平均值" }]
        }
      }
    ]
  };
  // 使用刚指定的配置项和数据显示图表。
  modalChart.setOption(option);
}
