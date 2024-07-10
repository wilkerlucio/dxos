//
// Copyright 2023 DXOS.org
//

import React, { type FC } from 'react';

const defaultSize = 'w-[128px] h-[64px]';

export const DXOSType: FC<{ className?: string }> = ({ className = defaultSize }) => {
  return (
    <svg
      viewBox='0 0 1024 512'
      version='1.1'
      xmlns='http://www.w3.org/2000/svg'
      xmlSpace='preserve'
      className={className}
      style={{
        fillRule: 'evenodd',
        clipRule: 'evenodd',
        strokeLinejoin: 'round',
        strokeMiterlimit: 2,
      }}
    >
      <g transform='matrix(1,0,0,1,-21.333,-794.383)'>
        <path d='M86.069,949.696L86.069,1150.73L128.337,1150.73C143.46,1150.73 157.438,1148.15 170.261,1143C183.093,1137.84 194.092,1130.8 203.257,1121.86C212.414,1112.93 219.574,1102.34 224.73,1090.08C229.886,1077.83 232.464,1064.59 232.464,1050.39C232.464,1035.95 230,1022.61 225.083,1010.35C220.147,998.094 213.168,987.496 204.117,978.559C195.065,969.622 184.009,962.586 170.958,957.43C157.896,952.274 143.346,949.696 127.306,949.696L86.069,949.696ZM59.259,924.949L129.368,924.949C148.845,924.949 166.604,928.166 182.634,934.573C198.665,940.999 212.414,949.821 223.88,961.03C235.328,972.267 244.207,985.491 250.509,1000.73C256.81,1015.96 259.961,1032.52 259.961,1050.39C259.961,1068.25 256.696,1084.86 250.165,1100.22C243.634,1115.57 234.583,1128.8 223.021,1139.91C211.449,1151.03 197.758,1159.79 181.947,1166.2C166.145,1172.62 148.96,1175.82 130.399,1175.82L59.259,1175.82L59.259,924.949Z' />
      </g>
      <g transform='matrix(1,0,0,1,-21.333,-794.383)'>
        <path d='M396.392,1067.91L325.596,1175.82L295.359,1175.82L380.925,1046.95L301.202,924.943L331.44,924.943L397.08,1024.27L462.376,924.943L492.614,924.943L412.538,1045.22L497.77,1175.82L467.532,1175.82L396.392,1067.91Z' />
      </g>
      <g transform='matrix(1,0,0,1,-21.333,-794.383)'>
        <path d='M665.476,1153.82C679.912,1153.82 693.317,1151.08 705.681,1145.58C718.055,1140.08 728.758,1132.63 737.818,1123.24C746.86,1113.84 753.963,1102.91 759.119,1090.41C764.275,1077.93 766.853,1064.59 766.853,1050.38C766.853,1036.18 764.275,1022.84 759.119,1010.35C753.963,997.859 746.86,986.927 737.818,977.522C728.758,968.137 718.055,960.68 705.681,955.18C693.317,949.691 679.912,946.941 665.476,946.941C651.039,946.941 637.635,949.691 625.27,955.18C612.897,960.68 602.184,968.137 593.133,977.522C584.082,986.927 576.978,997.859 571.832,1010.35C566.676,1022.84 564.098,1036.18 564.098,1050.38C564.098,1064.59 566.676,1077.93 571.832,1090.41C576.978,1102.91 584.082,1113.84 593.133,1123.24C602.184,1132.63 612.897,1140.08 625.27,1145.58C637.635,1151.08 651.039,1153.82 665.476,1153.82M665.476,1179.26C647.602,1179.26 630.875,1175.88 615.303,1169.12C599.721,1162.37 586.096,1153.13 574.4,1141.46C562.723,1129.76 553.491,1116.13 546.741,1100.55C539.981,1084.97 536.601,1068.24 536.601,1050.38C536.601,1032.52 539.981,1015.79 546.741,1000.21C553.491,984.626 562.723,971.001 574.4,959.315C586.096,947.628 599.721,938.405 615.303,931.645C630.875,924.895 647.602,921.506 665.476,921.506C683.349,921.506 700.067,924.895 715.649,931.645C731.23,938.405 744.855,947.628 756.541,959.315C768.228,971.001 777.451,984.626 784.21,1000.21C790.961,1015.79 794.35,1032.52 794.35,1050.38C794.35,1068.24 790.961,1084.97 784.21,1100.55C777.451,1116.13 768.228,1129.76 756.541,1141.46C744.855,1153.13 731.23,1162.37 715.649,1169.12C700.067,1175.88 683.349,1179.26 665.476,1179.26' />
      </g>
      <g transform='matrix(1,0,0,1,-21.333,-794.383)'>
        <path d='M926.997,1179.26C906.603,1179.26 889.303,1175.19 875.105,1167.06C860.898,1158.92 848.639,1147.63 838.328,1133.2L861.013,1116.03C869.491,1129.08 879.001,1138.83 889.541,1145.23C900.072,1151.65 912.561,1154.85 926.997,1154.85C934.778,1154.85 941.939,1153.65 948.479,1151.25C955.01,1148.84 960.614,1145.59 965.312,1141.46C970.009,1137.33 973.675,1132.34 976.311,1126.51C978.936,1120.67 980.263,1114.31 980.263,1107.43C980.263,1099.65 978.545,1093.12 975.108,1087.85C971.67,1082.57 967.088,1078.05 961.359,1074.27C955.63,1070.48 949.1,1067.23 941.777,1064.48C934.435,1061.72 926.882,1058.98 919.091,1056.22C910.384,1053.26 901.848,1049.99 893.494,1046.43C885.121,1042.89 877.683,1038.47 871.153,1033.2C864.622,1027.93 859.294,1021.57 855.17,1014.13C851.045,1006.7 848.992,997.463 848.992,986.464C848.992,977.307 850.931,968.762 854.826,960.857C858.721,952.961 864.106,946.087 870.981,940.243C877.855,934.4 885.98,929.827 895.375,926.495C904.77,923.182 914.967,921.511 925.966,921.511C943.839,921.511 958.953,924.843 971.327,931.488C983.701,938.124 994.461,947.414 1003.63,959.32L982.326,975.121C969.494,955.185 950.589,945.227 925.622,945.227C918.519,945.227 911.988,946.258 906.03,948.33C900.072,950.373 894.869,953.305 890.401,957.076C885.932,960.857 882.438,965.277 879.917,970.309C877.397,975.36 876.136,980.735 876.136,986.464C876.136,993.796 877.798,999.926 881.12,1004.84C884.433,1009.78 888.854,1014.08 894.353,1017.73C899.843,1021.41 906.202,1024.56 913.42,1027.18C920.638,1029.83 928.143,1032.52 935.934,1035.26C944.641,1038.24 953.224,1041.56 961.703,1045.23C970.181,1048.9 977.8,1053.42 984.56,1058.81C991.31,1064.18 996.809,1070.79 1001.05,1078.56C1005.29,1086.36 1007.41,1095.98 1007.41,1107.43C1007.41,1116.83 1005.53,1125.81 1001.75,1134.41C997.965,1143 992.513,1150.62 985.419,1157.25C978.316,1163.92 969.837,1169.24 959.994,1173.24C950.131,1177.25 939.132,1179.26 926.997,1179.26' />
      </g>
    </svg>
  );
};
