export default function formatDecimals(objArray, round = false) {
  objArray.forEach(obj => {
    if (!round) {
      Object.keys(obj).forEach(key => {
        obj[key] = Number(obj[key]).toFixed(2);
      });
    } else {
      Object.keys(obj).forEach(key => {
        obj[key] = Number(Math.round(obj[key]));
      });
    }
  })

}
