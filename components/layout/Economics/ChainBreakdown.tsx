"use client";
import Image from "next/image";
import { Icon } from "@iconify/react";
import Heading from "@/components/layout/Heading";
import {
  useMemo,
  useState,
  useEffect,
  useRef,
  ReactNode,
  useCallback,
} from "react";
import { ChainBreakdownResponse } from "@/types/api/EconomicsResponse";
import BreakdownCharts from "@/components/layout/Economics/BreakdownCharts";
import { useLocalStorage } from "usehooks-ts";
import { AllChainsByKeys } from "@/lib/chains";
import { MasterResponse } from "@/types/api/MasterResponse";
import { sortByDataAvailability } from "./SortHelpers";
import { useTransition, animated } from "@react-spring/web";

interface DAvailability {
  icon: string;
  label: string;
}
//prettier-ignore
type MetricSort = "revenue" | "profit" | "chain" | "costs" | "proof_costs" | "da_costs" | "profit_margin" | "size" ;

export default function ChainBreakdown({
  data,
  master,
}: {
  data: ChainBreakdownResponse;
  master: MasterResponse;
}) {
  const [selectedTimespan, setSelectedTimespan] = useState("max");
  const [showUsd, setShowUsd] = useLocalStorage("showUsd", true);
  const [DAIndex, setDAIndex] = useState(0);
  const [metricSort, setMetricSort] = useState<MetricSort>("revenue");
  const [enableDASort, setEnableDASort] = useState(false);
  const [sortOrder, setSortOrder] = useState(true);

  const [openChain, setOpenChain] = useState(() => {
    const initialState = Object.keys(data).reduce((acc, key) => {
      acc[key] = false;
      return acc;
    }, {});
    return initialState;
  });

  function dataAvailToArray(x: string): DAvailability[] {
    let retObject: DAvailability[] = [];
    if (typeof x === "string") {
      // Ensure x is a string
      if (x.includes("calldata")) {
        retObject.push({
          icon: "calldata",
          label: "Calldata",
        });
      }

      if (x.includes("blobs")) {
        retObject.push({
          icon: "blobs",
          label: "Blobs",
        });
      }

      if (x.includes("MantleDA")) {
        retObject.push({
          icon: "customoffchain",
          label: "MantleDA",
        });
      }

      if (x.includes("DAC")) {
        retObject.push({
          icon: "committee",
          label: "DAC (committee)",
        });
      }

      if (x.includes("Celestia")) {
        retObject.push({
          icon: "celestiafp",
          label: "Celestia",
        });
      }

      if (x.includes("memo")) {
        retObject.push({
          icon: "memofp",
          label: "Memo",
        });
      }
    }
    return retObject;
  }

  function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }
  const toggleOpenChain = (key) => {
    setOpenChain((prevState) => ({
      ...prevState,
      [key]: !prevState[key],
    }));
  };

  //Handles opening of each chain section
  const timespans = useMemo(() => {
    return {
      "1d": {
        label: "1d",
        value: 1,
      },
      "7d": {
        label: "7d",
        value: 7,
        xMin: Date.now() - 7 * 24 * 60 * 60 * 1000,
        xMax: Date.now(),
      },
      "30d": {
        label: "30d",
        value: 30,
        xMin: Date.now() - 30 * 24 * 60 * 60 * 1000,
        xMax: Date.now(),
      },
      "90d": {
        label: "90d",
        value: 90,
        xMin: Date.now() - 90 * 24 * 60 * 60 * 1000,
        xMax: Date.now(),
      },
      "180d": {
        label: "180d",
        value: 180,
        xMin: Date.now() - 180 * 24 * 60 * 60 * 1000,
        xMax: Date.now(),
      },

      max: {
        label: "Max",
        value: 0,
        xMax: Date.now(),
      },
    };
  }, []);

  const totalRevenue = useMemo(() => {
    let retValue = 0;
    //Loop through for each chain
    Object.keys(data).forEach((key) => {
      const dataIndex = data[key][selectedTimespan].revenue.types.indexOf(
        showUsd ? "usd" : "eth",
      );

      retValue += data[key][selectedTimespan].revenue.total[dataIndex];
    });

    return retValue;
  }, [selectedTimespan, data, showUsd]);
  //Calculate total revenue for referencing in relative revenue bars

  const allChainsDA = useMemo(() => {
    let retArray = [""];

    Object.keys(data).forEach((key) => {
      let keyDA = dataAvailToArray(master.chains[key].da_layer);
      keyDA.forEach((element) => {
        if (!retArray.includes(element.label)) {
          retArray.push(element.label);
        }
      });
    });

    return retArray;
  }, [data, master]);
  //Get an array of potential data availabilities for this page

  function formatNumber(x: number) {
    return (
      <div className="flex gap-x-0.5 ">
        <span>{showUsd ? "$" : "Ξ"}</span>
        <span>
          {Intl.NumberFormat("en-GB", {
            notation: "compact",
            maximumFractionDigits: 2,
            minimumFractionDigits: 0,
          }).format(x)}
        </span>
      </div>
    );
  }

  const sortedChainData = useMemo(() => {
    let retData: string[];
    if (metricSort !== "chain") {
      const regularMetrics = [
        "profit",
        "revenue",
        "costs",
        "size",
        "profit_margin",
      ];
      if (regularMetrics.includes(metricSort)) {
        retData = Object.keys(data).sort((a, b) => {
          const dataIndex =
            metricSort === "profit_margin" || metricSort === "size"
              ? 0
              : data[a][selectedTimespan].revenue.types.indexOf(
                  showUsd ? "usd" : "eth",
                );
          const aComp = data[a][selectedTimespan][metricSort].total[dataIndex];
          const bComp = data[b][selectedTimespan][metricSort].total[dataIndex];

          if (aComp > bComp) return -1;
          if (aComp < bComp) return 1;

          // If aComp and bComp are equal, maintain the existing order
          return 0;
        });
      } else {
        retData = Object.keys(data).sort((a, b) => {
          const dataIndex = data[a][selectedTimespan].revenue.types.indexOf(
            showUsd ? "usd" : "eth",
          );

          const aComp = data[a][selectedTimespan].costs[metricSort][dataIndex];
          const bComp = data[b][selectedTimespan].costs[metricSort][dataIndex];

          if (aComp > bComp) return -1;
          if (aComp < bComp) return 1;

          // If aComp and bComp are equal, maintain the existing order
          return 0;
        });
      }
    } else {
      retData = Object.keys(data).sort((a, b) => {
        if (a < b) return -1;
        if (a > b) return 1;

        // If a and b are equal, maintain the existing order
        return 0;
      });
    }

    if (enableDASort) {
      retData = sortByDataAvailability(
        data,
        master,
        allChainsDA[DAIndex],
        retData,
      );
    }

    return retData.reduce((acc, key) => {
      if (data[key] !== undefined) {
        acc[key] = data[key];
      }
      return acc;
    }, {});
  }, [data, master, DAIndex, allChainsDA, metricSort, selectedTimespan]);

  const transitions = useTransition(
    (sortOrder
      ? Object.keys(sortedChainData)
      : Object.keys(sortedChainData).reverse()
    ).map((key, index) => {
      let prevOpenCharts: number = 0;
      if (selectedTimespan !== "1d") {
        (sortOrder
          ? Object.keys(sortedChainData)
          : Object.keys(sortedChainData).reverse()
        ).map((localKey, localIndex) => {
          if (localIndex >= index) return;

          if (openChain[localKey]) {
            prevOpenCharts += 1;
          }
        });
      }
      return {
        y: index * 39 + prevOpenCharts * 249,
        height: 39 + (openChain[key] ? 249 : 0),
        key: key, // Assuming `chain` is used as a key
        i: index,
      };
    }),
    {
      key: (d) => d.key,
      from: { height: 0 },
      leave: { height: 0 },
      enter: ({ y, height }) => ({ y, height }),
      update: ({ y, height }) => ({ y, height }), // Ensure height change is animated
      config: { mass: 5, tension: 500, friction: 100 },
      trail: 25,
    },
  );

  const minimumHeight = useMemo(() => {
    let retHeight: number = 39;
    Object.keys(data).map((key) => {
      retHeight += 39;
      retHeight += openChain[key] ? 249 : 0;
    });

    return retHeight;
  }, [openChain, data]);

  return (
    <div>
      {sortedChainData && (
        <div className="flex flex-col gap-y-[15px] ">
          <div className="flex justify-between items-center">
            <div className="flex items-center  gap-x-[8px]">
              <Image
                src="/GTP-Fundamentals.svg"
                alt="GTP Chain"
                className="object-contain w-[32px] h-[32px] "
                height={36}
                width={36}
              />
              <Heading className="text-[30px] leading-snug " as="h1">
                Chain Breakdown
              </Heading>
            </div>
            <div className="bg-[#1F2726] flex text-[12px] w-[249px] rounded-2xl justify-between p-[2px]">
              {Object.keys(timespans).map((key) => {
                {
                  return (
                    <div
                      className={`px-[10px] py-[5px] flex items-center gap-x-[3px] justify-center min-w-[40px] rounded-full hover:cursor-pointer ${
                        selectedTimespan === key
                          ? "bg-[#151A19]"
                          : "bg-transparent hover:bg-forest-500/10"
                      }`}
                      onClick={() => {
                        setSelectedTimespan(key);
                      }}
                      key={key}
                    >
                      {timespans[key].label}
                    </div>
                  );
                }
              })}
            </div>
          </div>
          <div
            className="grid gap-x-[5px] pr-0.5"
            style={{ gridTemplateColumns: "auto 170px 185px 110px 140px" }}
          >
            <div className="pl-[44px] flex grow gap-x-[5px] items-center justify-start  ">
              <div
                className="flex items-center group "
                onClick={() => {
                  if (metricSort !== "chain") {
                    setSortOrder(true);
                    setMetricSort("chain");
                  } else {
                    setSortOrder(!sortOrder);
                  }
                }}
              >
                <div className="text-[12px] group-hover:text-forest-50/80 font-bold">
                  Chain
                </div>
                <div>
                  <Icon
                    icon={
                      metricSort !== "chain"
                        ? "formkit:arrowdown"
                        : sortOrder
                        ? "formkit:arrowdown"
                        : "formkit:arrowup"
                    }
                    className={` w-[10px] h-[10px] ${
                      metricSort === "chain"
                        ? "text-forest-50 opacity-100"
                        : " opacity-50 group-hover:opacity-100 group-hover:text-forest-50"
                    } `}
                  />
                </div>
              </div>
              <div
                className="flex items-center bg-[#344240] gap-x-1 text-[8px] rounded-full px-[5px] py-[2px] "
                onClick={() => {
                  setEnableDASort(true);
                  if (DAIndex === allChainsDA.length - 1) {
                    setEnableDASort(false);
                    setDAIndex(0);
                  } else {
                    setDAIndex(DAIndex + 1);
                  }
                }}
              >
                <div>Data Availability: </div>
                <div>{allChainsDA[DAIndex]}</div>

                <Icon
                  icon={"feather:x-circle"}
                  className={` dark:text-white text-black w-[10px] -ml-0.5 h-[10px] relative bottom-[0.5px] cursor-pointer ${
                    DAIndex !== 0 ? "block" : "hidden"
                  }`}
                  onClick={(e) => {
                    setDAIndex(0);
                    setEnableDASort(false);
                    e.stopPropagation();
                  }}
                />
              </div>
            </div>
            <div className="flex items-center justify-end ">
              {" "}
              <div
                className="flex items-center group "
                onClick={() => {
                  if (metricSort !== "revenue") {
                    setSortOrder(true);
                    setMetricSort("revenue");
                  } else {
                    setSortOrder(!sortOrder);
                  }
                }}
              >
                <div className="text-[12px] group-hover:text-forest-50/80 font-bold">
                  Revenue
                </div>
                <div>
                  <Icon
                    icon={
                      metricSort !== "revenue"
                        ? "formkit:arrowdown"
                        : sortOrder
                        ? "formkit:arrowdown"
                        : "formkit:arrowup"
                    }
                    className={` w-[10px] h-[10px] ${
                      metricSort === "revenue"
                        ? "text-forest-50 opacity-100"
                        : " opacity-50 group-hover:opacity-100 group-hover:text-forest-50"
                    } `}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-x-[5px] ">
              {" "}
              <div className="flex items-center group ">
                <div
                  className="text-[12px] group-hover:text-forest-50/80 font-bold"
                  onClick={() => {
                    if (metricSort !== "costs") {
                      setSortOrder(true);
                      setMetricSort("costs");
                    } else {
                      setSortOrder(!sortOrder);
                    }
                  }}
                >
                  Costs
                </div>
                <div>
                  <Icon
                    icon={
                      metricSort !== "costs"
                        ? "formkit:arrowdown"
                        : sortOrder
                        ? "formkit:arrowdown"
                        : "formkit:arrowup"
                    }
                    className={` w-[10px] h-[10px] ${
                      metricSort === "costs"
                        ? "text-forest-50 opacity-100"
                        : " opacity-50 group-hover:opacity-100 group-hover:text-forest-50"
                    } `}
                  />
                </div>
              </div>
              <div className="flex items-center  gap-x-[1.5px] text-[8px] w-[110px] cursor-pointer">
                <div className="flex justify-center group items-center rounded-l-full bg-[#344240] w-[54px] px-[5px] py-[2px] ">
                  <div
                    className=" group-hover:text-forest-50/80 "
                    onClick={() => {
                      if (metricSort !== "proof_costs") {
                        setSortOrder(true);
                        setMetricSort("proof_costs");
                      } else {
                        setSortOrder(!sortOrder);
                      }
                    }}
                  >
                    L1 Fees
                  </div>
                  <div>
                    <Icon
                      icon={
                        metricSort !== "proof_costs"
                          ? "formkit:arrowdown"
                          : sortOrder
                          ? "formkit:arrowdown"
                          : "formkit:arrowup"
                      }
                      className={` w-[10px] h-[10px] ${
                        metricSort === "proof_costs"
                          ? "text-forest-50 opacity-100"
                          : " opacity-50 group-hover:opacity-100 group-hover:text-forest-50"
                      } `}
                    />
                  </div>
                </div>
                <div
                  className="flex justify-center group items-center rounded-r-full bg-[#344240] w-[54px] px-[5px] py-[2px] "
                  onClick={() => {
                    if (metricSort !== "da_costs") {
                      setSortOrder(true);
                      setMetricSort("da_costs");
                    } else {
                      setSortOrder(!sortOrder);
                    }
                  }}
                >
                  <div className=" group-hover:text-forest-50/80 ">DA Cost</div>
                  <div>
                    <Icon
                      icon={
                        metricSort !== "da_costs"
                          ? "formkit:arrowdown"
                          : sortOrder
                          ? "formkit:arrowdown"
                          : "formkit:arrowup"
                      }
                      className={` w-[10px] h-[10px] ${
                        metricSort === "da_costs"
                          ? "text-forest-50 opacity-100"
                          : " opacity-50 group-hover:opacity-100 group-hover:text-forest-50"
                      } `}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-x-[5px] pr-[2px]">
              {" "}
              <div
                className="flex items-center group "
                onClick={() => {
                  if (metricSort !== "profit") {
                    setSortOrder(true);
                    setMetricSort("profit");
                  } else {
                    setSortOrder(!sortOrder);
                  }
                }}
              >
                <div className="text-[12px] group-hover:text-forest-50/80 font-bold">
                  Profit
                </div>
                <div>
                  <Icon
                    icon={
                      metricSort !== "profit"
                        ? "formkit:arrowdown"
                        : sortOrder
                        ? "formkit:arrowdown"
                        : "formkit:arrowup"
                    }
                    className={` w-[10px] h-[10px] ${
                      metricSort === "profit"
                        ? "text-forest-50 opacity-100"
                        : " opacity-50 group-hover:opacity-100 group-hover:text-forest-50"
                    } `}
                  />
                </div>
              </div>
              <div
                className="flex items-center bg-[#344240] gap-x-1 text-[8px] rounded-full px-[5px] py-[2px]"
                onClick={() => {
                  if (metricSort !== "profit_margin") {
                    setSortOrder(true);
                    setMetricSort("profit_margin");
                  } else {
                    setSortOrder(!sortOrder);
                  }
                }}
              >
                <div>Margin </div>
                <Icon
                  icon={
                    metricSort !== "profit_margin"
                      ? "formkit:arrowdown"
                      : sortOrder
                      ? "formkit:arrowdown"
                      : "formkit:arrowup"
                  }
                  className={` w-[10px] h-[10px] ${
                    metricSort === "profit_margin"
                      ? "text-forest-50 opacity-100"
                      : " opacity-50 group-hover:opacity-100 group-hover:text-forest-50"
                  } `}
                />
              </div>
            </div>
            <div
              className="flex items-center justify-end pr-[30px] gap-x-[5px] "
              onClick={() => {
                if (metricSort !== "size") {
                  setSortOrder(true);
                  setMetricSort("size");
                } else {
                  setSortOrder(!sortOrder);
                }
              }}
            >
              {" "}
              <div className="flex items-center group ">
                <div className="text-[12px] group-hover:text-forest-50/80 font-bold">
                  {"Blob Sizes(Max)"}
                </div>
                <div>
                  <Icon
                    icon={
                      metricSort !== "size"
                        ? "formkit:arrowdown"
                        : sortOrder
                        ? "formkit:arrowdown"
                        : "formkit:arrowup"
                    }
                    className={` w-[10px] h-[10px] ${
                      metricSort === "size"
                        ? "text-forest-50 opacity-100"
                        : " opacity-50 group-hover:opacity-100 group-hover:text-forest-50"
                    } `}
                  />
                </div>
              </div>
            </div>
            {/*END TOP ROW */}
            {/*END TOP ROW */}
            {/*END TOP ROW */}
          </div>
          <div
            className={`relative flex flex-col -mt-[5px] `}
            style={{ minHeight: minimumHeight > 500 ? minimumHeight : 500 }}
          >
            {transitions((style, item) => {
              const dataIndex = data[item.key][
                selectedTimespan
              ].revenue.types.indexOf(showUsd ? "usd" : "eth");
              const localDataAvail = dataAvailToArray(
                master.chains[item.key].da_layer,
              )[0];

              return (
                <animated.div
                  className={`absolute w-full flex flex-col pr-0.5 ${
                    enableDASort
                      ? allChainsDA[DAIndex] === localDataAvail.label
                        ? "opacity-100"
                        : "opacity-50"
                      : "opacity-100"
                  }`}
                  key={item.key + " chainGridParent"}
                  style={{ ...style }}
                >
                  <div
                    className="grid gap-x-[5px] relative rounded-full w-full border-[#CDD8D3] border-[1px] min-h-[34px] text-[14px] items-center"
                    style={{
                      gridTemplateColumns: "auto 170px 185px 110px 140px",
                    }}
                  >
                    <div className="flex items-center gap-x-[5px] pl-[10px] ">
                      <Icon
                        icon={`gtp:${
                          AllChainsByKeys[item.key].urlKey
                        }-logo-monochrome`}
                        className={`w-[22px] h-[24px] flex items-center justify-center text-[10px] mr-[5px]`}
                        style={{
                          color: AllChainsByKeys[item.key].colors["dark"][0],
                        }}
                      />

                      <div>{AllChainsByKeys[item.key].label}</div>

                      <div
                        className="flex items-center bg-[#344240] gap-x-1 h-[18px] text-[14px] rounded-full px-[5px] py-[3px]"
                        key={localDataAvail.label}
                      >
                        <div>{localDataAvail.label}</div>
                        <div className="flex items-center gap-x-1">
                          <Icon
                            icon={`gtp:${localDataAvail.icon}`}
                            className="w-[12px] h-[12px]"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-x-[5px] ">
                      <div className="">
                        {formatNumber(
                          data[item.key][selectedTimespan].revenue.total[
                            dataIndex
                          ],
                        )}
                      </div>
                      <div className="min-w-[22px] flex justify-center items-center ">
                        <div
                          className={`w-[96px] flex items-center justify-center rounded-full bg-[${
                            AllChainsByKeys[item.key].colors["dark"][0]
                          }]`}
                          style={{
                            width:
                              data[item.key][selectedTimespan].revenue.total[
                                dataIndex
                              ] /
                                totalRevenue >
                              0.01
                                ? (312 *
                                    data[item.key][selectedTimespan].revenue
                                      .total[dataIndex]) /
                                  totalRevenue
                                : `${
                                    (2200 *
                                      data[item.key][selectedTimespan].revenue
                                        .total[dataIndex]) /
                                    totalRevenue
                                  }px`,
                            minWidth:
                              data[item.key][selectedTimespan].revenue.total[
                                dataIndex
                              ] /
                                totalRevenue >
                              0.01
                                ? "22px"
                                : `6px`,
                            height:
                              data[item.key][selectedTimespan].revenue.total[
                                dataIndex
                              ] /
                                totalRevenue >
                              0.01
                                ? "full"
                                : `${
                                    (2200 *
                                      data[item.key][selectedTimespan].revenue
                                        .total[dataIndex]) /
                                    totalRevenue
                                  }px`,
                            minHeight:
                              data[item.key][selectedTimespan].revenue.total[
                                dataIndex
                              ] /
                                totalRevenue >
                              0.01
                                ? "22px"
                                : `6px`,
                          }}
                        >
                          &nbsp;
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-x-[5px]">
                      <div className="min-w-[55px] flex justify-end">
                        {formatNumber(
                          data[item.key][selectedTimespan].costs.total[
                            dataIndex
                          ],
                        )}
                      </div>
                      <div className="flex justify-start w-[98px] gap-x-[1px] items-center text-[8px]">
                        <div
                          className="bg-[#FD0F2C] flex items-center justify-start font-bold rounded-l-full pl-[5px] py-[2px]"
                          style={{
                            width: `${
                              97 *
                              (data[item.key][selectedTimespan].costs
                                .proof_costs[dataIndex] /
                                data[item.key][selectedTimespan].costs.total[
                                  dataIndex
                                ])
                            }px`,
                          }}
                        >
                          L1 Proof
                        </div>
                        <div
                          className="bg-[#FE5468]  rounded-r-full flex items-center font-bold  justify-end  pr-[5px] py-[2px]"
                          style={{
                            width: `${
                              97 *
                              (data[item.key][selectedTimespan].costs.da_costs[
                                dataIndex
                              ] /
                                data[item.key][selectedTimespan].costs.total[
                                  dataIndex
                                ])
                            }px`,
                          }}
                        >
                          DA
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-x-[5px]">
                      <div>
                        {formatNumber(
                          data[item.key][selectedTimespan].profit.total[
                            dataIndex
                          ],
                        )}
                      </div>
                      <div className="w-[82px] rounded-full bg-cyan-600 flex justify-end items-center px-[5px] ">
                        {"%"}
                      </div>
                    </div>
                    <div className="flex items-center justify-end pr-[35px] gap-x-[5px]">
                      {formatBytes(
                        data[item.key][selectedTimespan].size.total[0],
                      )}
                    </div>
                    <div
                      className="absolute -right-2 hover:cursor-pointer"
                      onClick={() => {
                        toggleOpenChain(item.key);
                      }}
                    >
                      <div className="flex relative items-center justify-center w-[22px] h-[22px] bg-[#1F2726] rounded-full">
                        <div
                          className={`absolute w-[18px] h-[18px]  rounded-full border-[1px] ${
                            openChain[item.key]
                              ? "border-[#CDD8D3]"
                              : "border-[#5A6462]"
                          }`}
                        ></div>
                        <Icon
                          icon="feather:chevron-down"
                          className={`w-4 h-4  ${
                            openChain[item.key]
                              ? "text-[#CDD8D3]"
                              : "text-[#5A6462]"
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/*Chart Area \/ */}
                  <div
                    className={`w-full transition-height duration-300 overflow-hidden ${
                      openChain[item.key] && selectedTimespan !== "1d"
                        ? "h-[249px]"
                        : "h-[0px]"
                    }`}
                  >
                    <BreakdownCharts
                      data={data[item.key][selectedTimespan]}
                      dailyData={data[item.key]["daily"]}
                      chain={item.key}
                      timespans={timespans}
                      selectedTimespan={selectedTimespan}
                    />
                  </div>
                </animated.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
