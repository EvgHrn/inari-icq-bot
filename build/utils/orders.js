"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const qs = require('qs');
const fetch = require('node-fetch');
const orders = require('../utils/orders');
module.exports.getOrdersInfoFromFtp = (periodDays, st) => __awaiter(void 0, void 0, void 0, function* () {
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
        result = yield fetch(url)
            .then((response) => {
            // console.log("Orders response: ", response);
            return response.json();
        })
            .then((data) => {
            return data;
        });
        return result;
    }
    catch (e) {
        console.error("getOrdersInfo error: ", e);
        return false;
    }
});
module.exports.getOrderDataStr = (orderNumber, st) => __awaiter(void 0, void 0, void 0, function* () {
    const queue = qs.stringify({
        "st": st,
        "orderNumber": orderNumber
    });
    const url = `${process.env.ORDERSWORKER_ADDR}getOrderData?${queue}`;
    try {
        return yield fetch(url)
            .then((response) => {
            // console.log("Order data response: ", response);
            return response.json();
        });
    }
    catch (e) {
        console.error("getOrderDataStr error: ", e);
        return {};
    }
});
module.exports.extractUpdatedInfo = (orderDataStrFromDb, orderDataStrFromFtp) => {
    const objFromDb = orders.parseOrderDataString(orderDataStrFromDb);
    const objFromFtp = orders.parseOrderDataString(orderDataStrFromFtp);
    const commonKeysWthDuplicates = [...Object.keys(objFromDb), ...Object.keys(objFromFtp)];
    const commonKeys = commonKeysWthDuplicates.reduce((acc, key) => {
        if (!acc.includes(key)) {
            acc.push(key);
        }
        return acc;
    }, []);
    return commonKeys.reduce((acc, key) => {
        if ((key in objFromDb) && (key in objFromFtp) && (objFromDb[key].trim() === objFromFtp[key].trim())) {
            return acc;
        }
        else {
            if ((key in objFromDb) && (key in objFromFtp)) {
                acc.updatedPartOfInfoBefore = `${acc.updatedPartOfInfoBefore}${key}: ${objFromDb[key]}\n`;
                acc.updatedPartOfInfoAfter = `${acc.updatedPartOfInfoAfter}${key}: ${objFromFtp[key]}\n`;
            }
            else {
                if (key in objFromDb) {
                    acc.updatedPartOfInfoBefore = `${acc.updatedPartOfInfoBefore}${key}: ${objFromDb[key]}\n`;
                }
                else {
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
module.exports.parseOrderDataString = (str) => {
    // console.log('String to parse: ', str);
    if (!str.length) {
        console.log('Empty string');
        return {};
    }
    const orderDataArray = str.split(';');
    if (!orderDataArray.length) {
        console.log('Empty array');
        return {};
    }
    // console.log('Splitted: ', orderDataArray);
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
        'Доставка',
        'Заказчик',
        'Дата согласования'
    ];
    return orderDataKeys.reduce((acc, key, index) => {
        if (!orderDataArray[index]) {
            return acc;
        }
        acc[key] = orderDataArray[index][0] === "\"" ? orderDataArray[index].slice(1, orderDataArray[index].length - 1) : orderDataArray[index];
        return acc;
    }, {});
};
var FileType;
(function (FileType) {
    FileType[FileType["Unknown"] = 0] = "Unknown";
    FileType[FileType["File"] = 1] = "File";
    FileType[FileType["Directory"] = 2] = "Directory";
    FileType[FileType["SymbolicLink"] = 3] = "SymbolicLink";
})(FileType || (FileType = {}));
//# sourceMappingURL=orders.js.map