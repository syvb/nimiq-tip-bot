module.exports = function (address) {
  try {
    return "NQ" + address.split(/^.*?NQ/)[1]
     .match(/^NQ\d\d( ([A-z0-9]{4})){8}/)[0];
  } catch (e) {
    return null;
  }
};