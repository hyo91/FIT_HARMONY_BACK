// UTIL 기능 소스 작성

// String Format 02d
// ex) pad(6, 2); => '06'
// ex) pad(6, 3); => '006'
// ex) pad(6, 4); => '0006'
export function pad(n, width){
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
}
