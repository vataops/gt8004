"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  CandlestickSeries,
  ISeriesApi,
  CandlestickData,
  Time,
} from "lightweight-charts";
import { marketApi, getWSClient, Kline } from "@/lib/api";

// Demo mode flag - set to true to show dummy data for screenshots
const DEMO_MODE = true;

// Real BTC/USDT data from Binance API (fetched Jan 2026)
const DEMO_1M_DATA: Kline[] = [
  { time: 1768373880, open: 95016.17, high: 95028.12, low: 95016.16, close: 95028.11, volume: 3.9393 },
  { time: 1768373940, open: 95028.11, high: 95028.88, low: 95019.74, close: 95028.87, volume: 3.7763 },
  { time: 1768374000, open: 95028.88, high: 95028.88, low: 95007.78, close: 95008.73, volume: 3.8699 },
  { time: 1768374060, open: 95008.73, high: 95008.74, low: 94986.66, close: 94995.86, volume: 6.2067 },
  { time: 1768374120, open: 94995.85, high: 94995.86, low: 94959.88, close: 94981.15, volume: 8.8357 },
  { time: 1768374180, open: 94981.15, high: 94981.16, low: 94912.45, close: 94978.37, volume: 11.8452 },
  { time: 1768374240, open: 94978.38, high: 95045.45, low: 94978.38, close: 95028.91, volume: 9.7303 },
  { time: 1768374300, open: 95028.90, high: 95065.65, low: 95027.23, close: 95052.16, volume: 9.8923 },
  { time: 1768374360, open: 95052.16, high: 95090.68, low: 95052.16, close: 95078.54, volume: 11.4384 },
  { time: 1768374420, open: 95078.54, high: 95114.57, low: 95066.65, close: 95107.66, volume: 11.4964 },
  { time: 1768374480, open: 95107.67, high: 95135.12, low: 95098.80, close: 95109.44, volume: 9.0632 },
  { time: 1768374540, open: 95109.44, high: 95132.64, low: 95064.36, close: 95083.99, volume: 9.3702 },
  { time: 1768374600, open: 95083.99, high: 95084.00, low: 95058.04, close: 95067.27, volume: 5.7864 },
  { time: 1768374660, open: 95067.27, high: 95131.56, low: 95067.27, close: 95118.59, volume: 6.1852 },
  { time: 1768374720, open: 95118.59, high: 95118.59, low: 95060.49, close: 95060.49, volume: 11.2304 },
  { time: 1768374780, open: 95060.50, high: 95084.56, low: 95060.49, close: 95060.49, volume: 5.0090 },
  { time: 1768374840, open: 95060.50, high: 95060.50, low: 95018.00, close: 95043.00, volume: 10.8042 },
  { time: 1768374900, open: 95043.01, high: 95043.01, low: 95007.87, close: 95038.89, volume: 12.9804 },
  { time: 1768374960, open: 95038.88, high: 95190.38, low: 95034.91, close: 95167.62, volume: 57.0703 },
  { time: 1768375020, open: 95167.62, high: 95179.19, low: 95072.00, close: 95081.36, volume: 7.6207 },
  { time: 1768375080, open: 95081.36, high: 95105.65, low: 95081.36, close: 95105.64, volume: 4.4808 },
  { time: 1768375140, open: 95105.64, high: 95105.65, low: 95094.72, close: 95094.99, volume: 6.5250 },
  { time: 1768375200, open: 95095.00, high: 95105.65, low: 95052.16, close: 95054.17, volume: 4.7908 },
  { time: 1768375260, open: 95054.18, high: 95080.02, low: 95040.00, close: 95080.02, volume: 4.1052 },
  { time: 1768375320, open: 95080.02, high: 95118.00, low: 95068.12, close: 95068.12, volume: 3.7632 },
  { time: 1768375380, open: 95068.13, high: 95068.13, low: 95030.00, close: 95042.21, volume: 3.3517 },
  { time: 1768375440, open: 95042.20, high: 95066.61, low: 95042.20, close: 95057.71, volume: 1.4810 },
  { time: 1768375500, open: 95057.71, high: 95066.61, low: 95052.10, close: 95052.10, volume: 1.2939 },
  { time: 1768375560, open: 95052.11, high: 95052.11, low: 95009.60, close: 95009.60, volume: 4.1348 },
  { time: 1768375620, open: 95009.60, high: 95009.60, low: 94965.44, close: 94965.85, volume: 24.8718 },
  { time: 1768375680, open: 94965.84, high: 94965.85, low: 94937.92, close: 94940.50, volume: 18.5308 },
  { time: 1768375740, open: 94940.49, high: 94940.58, low: 94909.30, close: 94935.14, volume: 21.7289 },
  { time: 1768375800, open: 94935.14, high: 94935.15, low: 94909.05, close: 94909.05, volume: 14.8995 },
  { time: 1768375860, open: 94909.05, high: 94909.05, low: 94872.79, close: 94872.79, volume: 16.5483 },
  { time: 1768375920, open: 94872.79, high: 94872.79, low: 94850.00, close: 94870.01, volume: 24.5699 },
  { time: 1768375980, open: 94870.01, high: 94935.82, low: 94870.00, close: 94905.10, volume: 42.5323 },
  { time: 1768376040, open: 94905.10, high: 94997.70, low: 94874.45, close: 94997.70, volume: 40.1084 },
  { time: 1768376100, open: 94997.69, high: 95008.00, low: 94958.23, close: 94959.27, volume: 32.1389 },
  { time: 1768376160, open: 94959.26, high: 94979.81, low: 94941.49, close: 94941.49, volume: 26.9605 },
  { time: 1768376220, open: 94941.49, high: 94965.56, low: 94939.47, close: 94958.57, volume: 23.3214 },
  { time: 1768376280, open: 94958.58, high: 94958.58, low: 94899.50, close: 94918.80, volume: 16.0197 },
  { time: 1768376340, open: 94918.80, high: 94918.80, low: 94888.00, close: 94898.78, volume: 12.9302 },
  { time: 1768376400, open: 94898.78, high: 94899.74, low: 94888.02, close: 94894.92, volume: 13.6321 },
  { time: 1768376460, open: 94894.91, high: 95028.25, low: 94872.00, close: 95023.96, volume: 37.7600 },
  { time: 1768376520, open: 95023.96, high: 95023.96, low: 94978.06, close: 95011.19, volume: 24.9970 },
  { time: 1768376580, open: 95011.18, high: 95038.04, low: 95006.02, close: 95006.03, volume: 15.5282 },
  { time: 1768376640, open: 95006.02, high: 95021.12, low: 95006.02, close: 95018.33, volume: 13.3076 },
  { time: 1768376700, open: 95018.32, high: 95052.88, low: 95013.62, close: 95052.88, volume: 22.0166 },
  { time: 1768376760, open: 95052.87, high: 95110.02, low: 95052.87, close: 95110.02, volume: 15.5827 },
  { time: 1768376820, open: 95110.02, high: 95172.41, low: 95110.01, close: 95172.40, volume: 19.1130 },
  { time: 1768376880, open: 95172.39, high: 95233.99, low: 95172.39, close: 95198.62, volume: 26.5507 },
  { time: 1768376940, open: 95198.62, high: 95198.62, low: 95180.71, close: 95183.84, volume: 8.6400 },
  { time: 1768377000, open: 95183.83, high: 95213.23, low: 95177.86, close: 95190.50, volume: 11.5628 },
  { time: 1768377060, open: 95190.49, high: 95201.03, low: 95177.89, close: 95201.03, volume: 13.9566 },
  { time: 1768377120, open: 95201.02, high: 95201.02, low: 95177.83, close: 95196.64, volume: 11.6068 },
  { time: 1768377180, open: 95196.63, high: 95200.00, low: 95189.40, close: 95198.84, volume: 16.1449 },
  { time: 1768377240, open: 95198.83, high: 95213.24, low: 95192.76, close: 95213.24, volume: 23.1113 },
  { time: 1768377300, open: 95213.23, high: 95213.24, low: 95213.10, close: 95213.10, volume: 7.9519 },
  { time: 1768377360, open: 95213.10, high: 95213.11, low: 95191.28, close: 95191.29, volume: 10.7221 },
  { time: 1768377420, open: 95191.28, high: 95221.98, low: 95174.00, close: 95221.98, volume: 15.2376 },
  { time: 1768377480, open: 95221.97, high: 95221.97, low: 95203.99, close: 95204.00, volume: 8.1706 },
  { time: 1768377540, open: 95203.99, high: 95206.40, low: 95203.99, close: 95205.10, volume: 11.2104 },
  { time: 1768377600, open: 95205.11, high: 95252.70, low: 95200.35, close: 95235.01, volume: 11.0135 },
  { time: 1768377660, open: 95235.01, high: 95250.10, low: 95197.43, close: 95239.31, volume: 8.8781 },
  { time: 1768377720, open: 95239.31, high: 95257.12, low: 95212.64, close: 95257.12, volume: 14.5157 },
  { time: 1768377780, open: 95257.11, high: 95288.88, low: 95237.42, close: 95237.43, volume: 8.9294 },
  { time: 1768377840, open: 95237.43, high: 95265.47, low: 95234.90, close: 95256.69, volume: 8.8745 },
  { time: 1768377900, open: 95256.69, high: 95256.69, low: 95246.28, close: 95246.29, volume: 3.7866 },
  { time: 1768377960, open: 95246.29, high: 95253.97, low: 95246.28, close: 95253.97, volume: 1.8498 },
  { time: 1768378020, open: 95253.97, high: 95315.15, low: 95253.96, close: 95274.00, volume: 11.0477 },
  { time: 1768378080, open: 95274.00, high: 95274.00, low: 95263.45, close: 95263.46, volume: 1.8216 },
  { time: 1768378140, open: 95263.46, high: 95263.46, low: 95188.76, close: 95208.60, volume: 7.4325 },
  { time: 1768378200, open: 95208.59, high: 95245.17, low: 95184.09, close: 95245.16, volume: 8.5130 },
  { time: 1768378260, open: 95245.16, high: 95265.95, low: 95245.16, close: 95250.00, volume: 2.2807 },
  { time: 1768378320, open: 95250.01, high: 95273.29, low: 95250.00, close: 95273.28, volume: 4.2754 },
  { time: 1768378380, open: 95273.28, high: 95273.29, low: 95263.11, close: 95263.11, volume: 2.9848 },
  { time: 1768378440, open: 95263.11, high: 95267.03, low: 95263.11, close: 95267.02, volume: 5.2286 },
  { time: 1768378500, open: 95267.02, high: 95274.00, low: 95267.02, close: 95272.59, volume: 6.9026 },
  { time: 1768378560, open: 95272.58, high: 95272.59, low: 95272.57, close: 95272.57, volume: 2.9604 },
  { time: 1768378620, open: 95272.58, high: 95278.22, low: 95272.57, close: 95278.22, volume: 3.3764 },
  { time: 1768378680, open: 95278.21, high: 95278.22, low: 95249.88, close: 95249.89, volume: 6.6334 },
  { time: 1768378740, open: 95249.88, high: 95249.89, low: 95219.16, close: 95219.17, volume: 2.8883 },
  { time: 1768378800, open: 95219.17, high: 95255.14, low: 95200.00, close: 95240.97, volume: 5.0656 },
  { time: 1768378860, open: 95240.98, high: 95276.26, low: 95240.97, close: 95255.41, volume: 8.4619 },
  { time: 1768378920, open: 95255.40, high: 95255.41, low: 95223.27, close: 95223.27, volume: 2.8196 },
  { time: 1768378980, open: 95223.28, high: 95229.53, low: 95223.27, close: 95226.03, volume: 2.2049 },
  { time: 1768379040, open: 95226.03, high: 95245.89, low: 95226.02, close: 95237.58, volume: 1.7684 },
  { time: 1768379100, open: 95237.58, high: 95237.58, low: 95212.79, close: 95212.80, volume: 2.5369 },
  { time: 1768379160, open: 95212.79, high: 95212.79, low: 95186.76, close: 95188.64, volume: 10.4199 },
  { time: 1768379220, open: 95188.64, high: 95188.65, low: 95179.18, close: 95179.18, volume: 2.4558 },
  { time: 1768379280, open: 95179.18, high: 95179.19, low: 95163.36, close: 95173.96, volume: 4.3182 },
  { time: 1768379340, open: 95173.96, high: 95173.96, low: 95170.30, close: 95170.30, volume: 2.5354 },
  { time: 1768379400, open: 95170.30, high: 95170.31, low: 95145.01, close: 95149.85, volume: 6.8929 },
  { time: 1768379460, open: 95149.85, high: 95169.35, low: 95149.85, close: 95169.35, volume: 2.4011 },
  { time: 1768379520, open: 95169.34, high: 95192.10, low: 95120.00, close: 95192.09, volume: 16.4806 },
  { time: 1768379580, open: 95192.09, high: 95192.09, low: 95140.00, close: 95140.00, volume: 3.1499 },
  { time: 1768379640, open: 95140.01, high: 95176.00, low: 95140.00, close: 95140.00, volume: 8.7053 },
  { time: 1768379700, open: 95140.00, high: 95143.74, low: 95127.23, close: 95143.73, volume: 25.8461 },
  { time: 1768379760, open: 95143.73, high: 95148.52, low: 95093.32, close: 95093.33, volume: 7.8631 },
];

const DEMO_5M_DATA: Kline[] = [
  { time: 1768350000, open: 95500.00, high: 95619.53, low: 95487.84, close: 95495.12, volume: 35.2849 },
  { time: 1768350300, open: 95495.11, high: 95529.02, low: 95445.34, close: 95466.43, volume: 47.2266 },
  { time: 1768350600, open: 95466.43, high: 95466.44, low: 95322.11, close: 95322.11, volume: 46.6735 },
  { time: 1768350900, open: 95322.11, high: 95322.11, low: 95154.04, close: 95298.52, volume: 88.6819 },
  { time: 1768351200, open: 95298.52, high: 95321.59, low: 95242.84, close: 95293.62, volume: 27.5688 },
  { time: 1768351500, open: 95293.63, high: 95293.63, low: 95200.00, close: 95254.47, volume: 31.5933 },
  { time: 1768351800, open: 95254.46, high: 95348.58, low: 95197.06, close: 95298.63, volume: 43.6589 },
  { time: 1768352100, open: 95298.63, high: 95335.03, low: 95220.46, close: 95236.84, volume: 47.5527 },
  { time: 1768352400, open: 95236.84, high: 95271.69, low: 95150.00, close: 95266.61, volume: 57.8689 },
  { time: 1768352700, open: 95266.62, high: 95443.99, low: 95258.60, close: 95343.56, volume: 107.9589 },
  { time: 1768353000, open: 95343.57, high: 95500.00, low: 95343.57, close: 95485.48, volume: 31.2083 },
  { time: 1768353300, open: 95485.48, high: 95491.78, low: 95423.08, close: 95453.39, volume: 32.6040 },
  { time: 1768353600, open: 95453.39, high: 95518.74, low: 95408.47, close: 95472.16, volume: 29.3342 },
  { time: 1768353900, open: 95472.16, high: 95582.00, low: 95452.87, close: 95480.57, volume: 48.6014 },
  { time: 1768354200, open: 95480.58, high: 95543.89, low: 95434.76, close: 95439.53, volume: 114.5254 },
  { time: 1768354500, open: 95439.54, high: 95480.28, low: 95273.93, close: 95273.93, volume: 64.6063 },
  { time: 1768354800, open: 95273.93, high: 95294.48, low: 95183.52, close: 95271.63, volume: 116.9955 },
  { time: 1768355100, open: 95271.63, high: 95271.63, low: 95116.03, close: 95132.26, volume: 50.4610 },
  { time: 1768355400, open: 95132.26, high: 95300.84, low: 95132.25, close: 95271.91, volume: 35.0865 },
  { time: 1768355700, open: 95271.91, high: 95343.55, low: 95223.30, close: 95245.60, volume: 59.8192 },
  { time: 1768356000, open: 95245.61, high: 95343.04, low: 95190.06, close: 95215.28, volume: 52.6042 },
  { time: 1768356300, open: 95215.29, high: 95380.00, low: 95215.28, close: 95305.26, volume: 33.1903 },
  { time: 1768356600, open: 95305.25, high: 95550.00, low: 95270.00, close: 95483.51, volume: 71.2832 },
  { time: 1768356900, open: 95483.51, high: 95562.00, low: 95420.05, close: 95420.06, volume: 39.1986 },
  { time: 1768357200, open: 95420.06, high: 95478.70, low: 95398.88, close: 95440.24, volume: 28.3119 },
  { time: 1768357500, open: 95440.23, high: 95526.63, low: 95379.08, close: 95526.62, volume: 77.6424 },
  { time: 1768357800, open: 95526.62, high: 95526.63, low: 95353.20, close: 95412.70, volume: 42.0973 },
  { time: 1768358100, open: 95412.71, high: 95504.01, low: 95399.32, close: 95485.34, volume: 94.8330 },
  { time: 1768358400, open: 95485.34, high: 95498.00, low: 95432.40, close: 95490.76, volume: 39.1530 },
  { time: 1768358700, open: 95490.75, high: 95530.56, low: 95460.25, close: 95521.88, volume: 20.9904 },
  { time: 1768359000, open: 95521.87, high: 95521.87, low: 95300.58, close: 95323.40, volume: 63.0295 },
  { time: 1768359300, open: 95323.39, high: 95347.47, low: 95273.88, close: 95347.46, volume: 26.2521 },
  { time: 1768359600, open: 95347.47, high: 95382.96, low: 95285.50, close: 95382.95, volume: 29.9126 },
  { time: 1768359900, open: 95382.95, high: 95396.00, low: 95350.00, close: 95350.00, volume: 22.9577 },
  { time: 1768360200, open: 95350.01, high: 95491.85, low: 95293.84, close: 95433.44, volume: 29.8173 },
  { time: 1768360500, open: 95433.44, high: 95499.99, low: 95406.14, close: 95492.11, volume: 39.9135 },
  { time: 1768360800, open: 95492.10, high: 95492.10, low: 95366.16, close: 95431.80, volume: 33.8620 },
  { time: 1768361100, open: 95431.80, high: 95431.81, low: 95372.18, close: 95372.19, volume: 17.1120 },
  { time: 1768361400, open: 95372.18, high: 95527.47, low: 95372.18, close: 95513.88, volume: 32.7287 },
  { time: 1768361700, open: 95513.88, high: 95563.63, low: 95495.44, close: 95557.21, volume: 27.6420 },
  { time: 1768362000, open: 95557.20, high: 95595.38, low: 95514.89, close: 95549.73, volume: 38.5055 },
  { time: 1768362300, open: 95549.74, high: 95600.00, low: 95536.08, close: 95599.99, volume: 30.5998 },
  { time: 1768362600, open: 95600.00, high: 95643.42, low: 95573.36, close: 95643.42, volume: 42.0151 },
  { time: 1768362900, open: 95643.43, high: 95722.01, low: 95643.42, close: 95720.99, volume: 36.3747 },
  { time: 1768363200, open: 95720.99, high: 95799.22, low: 95600.00, close: 95603.78, volume: 136.1514 },
  { time: 1768363500, open: 95603.77, high: 95603.78, low: 95382.00, close: 95382.01, volume: 104.9047 },
  { time: 1768363800, open: 95382.00, high: 95460.00, low: 95379.08, close: 95420.34, volume: 26.9310 },
  { time: 1768364100, open: 95420.34, high: 95517.47, low: 95420.23, close: 95485.51, volume: 20.3497 },
  { time: 1768364400, open: 95485.51, high: 95517.47, low: 95434.01, close: 95509.54, volume: 23.1603 },
  { time: 1768364700, open: 95509.54, high: 95522.69, low: 95460.37, close: 95460.37, volume: 10.0152 },
  { time: 1768365000, open: 95460.38, high: 95460.38, low: 95405.98, close: 95445.72, volume: 21.0939 },
  { time: 1768365300, open: 95445.72, high: 95445.73, low: 95354.53, close: 95359.03, volume: 27.8420 },
  { time: 1768365600, open: 95359.02, high: 95359.03, low: 95285.82, close: 95289.52, volume: 38.5716 },
  { time: 1768365900, open: 95289.52, high: 95320.51, low: 95289.51, close: 95320.11, volume: 15.4797 },
  { time: 1768366200, open: 95320.10, high: 95322.65, low: 95252.00, close: 95271.96, volume: 17.1942 },
  { time: 1768366500, open: 95271.97, high: 95271.97, low: 95224.44, close: 95245.16, volume: 18.6994 },
  { time: 1768366800, open: 95245.17, high: 95245.17, low: 95153.83, close: 95218.07, volume: 44.0955 },
  { time: 1768367100, open: 95218.07, high: 95226.67, low: 95135.08, close: 95135.08, volume: 33.8376 },
  { time: 1768367400, open: 95135.08, high: 95235.48, low: 95108.00, close: 95234.12, volume: 46.8624 },
  { time: 1768367700, open: 95234.12, high: 95260.00, low: 95206.10, close: 95259.99, volume: 23.4200 },
  { time: 1768368000, open: 95260.00, high: 95270.25, low: 94972.00, close: 95028.00, volume: 147.7227 },
  { time: 1768368300, open: 95028.00, high: 95061.74, low: 94972.01, close: 95043.76, volume: 44.9042 },
  { time: 1768368600, open: 95043.75, high: 95105.65, low: 94979.79, close: 95105.65, volume: 25.1724 },
  { time: 1768368900, open: 95105.64, high: 95216.00, low: 95082.23, close: 95146.49, volume: 99.7808 },
  { time: 1768369200, open: 95146.48, high: 95179.19, low: 95003.77, close: 95024.55, volume: 55.2328 },
  { time: 1768369500, open: 95024.54, high: 95140.85, low: 95013.73, close: 95019.33, volume: 32.8284 },
  { time: 1768369800, open: 95019.33, high: 95062.93, low: 94999.84, close: 95021.94, volume: 97.3462 },
  { time: 1768370100, open: 95021.93, high: 95024.81, low: 95005.00, close: 95005.00, volume: 18.3929 },
  { time: 1768370400, open: 95005.01, high: 95005.01, low: 94855.04, close: 94912.01, volume: 111.7386 },
  { time: 1768370700, open: 94912.01, high: 94917.29, low: 94745.87, close: 94809.97, volume: 142.3553 },
  { time: 1768371000, open: 94809.96, high: 94888.00, low: 94701.00, close: 94863.17, volume: 98.8857 },
  { time: 1768371300, open: 94863.17, high: 94881.62, low: 94765.75, close: 94765.75, volume: 36.9113 },
  { time: 1768371600, open: 94765.75, high: 94790.32, low: 94680.03, close: 94693.82, volume: 54.0673 },
  { time: 1768371900, open: 94693.83, high: 94771.41, low: 94670.04, close: 94697.04, volume: 44.5689 },
  { time: 1768372200, open: 94697.05, high: 94745.31, low: 94650.02, close: 94659.69, volume: 47.7370 },
  { time: 1768372500, open: 94659.68, high: 94824.00, low: 94559.28, close: 94777.57, volume: 141.9839 },
  { time: 1768372800, open: 94777.57, high: 94900.00, low: 94766.89, close: 94889.75, volume: 60.0185 },
  { time: 1768373100, open: 94889.75, high: 94960.50, low: 94889.74, close: 94907.06, volume: 40.0588 },
  { time: 1768373400, open: 94907.06, high: 94984.76, low: 94900.56, close: 94965.65, volume: 39.6110 },
  { time: 1768373700, open: 94965.65, high: 95028.88, low: 94965.65, close: 95028.87, volume: 41.3838 },
  { time: 1768374000, open: 95028.88, high: 95045.45, low: 94912.45, close: 95028.91, volume: 40.4878 },
  { time: 1768374300, open: 95028.90, high: 95135.12, low: 95027.23, close: 95083.99, volume: 51.2606 },
  { time: 1768374600, open: 95083.99, high: 95131.56, low: 95018.00, close: 95043.00, volume: 39.0152 },
  { time: 1768374900, open: 95043.01, high: 95190.38, low: 95007.87, close: 95094.99, volume: 88.6773 },
  { time: 1768375200, open: 95095.00, high: 95118.00, low: 95030.00, close: 95057.71, volume: 17.4919 },
  { time: 1768375500, open: 95057.71, high: 95066.61, low: 94909.30, close: 94935.14, volume: 70.5602 },
  { time: 1768375800, open: 94935.14, high: 94997.70, low: 94850.00, close: 94997.70, volume: 138.6585 },
  { time: 1768376100, open: 94997.69, high: 95008.00, low: 94888.00, close: 94898.78, volume: 111.3707 },
  { time: 1768376400, open: 94898.78, high: 95038.04, low: 94872.00, close: 95018.33, volume: 105.2249 },
  { time: 1768376700, open: 95018.32, high: 95233.99, low: 95013.62, close: 95183.84, volume: 91.9030 },
  { time: 1768377000, open: 95183.83, high: 95213.24, low: 95177.83, close: 95213.24, volume: 76.3825 },
  { time: 1768377300, open: 95213.23, high: 95221.98, low: 95174.00, close: 95205.10, volume: 53.2925 },
  { time: 1768377600, open: 95205.11, high: 95288.88, low: 95197.43, close: 95256.69, volume: 52.2112 },
  { time: 1768377900, open: 95256.69, high: 95315.15, low: 95188.76, close: 95208.60, volume: 25.9382 },
  { time: 1768378200, open: 95208.59, high: 95273.29, low: 95184.09, close: 95267.02, volume: 23.2824 },
  { time: 1768378500, open: 95267.02, high: 95278.22, low: 95219.16, close: 95219.17, volume: 22.7612 },
  { time: 1768378800, open: 95219.17, high: 95276.26, low: 95200.00, close: 95237.58, volume: 20.3203 },
  { time: 1768379100, open: 95237.58, high: 95237.58, low: 95163.36, close: 95170.30, volume: 22.2663 },
  { time: 1768379400, open: 95170.30, high: 95192.10, low: 95120.00, close: 95140.00, volume: 37.6297 },
];

const DEMO_1D_DATA: Kline[] = [
  { time: 1760659200, open: 108194.27, high: 109240.00, low: 103528.23, close: 106431.68, volume: 37920.6684 },
  { time: 1760745600, open: 106431.68, high: 107499.00, low: 106322.20, close: 107185.01, volume: 11123.1877 },
  { time: 1760832000, open: 107185.00, high: 109450.07, low: 106103.36, close: 108642.78, volume: 15480.6642 },
  { time: 1760918400, open: 108642.77, high: 111705.56, low: 107402.52, close: 110532.09, volume: 19193.4416 },
  { time: 1761004800, open: 110532.09, high: 114000.00, low: 107473.72, close: 108297.67, volume: 37228.0166 },
  { time: 1761091200, open: 108297.66, high: 109163.88, low: 106666.69, close: 107567.44, volume: 28610.7845 },
  { time: 1761177600, open: 107567.45, high: 111293.61, low: 107500.00, close: 110078.18, volume: 17573.0929 },
  { time: 1761264000, open: 110078.19, high: 112104.98, low: 109700.01, close: 111004.89, volume: 15005.1691 },
  { time: 1761350400, open: 111004.90, high: 111943.19, low: 110672.86, close: 111646.27, volume: 6407.9686 },
  { time: 1761436800, open: 111646.27, high: 115466.80, low: 111260.45, close: 114559.40, volume: 13454.4774 },
  { time: 1761523200, open: 114559.41, high: 116400.00, low: 113830.01, close: 114107.65, volume: 21450.2324 },
  { time: 1761609600, open: 114107.65, high: 116086.00, low: 112211.00, close: 112898.45, volume: 15523.4226 },
  { time: 1761696000, open: 112898.44, high: 113643.73, low: 109200.00, close: 110021.29, volume: 21079.7138 },
  { time: 1761782400, open: 110021.30, high: 111592.00, low: 106304.34, close: 108322.88, volume: 25988.8284 },
  { time: 1761868800, open: 108322.87, high: 111190.00, low: 108275.28, close: 109608.01, volume: 21518.2044 },
  { time: 1761955200, open: 109608.01, high: 110564.49, low: 109394.81, close: 110098.10, volume: 7378.5043 },
  { time: 1762041600, open: 110098.10, high: 111250.01, low: 109471.34, close: 110540.68, volume: 12107.0009 },
  { time: 1762128000, open: 110540.69, high: 110750.00, low: 105306.56, close: 106583.04, volume: 28681.1878 },
  { time: 1762214400, open: 106583.05, high: 107299.00, low: 98944.36, close: 101497.22, volume: 50534.8738 },
  { time: 1762300800, open: 101497.23, high: 104534.74, low: 98966.80, close: 103885.16, volume: 33778.7757 },
  { time: 1762387200, open: 103885.16, high: 104200.00, low: 100300.95, close: 101346.04, volume: 25814.6214 },
  { time: 1762473600, open: 101346.04, high: 104096.36, low: 99260.86, close: 103339.08, volume: 32059.5094 },
  { time: 1762560000, open: 103339.09, high: 103406.22, low: 101454.00, close: 102312.94, volume: 12390.7799 },
  { time: 1762646400, open: 102312.95, high: 105495.62, low: 101400.00, close: 104722.96, volume: 16338.9710 },
  { time: 1762732800, open: 104722.95, high: 106670.11, low: 104265.02, close: 106011.13, volume: 22682.2567 },
  { time: 1762819200, open: 106011.13, high: 107500.00, low: 102476.09, close: 103058.99, volume: 24196.5072 },
  { time: 1762905600, open: 103059.00, high: 105333.33, low: 100813.59, close: 101654.37, volume: 20457.6391 },
  { time: 1762992000, open: 101654.37, high: 104085.01, low: 98000.40, close: 99692.02, volume: 36198.5077 },
  { time: 1763078400, open: 99692.03, high: 99866.02, low: 94012.45, close: 94594.00, volume: 47288.1448 },
  { time: 1763164800, open: 94594.00, high: 96846.68, low: 94558.49, close: 95596.24, volume: 15110.8939 },
  { time: 1763251200, open: 95596.23, high: 96635.11, low: 93005.55, close: 94261.44, volume: 23889.4051 },
  { time: 1763337600, open: 94261.45, high: 96043.00, low: 91220.00, close: 92215.14, volume: 39218.5981 },
  { time: 1763424000, open: 92215.14, high: 93836.01, low: 89253.78, close: 92960.83, volume: 39835.1477 },
  { time: 1763510400, open: 92960.83, high: 92980.22, low: 88608.00, close: 91554.96, volume: 32286.6376 },
  { time: 1763596800, open: 91554.96, high: 93160.00, low: 86100.00, close: 86637.23, volume: 39733.1907 },
  { time: 1763683200, open: 86637.22, high: 87498.94, low: 80600.00, close: 85129.43, volume: 72256.1268 },
  { time: 1763769600, open: 85129.42, high: 85620.00, low: 83500.00, close: 84739.74, volume: 14193.9326 },
  { time: 1763856000, open: 84739.75, high: 88127.64, low: 84667.57, close: 86830.00, volume: 19734.4642 },
  { time: 1763942400, open: 86830.00, high: 89228.00, low: 85272.00, close: 88300.01, volume: 24663.1279 },
  { time: 1764028800, open: 88300.01, high: 88519.99, low: 86116.00, close: 87369.96, volume: 19567.0411 },
  { time: 1764115200, open: 87369.97, high: 90656.08, low: 86306.77, close: 90484.02, volume: 21675.8224 },
  { time: 1764201600, open: 90484.01, high: 91950.00, low: 90089.91, close: 91333.95, volume: 16833.5093 },
  { time: 1764288000, open: 91333.94, high: 93092.00, low: 90180.63, close: 90890.70, volume: 18830.8601 },
  { time: 1764374400, open: 90890.71, high: 91165.65, low: 90155.47, close: 90802.44, volume: 7429.8829 },
  { time: 1764460800, open: 90802.44, high: 92000.01, low: 90336.90, close: 90360.00, volume: 9687.7417 },
  { time: 1764547200, open: 90360.01, high: 90417.00, low: 83822.76, close: 86286.01, volume: 34509.0123 },
  { time: 1764633600, open: 86286.01, high: 92307.65, low: 86184.39, close: 91277.88, volume: 28210.2273 },
  { time: 1764720000, open: 91277.88, high: 94150.00, low: 90990.23, close: 93429.95, volume: 25712.5259 },
  { time: 1764806400, open: 93429.95, high: 94080.00, low: 90889.00, close: 92078.06, volume: 19803.9406 },
  { time: 1764892800, open: 92078.06, high: 92692.36, low: 88056.00, close: 89330.04, volume: 19792.9722 },
  { time: 1764979200, open: 89330.04, high: 90289.97, low: 88908.01, close: 89236.79, volume: 8409.5002 },
  { time: 1765065600, open: 89236.80, high: 91760.00, low: 87719.28, close: 90395.31, volume: 13021.1118 },
  { time: 1765152000, open: 90395.32, high: 92287.15, low: 89612.00, close: 90634.34, volume: 15793.6389 },
  { time: 1765238400, open: 90634.35, high: 94588.99, low: 89500.00, close: 92678.80, volume: 21240.4301 },
  { time: 1765324800, open: 92678.81, high: 94476.00, low: 91563.15, close: 92015.37, volume: 18998.6808 },
  { time: 1765411200, open: 92015.38, high: 93555.00, low: 89260.63, close: 92513.38, volume: 19972.5876 },
  { time: 1765497600, open: 92513.38, high: 92754.00, low: 89480.00, close: 90268.42, volume: 16679.1917 },
  { time: 1765584000, open: 90268.43, high: 90634.55, low: 89766.39, close: 90240.01, volume: 5895.7079 },
  { time: 1765670400, open: 90240.00, high: 90472.40, low: 87577.36, close: 88172.17, volume: 9416.9400 },
  { time: 1765756800, open: 88172.16, high: 90052.64, low: 85146.64, close: 86432.08, volume: 19778.6919 },
  { time: 1765843200, open: 86432.08, high: 88175.98, low: 85266.00, close: 87863.42, volume: 18456.0502 },
  { time: 1765929600, open: 87863.43, high: 90365.85, low: 85314.00, close: 86243.22, volume: 19834.1173 },
  { time: 1766016000, open: 86243.23, high: 89477.61, low: 84450.01, close: 85516.41, volume: 25405.4176 },
  { time: 1766102400, open: 85516.41, high: 89399.97, low: 85110.24, close: 88136.94, volume: 21256.6500 },
  { time: 1766188800, open: 88136.95, high: 88573.07, low: 87795.76, close: 88360.90, volume: 5123.1319 },
  { time: 1766275200, open: 88360.91, high: 89081.77, low: 87600.04, close: 88658.86, volume: 7132.8726 },
  { time: 1766361600, open: 88658.87, high: 90588.23, low: 87900.00, close: 88620.79, volume: 14673.2197 },
  { time: 1766448000, open: 88620.79, high: 88940.00, low: 86601.90, close: 87486.00, volume: 13910.3290 },
  { time: 1766534400, open: 87486.00, high: 88049.89, low: 86420.00, close: 87669.45, volume: 9140.8432 },
  { time: 1766620800, open: 87669.44, high: 88592.74, low: 86934.72, close: 87225.27, volume: 7096.5823 },
  { time: 1766707200, open: 87225.27, high: 89567.75, low: 86655.08, close: 87369.56, volume: 18344.6151 },
  { time: 1766793600, open: 87369.56, high: 87984.00, low: 87253.05, close: 87877.01, volume: 4469.5516 },
  { time: 1766880000, open: 87877.00, high: 88088.75, low: 87435.00, close: 87952.71, volume: 4446.2928 },
  { time: 1766966400, open: 87952.71, high: 90406.08, low: 86806.50, close: 87237.13, volume: 19894.9857 },
  { time: 1767052800, open: 87237.13, high: 89400.00, low: 86845.66, close: 88485.49, volume: 13105.9100 },
  { time: 1767139200, open: 88485.50, high: 89200.00, low: 87250.00, close: 87648.22, volume: 11558.6205 },
  { time: 1767225600, open: 87648.21, high: 88919.45, low: 87550.43, close: 88839.04, volume: 6279.5713 },
  { time: 1767312000, open: 88839.05, high: 90961.81, low: 88379.88, close: 89995.13, volume: 17396.9730 },
  { time: 1767398400, open: 89995.14, high: 90741.16, low: 89314.01, close: 90628.01, volume: 7057.4672 },
  { time: 1767484800, open: 90628.01, high: 91810.00, low: 90628.00, close: 91529.73, volume: 10426.5297 },
  { time: 1767571200, open: 91529.74, high: 94789.08, low: 91514.81, close: 93859.71, volume: 20673.5958 },
  { time: 1767657600, open: 93859.71, high: 94444.44, low: 91262.94, close: 93747.97, volume: 18546.4183 },
  { time: 1767744000, open: 93747.97, high: 93747.97, low: 90675.52, close: 91364.16, volume: 14276.4903 },
  { time: 1767830400, open: 91364.16, high: 91687.99, low: 89311.00, close: 91099.99, volume: 16132.7912 },
  { time: 1767916800, open: 91100.00, high: 92082.55, low: 89694.66, close: 90641.28, volume: 15590.2794 },
  { time: 1768003200, open: 90641.27, high: 90832.00, low: 90404.00, close: 90504.70, volume: 3104.1172 },
  { time: 1768089600, open: 90504.70, high: 91283.89, low: 90236.00, close: 91013.65, volume: 5477.1359 },
  { time: 1768176000, open: 91013.66, high: 92519.95, low: 90128.44, close: 91296.20, volume: 16188.0827 },
  { time: 1768262400, open: 91296.20, high: 96495.00, low: 91042.66, close: 95414.00, volume: 23021.5148 },
  { time: 1768348800, open: 95413.99, high: 95799.22, low: 94559.28, close: 95068.88, volume: 5498.0602 },
];

// Get demo data based on interval
function getDemoKlines(interval: string): Kline[] {
  if (interval === "5m") {
    return DEMO_5M_DATA;
  } else if (interval === "1d") {
    return DEMO_1D_DATA;
  }
  return DEMO_1M_DATA;
}

interface ChartProps {
  symbol?: string;
}

type Interval = "1m" | "5m" | "1d";

export default function Chart({ symbol = "BTC_USD" }: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState<Interval>("1m");

  // 차트 초기화
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#6b7280",
      },
      grid: {
        vertLines: { color: "#1a1a1a" },
        horzLines: { color: "#1a1a1a" },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 400,
      crosshair: {
        vertLine: {
          color: "#00FFE0",
          labelBackgroundColor: "#0f0f0f",
        },
        horzLine: {
          color: "#00FFE0",
          labelBackgroundColor: "#0f0f0f",
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: "#1a1a1a",
      },
      rightPriceScale: {
        borderColor: "#1a1a1a",
      },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00FFE0",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      borderUpColor: "#00FFE0",
      wickDownColor: "#ef4444",
      wickUpColor: "#00FFE0",
    });

    seriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  // 데이터 로드 + 실시간 업데이트
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    // Time scale 설정 (interval에 따라)
    if (chartRef.current) {
      chartRef.current.timeScale().applyOptions({
        timeVisible: true,
        secondsVisible: interval === "1m" || interval === "5m",
      });
    }

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Use demo data or fetch from API
        const klines = DEMO_MODE
          ? getDemoKlines(interval)
          : await marketApi.getKlines(symbol, interval);

        const chartData: CandlestickData<Time>[] = klines.map((k: Kline) => ({
          time: k.time as Time,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }));

        // Sort by time
        chartData.sort((a, b) => (a.time as number) - (b.time as number));

        if (seriesRef.current) {
          seriesRef.current.setData(chartData);
        }
        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }

        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load chart data:", err);
        setError("Failed to load chart data");
        setIsLoading(false);
      }
    };

    loadData();

    // Skip WebSocket in demo mode
    if (DEMO_MODE) return;

    // Subscribe to real-time kline updates (1m만 실시간 업데이트)
    const ws = getWSClient();
    ws.connect();

    let unsubscribe: (() => void) | null = null;
    let reloadInterval: number | null = null;

    // 1분봉만 실시간 업데이트 (다른 interval은 주기적으로 재로드)
    if (interval === "1m") {
      unsubscribe = ws.subscribe(`kline.1m.${symbol}`, (data: unknown) => {
        const kline = data as { t: number; o: number; h: number; l: number; c: number; v: number };
        if (seriesRef.current) {
          seriesRef.current.update({
            time: kline.t as Time,
            open: kline.o,
            high: kline.h,
            low: kline.l,
            close: kline.c,
          });
        }
      });
    } else {
      // 5m, 1d는 주기적으로 재로드
      reloadInterval = window.setInterval(() => {
        loadData();
      }, interval === "5m" ? 5000 : 60000); // 5분봉은 5초마다, 1일봉은 1분마다
    }

    return () => {
      if (unsubscribe) unsubscribe();
      if (reloadInterval) clearInterval(reloadInterval);
    };
  }, [symbol, interval]);

  const intervals: { value: Interval; label: string }[] = [
    { value: "1m", label: "1m" },
    { value: "5m", label: "5m" },
    { value: "1d", label: "1d" },
  ];

  return (
    <div className="relative w-full h-full rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] flex flex-col">
      {/* Interval 선택 버튼 */}
      <div className="flex items-center gap-2 p-3 border-b border-[#1a1a1a]">
        {intervals.map((item) => (
          <button
            key={item.value}
            onClick={() => setInterval(item.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              interval === item.value
                ? "bg-[#00FFE0]/10 text-[#00FFE0] border border-[#00FFE0]/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1a1a]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      
      <div ref={chartContainerRef} className="flex-1 w-full" />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f0f]/80 z-10">
          <div className="flex items-center gap-2 text-[#00FFE0]">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading chart...</span>
          </div>
        </div>
      )}

      {error && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-zinc-500">
            <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
