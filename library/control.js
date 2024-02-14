// BAIDU STAT
var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?295a33a31d3555dabfe9c1da347a8c2d";
  var s = document.getElementsByTagName("script")[0]; 
  s.parentNode.insertBefore(hm, s);
})();

//MICROSOFT STAT
(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "g47dnq5z8s");

//SAFE
window.onkeydown =
  window.onkeyup =
  window.onkeypress =
    function (event) {
      // 判断是否按下F12，F12键码为123
      if (event.keyCode == 123) {
        event.preventDefault(); // 阻止默认事件行为
        window.event.returnValue = false;
      }
    };
document.onselectstart = function (event) {
  if (window.event) {
    event = window.event;
  }
  try {
    var the = event.srcElement;
    if (
      !(
        (the.tagName == "INPUT" && the.type.toLowerCase() == "text") ||
        the.tagName == "TEXTAREA"
      )
    ) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
};
document.oncopy = function (event) {
  if (window.event) {
    event = window.event;
  }
  try {
    var the = event.srcElement;
    if (
      !(
        (the.tagName == "INPUT" && the.type.toLowerCase() == "text") ||
        the.tagName == "TEXTAREA"
      )
    ) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
};
document.oncut = function (event) {
  if (window.event) {
    event = window.event;
  }
  try {
    var the = event.srcElement;
    if (
      !(
        (the.tagName == "INPUT" && the.type.toLowerCase() == "text") ||
        the.tagName == "TEXTAREA"
      )
    ) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
};