
const API_URL = "http://ws.audioscrobbler.com/2.0/";

var album;
var lastfm = false;

function getCurrentTabUrl(callback) {
  var queryInfo = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.query(queryInfo, function(tabs) {
    var tab = tabs[0];
    var url = tab.url;

    callback(url);
  });
}

function removePlusses(url, callback){
  url = url.replace(/\+/g, " ");
  callback(url);
}

function showInfo(info){
  var infoElement = document.getElementById("info");
  var picElement = document.getElementById("album_pic");
  picElement.src = info.album.image[2]["#text"];
  infoElement.innerHTML = "Artist: " + info.album.artist
                    + "<br/>Album: " + info.album.name;
}

document.addEventListener('DOMContentLoaded', function() {
  //document.cookie = "session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  //document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  getCurrentTabUrl(function(url) {
    removePlusses(url, function(url){

      if(!hasTokenCookie()){
        document.getElementById("button").innerHTML = "log in to last.fm";
      }

      var info = url.split("/");
      if((info[2] != "www.last.fm" || info[3] != "music" || info[5] == undefined || info[4] == undefined) && hasTokenCookie()){
        document.getElementById("button").innerHTML = "not a last.fm album page";
        document.getElementById("button").style.backgroundColor = "DarkGray";
        document.getElementById("button").style.cursor = "not-allowed";
      } else {
        lastfm = true;
        var request = new Object();
        request.artist = info[4];
        request.album = info[5];
        request.format = "json";
        request.method = "album.getinfo";
        var xhr = new XMLHttpRequest();
        xhr.responseType = "json";

        xhr.onreadystatechange = function() {
          if (xhr.readyState == 4){
            album = xhr.response.album;
            showInfo(xhr.response);
          }
        }

        var reqURL = API_URL
          + "?method=" + request.method
          + "&api_key=" + API_KEY
          + "&artist=" + request.artist
          + "&album=" + request.album
          + "&format=" + request.format;
        xhr.open("GET", reqURL, true);
        xhr.send("");
      }
    });
  });
});

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById("button").addEventListener("click", function(){
    if(lastfm){
      if(hasSessionCookie()){
        scrobble();
      } else {
        if(!hasTokenCookie()){
          getToken();
        } else {
          getSession();
        }
      }
    }
  });
});

function hasTokenCookie(){
  if(getCookie("token") == undefined){
    return false;
  }
  return true;
}

function hasSessionCookie(){
  if(getCookie("session") == undefined){
    return false;
  }
  return true;
}

function getCookie(name) {
  var value = "; " + document.cookie;
  var parts = value.split("; " + name + "=");
  if (parts.length == 2) return parts.pop().split(";").shift();
}

function getToken(){
  var sig = "api_key" + API_KEY + "method" + "auth.getToken" + "token" + SERCRET;
  sig = MD5(sig);
  var xhr = new XMLHttpRequest();
  xhr.responseType = "json";

  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4){
      window.open("http://www.last.fm/api/auth/?api_key=" + API_KEY + "&token=" + xhr.response.token);
      document.cookie = "token=" + xhr.response.token + "; expires=Fri, 31 Dec 9999 23:59:59 GMT";
    }
  }

  var reqURL = API_URL + "?method=auth.getToken&api_key=" + API_KEY + "&api_sig=" + sig + "&format=json";

  xhr.open("GET", reqURL, true);
  xhr.send("");
}

function getSession(){

  var token = getCookie("token");

  var xhr = new XMLHttpRequest();
  xhr.responseType = "json";

  var sig = "api_key" + API_KEY + "method" + "auth.getSession" + "token" + token + SERCRET;
  sig = MD5(sig);

  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4){
      document.cookie = "session=" + xhr.response.session.key + "; expires=Fri, 31 Dec 9999 23:59:59 GMT";
      scrobble();
    }
  }

  var reqURL = API_URL + "?method=auth.getSession&token=" + token + "&api_key=" + API_KEY + "&api_sig=" + sig + "&format=json";

  xhr.open("GET", reqURL, true);
  xhr.send("");

}

function scrobble(){
  var xhr = new XMLHttpRequest();

  /*xhr.onreadystatechange = function() {
    console.log(xhr.response);
  }*/

  var time = new Date();
  var utracks = {};
  for(var i = 0; i < album.tracks.track.length; i++){
    utracks["artist[" + i + "]"] = album.tracks.track[i].artist.name;
    utracks["album[" + i + "]"] = album.name;
    utracks["track[" + i + "]"] = album.tracks.track[i].name;
    utracks["timestamp[" + i + "]"] = Math.round(time.getTime()/1000);
  }

  utracks["sk"] = getCookie("session");
  utracks["api_key"] = API_KEY;
  utracks["method"] = "track.scrobble";

  otracks = {};
  Object.keys(utracks).sort().forEach(function(key) {
    otracks[key] = utracks[key];
  });

  var sig = "";
  for(var i = 0; i < Object.keys(otracks).length; i++){
    sig += Object.keys(otracks)[i] + otracks[Object.keys(otracks)[i]];
  }
  sig = MD5(sig + SERCRET);

  otracks["api_sig"] = sig;

  var req = "";
  for(var i = 0; i < Object.keys(otracks).length; i++){
    if(i > 0){
      req += "&";
    }
    req += Object.keys(otracks)[i] + "=" + encodeURIComponent(otracks[Object.keys(otracks)[i]]);
  }

  xhr.open("POST", API_URL, true);
  xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
  xhr.send(req);
}
