export {};

const qs = require('qs');
const fetch = require('node-fetch');
const orders = require('../utils/orders');

module.exports.getOrdersInfoFromFtp = async (periodDays: number, st: string) => {

  const queue = qs.stringify({
    "periodDays": periodDays,
    "st": st
  });

  const url = `${process.env.ORDERSWORKER_ADDR}getOrdersInfoByPeriod?${queue}`;

  // const response = await fetch(url);
  // if(response.body) {
  //   const contentLength = response.headers.get('Content-Length');
  //   const reader = response.body.getReader();
  //   const decoder = new TextDecoder();
  //   let data = '';
  //   while(true) {
  //     let { done, value } = await reader.read();
  //     console.log("Got chunk: ", decoder.decode(value));
  //     data += decoder.decode(value);
  //     if(done)
  //       break;
  //     // @ts-ignore
  //     console.info('Get bytes '+value.length);
  //   }
  // } else {
  //   console.log("Null body");
  // }

  let result;

  try {
    result = await fetch(url)
      .then((response: any) => {
        // console.log("Orders response: ", response);
        return response.json();
      })
      .then((data: any) => {
        return data;
      });
    return result;
  } catch (e) {
    console.error("getOrdersInfo error: ", e);
    return false;
  }
};

module.exports.getOrderDataStr = async(orderNumber: number, st: string) => {

  const queue = qs.stringify({
    "st": st,
    "orderNumber": orderNumber
  });

  const url = `${process.env.ORDERSWORKER_ADDR}getOrderData?${queue}`;

  try {
    return await fetch(url)
      .then((response: any) => {
        // console.log("Order data response: ", response);
        return response.json();
      });
  } catch (e) {
    console.error("getOrderDataStr error: ", e);
    return {};
  }

};

module.exports.extractUpdatedInfo = (orderDataStrFromDb: string, orderDataStrFromFtp: string): {updatedPartOfInfoBefore: string, updatedPartOfInfoAfter: string} => {

  const objFromDb = orders.parseOrderDataString(orderDataStrFromDb);

  const objFromFtp = orders.parseOrderDataString(orderDataStrFromFtp);

  const commonKeysWthDuplicates = [ ...Object.keys(objFromDb), ...Object.keys(objFromFtp) ];

  const commonKeys = commonKeysWthDuplicates.reduce((acc: string[], key: string) => {
    if(!acc.includes(key)) {
      acc.push(key);
    }
    return acc;
  }, []);

  return commonKeys.reduce((acc, key: string) => {
    if((key in objFromDb) && (key in objFromFtp) && (objFromDb[key].trim() === objFromFtp[key].trim())) {
      return acc;
    } else {
      if((key in objFromDb) && (key in objFromFtp)) {
        acc.updatedPartOfInfoBefore = `${acc.updatedPartOfInfoBefore}${key}: ${objFromDb[key]}\n`;
        acc.updatedPartOfInfoAfter = `${acc.updatedPartOfInfoAfter}${key}: ${objFromFtp[key]}\n`;
      } else {
        if(key in objFromDb) {
          acc.updatedPartOfInfoBefore = `${acc.updatedPartOfInfoBefore}${key}: ${objFromDb[key]}\n`;
        } else {
          acc.updatedPartOfInfoAfter = `${acc.updatedPartOfInfoAfter}${key}: ${objFromFtp[key]}\n`;
        }
      }
      return acc;
    }
  }, {
    updatedPartOfInfoBefore: '',
    updatedPartOfInfoAfter: ''
  });
};

module.exports.parseOrderDataString = (str: string) => {

  const orderDataArray = str.split(';');
  // console.log('orderDataArray: ', orderDataArray);
  // let orderDataKeys = [
  //   'order',
  //   'createDate',
  //   'releaseDate',
  //   'product',
  //   'workType',
  //   'count',
  //   'material',
  //   'description',
  //   'additionalInfo',
  //   'manager',
  //   'office',
  //   'client',
  //   'approveDate'
  // ];
  const orderDataKeys = [
    'Номер заказа',
    'Заведён',
    'Отгрузка',
    'Название',
    'Вид работ',
    'Тираж',
    'Материал',
    'Описание',
    'Доп. инфо',
    'Менеджер',
    'Филиал',
    'Заказчик',
    'Дата согласования'
  ];
  return orderDataKeys.reduce((acc: any, key, index) => {
    acc[key] = orderDataArray[index][0] === "\"" ? orderDataArray[index].slice(1, orderDataArray[index].length - 1) : orderDataArray[index];
    return acc;
  }, {});
};


// module.exports.getOrderFileModifiedAtStr = async(orderNumber: number, st: string): Promise<string | boolean> => {
//   const queue = qs.stringify({
//     "st": st,
//     "orderNumber": orderNumber
//   });
//
//   const url = `${process.env.ORDERSWORKER_ADDR}getOrderFileModifiedAtStr?${queue}`;
//
//   try {
//     return await fetch(url)
//       .then((response: any) => {
//         // console.log("Order ModifiedAtStr response: ", response);
//         return response.text();
//       })
//       .then((text: string) => {
//         console.log("Order ModifiedAtStr: ", text);
//         return text;
//       });
//   } catch (e) {
//     console.error("getOrderFileModifiedAtStr error: ", e);
//     return false;
//   }
// };
// module.exports.getOrdersFromFtp = async (periodDays: number, st: string) => {
//
//   // @ts-ignore
//   const ordersInfoArr = await this.getOrdersInfoFromFtp(periodDays, st);
//   return ordersInfoArr.map((orderInfo: any) => parseInt(orderInfo.name));
// };

interface UnixPermissions {
  Read: number;
  Write: number;
  Execute: number;
}

enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 3
}

export interface FileInfo {
  name: string;
  type: FileType;
  size: number;
  /**
   * Unparsed, raw modification date as a string.
   *
   * If `modifiedAt` is undefined, the FTP server you're connected to doesn't support the more modern
   * MLSD command for machine-readable directory listings. The older command LIST is then used returning
   * results that vary a lot between servers as the format hasn't been standardized. Here, directory listings
   * and especially modification dates were meant to be human-readable first.
   *
   * Be careful when still trying to parse this by yourself. Parsing dates from listings using LIST is
   * unreliable. This library decides to offer parsed dates only when they're absolutely reliable and safe to
   * use e.g. for comparisons.
   */
  rawModifiedAt: string;
  /**
   * Parsed modification date.
   *
   * Available if the FTP server supports the MLSD command. Only MLSD guarantees dates than can be reliably
   * parsed with the correct timezone and a resolution down to seconds. See `rawModifiedAt` property for the unparsed
   * date that is always available.
   */
  modifiedAt?: Date;
  /**
   * Unix permissions if present. If the underlying FTP server is not running on Unix this will be undefined.
   * If set, you might be able to edit permissions with the FTP command `SITE CHMOD`.
   */
  permissions?: UnixPermissions;
  /**
   * Hard link count if available.
   */
  hardLinkCount?: number;
  /**
   * Link name for symbolic links if available.
   */
  link?: string;
  /**
   * Unix group if available.
   */
  group?: string;
  /**
   * Unix user if available.
   */
  user?: string;
  /**
   * Unique ID if available.
   */
  uniqueID?: string;
}

export interface UpdateOrderInfo {
  orderNumber: number,
  date: Date
  updatedPartOfInfoBefore: string,
  updatedPartOfInfoAfter: string,
}