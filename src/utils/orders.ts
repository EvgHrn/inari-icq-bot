export {};

const qs = require('qs');
const fetch = require('node-fetch');

module.exports.getOrdersFromFtp = async (periodDays: number, st: string) => {

  const queue = qs.stringify({
    "periodDays": periodDays,
    "st": st
  });

  const url = `${process.env.ORDERSWORKER_ADDR}getOrdersNumbersListByPeriod?${queue}`;

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
    console.error("getOrders error: ", e);
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

module.exports.getOrderFileModifiedAtStr = async(orderNumber: number, st: string): Promise<string> => {
  const queue = qs.stringify({
    "st": st,
    "orderNumber": orderNumber
  });

  const url = `${process.env.ORDERSWORKER_ADDR}getOrderFileModifiedAtStr?${queue}`;

  try {
    return await fetch(url)
      .then((response: any) => {
        // console.log("Order ModifiedAtStr response: ", response);
        return response.text();
      })
      .then((text: string) => {
        console.log("Order ModifiedAtStr: ", text);
        return text;
      });
  } catch (e) {
    console.error("getOrderFileModifiedAtStr error: ", e);
    return '';
  }
};