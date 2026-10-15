import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const isBrowser = () => {
  return typeof window !== "undefined";
};

if (!isBrowser()) {
  //var HTMLCanvasElement = require("jsdom/lib/jsdom/living/generated/HTMLCanvasElement").implementation;
  //HTMLCanvasElement.prototype.getContext = function /(contextId: any) {
  //  return {};
  //};
  //    idlUtils = require("jsdom/lib/jsdom/living/generated/utils");
  /*
  HTMLCanvasElement.prototype.getContext = function (contextId: any) {
    const canvas = idlUtils.implForWrapper(this);
    if (canvas._canvasContext) {
      return canvas._canvasContext;
    }
    return {};
    const context = (canvas._canvasContext = new CanvasRenderingContext2D(
      canvas
    ));
    context.canvas = canvas;
    return context;
  };*/
}

export const shortenOnMobile = (str: string) => {
  let charLim = 23;
  if (str?.length >= charLim && isMobile()) {
    return str.substring(0, charLim - 3) + "...";
  }
  return str;
};
export const l = (m: any, caller = false) => {
  if (caller) {
    console.log(m);
    console.log(caller);
  } else {
    console.log(m);
  }
};

//https://dev.to/marinamosti/removing-duplicates-in-an-array-of-objects-in-js-with-sets-3fep
export const dedupeArrayOnId = (arr: any[]) => {
  return Array.from(new Set(arr.map((a: { id: any }) => a.id))).map((id) => {
    return arr.find((a: { id: unknown }) => a.id === id);
  });
};

declare global {
  interface Array<T> {
    last(o: T): Array<T>;
  }

  interface Math {
    toPrecision(num: number, precision: any): number;
    toRad(degrees: number): number;
    toDeg(radians: number): number;
  }

  interface Number {
    map(
      this: number,
      in_min: number,
      in_max: number,
      out_min: number,
      out_max: number
    ): number;
  }
}
Array.prototype.last = function () {
  return this[this.length - 1];
};

Math.toPrecision = (num: number, precision: any) => {
  let str = num.toFixed(precision);
  return parseFloat(str);
};

Math.toRad = function (degrees: number) {
  return (degrees * Math.PI) / 180;
};

Math.toDeg = function (radians: number) {
  return (radians * 180) / Math.PI;
};

Number.prototype.map = function (
  this: number,
  in_min: number,
  in_max: number,
  out_min: number,
  out_max: number
) {
  return ((this - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
};
export const map = function (
  n: number,
  start1: number,
  stop1: number,
  start2: number,
  stop2: number,
  withinBounds: any
) {
  const newval = ((n - start1) / (stop1 - start1)) * (stop2 - start2) + start2;
  if (!withinBounds) {
    return newval;
  }
  if (start2 < stop2) {
    return constrain(newval, start2, stop2);
  } else {
    return constrain(newval, stop2, start2);
  }
};

export const constrain = function (n: number, low: number, high: number) {
  return Math.max(Math.min(n, high), low);
};

export const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const formatDate = (
  d: {
    getMonth: () => number;
    getDate: () => any;
    getFullYear: () => string;
    toLocaleString: (
      arg0: string,
      arg1: { hour: string; minute: string; hour12: boolean }
    ) => string;
    getHours: () => any;
    getMinutes: () => any;
    getSeconds: () => any;
  },
  us = true
) => {
  let str;
  try {
    if (us) {
      str =
        monthNames[d.getMonth()] +
        " " +
        String(d.getDate()).padStart(2, "0") +
        ", " +
        d.getFullYear() +
        " " +
        d.toLocaleString("en-us", {
          hour: "numeric",
          minute: "numeric",
          hour12: true,
        });
    } else {
      str =
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0") +
        ":" +
        String(d.getHours()).padStart(2, "0") +
        "-" +
        String(d.getMinutes()).padStart(2, "0") +
        "-" +
        String(d.getSeconds()).padStart(2, "0");
    }
  } catch (e) {
    console.log((e as Error).message);
  }
  return str;
};

export const isMobile = () => {
  if (!isBrowser()) {
    return false;
  }
  if (navigator.userAgent.toLowerCase().match(/mobile/i)) {
    return true;
  } else {
    return false;
  }
};

export const isIPad = () => {
  if (typeof navigator === "undefined") {
    return false; // If `navigator` is not available (e.g., SSR)
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();

  if (
    /ipad/i.test(userAgent) ||
    (platform === "macintel" && navigator.maxTouchPoints > 1)
  ) {
    return true;
  }

  return false;
};

export const swapInArray = (
  arr: { [x: string]: any },
  index1: string | number,
  index2: string | number
) => {
  [arr[index1], arr[index2]] = [arr[index2], arr[index1]];
};

export const formatNumberWithCommas = (x: {
  toLocaleString: (arg0: string) => any;
}) => {
  return x.toLocaleString("en-US");
};

export const timeDifference = (then: number, now: number) => {
  const sec = 1000;
  const minute = sec * 60;
  const hour = minute * 60;
  const day = hour * 24;
  let timeDiff = Math.abs(now - then);
  const diffDays = String(Math.floor(timeDiff / day)).padStart(2, "0");

  timeDiff -= Number(diffDays) * day;
  const diffHours = String(Math.floor(timeDiff / hour)).padStart(2, "0");

  timeDiff -= Number(diffHours) * hour;
  const diffMinutes = String(Math.floor(timeDiff / minute)).padStart(2, "0");

  timeDiff -= Number(diffMinutes) * minute;
  const diffSeconds = String(Math.round(timeDiff / sec)).padStart(2, "0");

  return {
    days: diffDays,
    hours: diffHours,
    minutes: diffMinutes,
    seconds: diffSeconds,
  };
};

export const secondsToMins = (d: number) => {
  d = Number(d);
  //const h = Math.floor(d / 3600);
  const m = Math.floor((d % 3600) / 60);
  const s = Math.floor((d % 3600) % 60);

  //const hDisplay = h > 0 ? String(h).padStart(2, "0") + ":" : "";
  const mDisplay = m > 0 ? String(m).padStart(2, "0") + ":" : "00:";
  const sDisplay = s > 0 ? String(s).padStart(2, "0") : "00";
  return mDisplay + sDisplay;
};

export const delay = (milisec: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("");
    }, milisec);
  });
};

export const formatCurrency = (num: number, currency: string = "USD") => {
  return num.toLocaleString("en-US", {
    style: "currency",
    currency: currency,
  });
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isValidDate = (d: any) => {
  return d instanceof Date && !isNaN(d.getTime());
};
