import fs from "fs";
import { parser } from "stream-json";
import { streamArray } from "stream-json/streamers/stream-array.js";

console.log("parser:", typeof parser);
console.log("jsonParser:", typeof parser());
console.log("streamArray:", typeof streamArray);
console.log("arrayStream:", typeof streamArray());
