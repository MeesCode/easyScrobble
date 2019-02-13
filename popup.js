const API_URL = 'http://ws.audioscrobbler.com/2.0/';
const COOKIE_LOCATION = 'https://www.last.fm/api';

let scrobbleData;
let buttonElement;

let getUrl = browser.tabs.query({
  currentWindow: true, 
  active: true
});

let getCookie = (name => {
  return browser.cookies.get({ 
    url: COOKIE_LOCATION,
    name: name
  });
});

let removeCookie = (name => {
  browser.cookies.remove({ 
    url: COOKIE_LOCATION,
    name: name
  });
});

let setCookie = ((name, value, expirationDate) => {
  browser.cookies.set({ 
    url: COOKIE_LOCATION,
    name: name,
    value: value,
    expirationDate: expirationDate,
    secure: true
  });
});

document.addEventListener('DOMContentLoaded', () => {

  buttonElement = document.getElementById('button');

  Promise.all([getUrl, getCookie('easyToken'), getCookie('easySession')]).then(values => {
    let url = values[0][0].url;
    let token = (values[1]) ? values[1].value : null;
    let session = (values[2]) ? values[2].value : null;
    let info = url.replace(/\+/g, ' ').split('/');

    let album_page = info[2] == 'www.last.fm' && info[3] == 'music' && info[5] != undefined && info[4] != undefined && info[6] == undefined;
    let song_page = info[2] == 'www.last.fm' && info[3] == 'music' && info[5] != undefined && info[4] != undefined && info[6] != undefined && info[7] == undefined;

    if(album_page) buttonElement.innerHTML = 'scrobble this album';
    if(song_page) buttonElement.innerHTML = 'scrobble this song';

    if(album_page || song_page){
      loadPoppup(info, album_page, song_page);
    } else {
      buttonElement.innerHTML = 'can\'t scrobble from this page';
      buttonElement.style.backgroundColor = 'DarkGray';
      buttonElement.style.cursor = 'auto';
    } 
    if(!(token || session)) {
      buttonElement.innerHTML = 'log in to last.fm';
    }

    buttonElement.addEventListener('click', () => {
      if(!session && !token){
        getToken();
      } else if(!session && token){
        getSession();
      } else if(album_page || song_page){
        scrobble();
      }
    });
  });
});

function showInfo(){
  let infoElement = document.getElementById('info');
  let picElement = document.getElementById('album_pic');
  picElement.src = (scrobbleData.album) ? scrobbleData.album.image[2]['#text'] : scrobbleData.track.album.image[2]['#text'];
  
  if(scrobbleData.album) {
    infoElement.innerHTML = `Artist: ${scrobbleData.album.artist} <br/>Album: ${scrobbleData.album.name}`;
  } else {
    infoElement.innerHTML = `Artist: ${scrobbleData.track.artist.name} <br/>Album: ${scrobbleData.track.album.title} <br/>Track: ${scrobbleData.track.name}`;
  }
}

function loadPoppup(info, album_page){
  let request = new Object();
  request.artist = info[4].replace('&', '%26');
  request.album = info[5].replace('&', '%26');
  request.track = (info[6]) ? info[6].replace('&', '%26') : null;
  let reqURL;

  if(album_page){
    reqURL = `${API_URL}?method=album.getinfo&api_key=${API_KEY}&artist=${request.artist}&album=${request.album}&format=json`;
  } else { 
    reqURL = `${API_URL}?method=track.getinfo&api_key=${API_KEY}&artist=${request.artist}&track=${request.track}&format=json`;
  }

  fetch(reqURL).then(response => {
    if(response.status == 200){
      response.json().then(data => {
        scrobbleData = data;
        showInfo();
      });
    }
  });
}

function getToken(){
  let sig = `api_key${API_KEY}methodauth.getTokentoken${SERCRET}`;
  sig = MD5(sig);

  let reqURL = `${API_URL}?method=auth.getToken&api_key=${API_KEY}&api_sig=${sig}&format=json`;

  fetch(reqURL).then(response => {
    response.json().then(data => {
      if (response.status == 200){
        browser.tabs.create({url: 'https://www.last.fm/api/auth/?api_key=' + API_KEY + '&token=' + data.token});
        setCookie('easyToken', data.token);
      }
    });
  });
}

function getSession(){
  getCookie('easyToken').then(tokenCookie => {

    let token = tokenCookie.value;

    let sig = `api_key${API_KEY}methodauth.getSessiontoken${token}${SERCRET}`;
    sig = MD5(sig);

    let reqURL = `${API_URL}?method=auth.getSession&token=${token}&api_key=${API_KEY}&api_sig=${sig}&format=json`;

    fetch(reqURL).then(response => {
      if(response.status == 403){
        removeCookie('easyToken');
        buttonElement.innerHTML = 'close and try again';
        return;
      }
      if (response.status == 200){
        response.json().then(data => {
          setCookie('easySession', data.session.key, 2147483647);
          scrobble();
        });
      }
    });
  });
}

function scrobble(){
  getCookie('easySession').then(sessionCookie => {
    let session = sessionCookie.value;

    let time = new Date();
    let utracks = new Object();
    
    if(scrobbleData.album){
      for(let i = 0; i < scrobbleData.album.tracks.track.length; i++){
        utracks[`artist[${i}]`] = scrobbleData.album.tracks.track[i].artist.name;
        utracks[`album[${i}]`] = scrobbleData.album.name;
        utracks[`track[${i}]`] = scrobbleData.album.tracks.track[i].name;
        utracks[`timestamp[${i}]`] = Math.round(time.getTime()/1000);
      }
    } else {
      utracks[`artist[0]`] = scrobbleData.track.artist.name;
      utracks[`album[0]`] = scrobbleData.track.album.title;
      utracks[`track[0]`] = scrobbleData.track.name;
      utracks[`timestamp[0]`] = Math.round(time.getTime()/1000);
    }

    utracks['sk'] = session;
    utracks['api_key'] = API_KEY;
    utracks['method'] = 'track.scrobble';

    let otracks = new Object();
    Object.keys(utracks).sort().forEach((key) => {
      otracks[key] = utracks[key];
    });

    let sig = '';
    for(let i = 0; i < Object.keys(otracks).length; i++){
      sig += Object.keys(otracks)[i] + otracks[Object.keys(otracks)[i]];
    }
    sig = MD5(sig + SERCRET);

    otracks['api_sig'] = sig;
    otracks['format'] = 'json';

    let req = '';
    for(let i = 0; i < Object.keys(otracks).length; i++){
      if(i > 0){
        req += '&';
      }
      req += Object.keys(otracks)[i] + '=' + encodeURIComponent(otracks[Object.keys(otracks)[i]]);
    }

    fetch(API_URL, {
      method: 'post',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: req
    }).then(response => {
      if(response.status != 200){
        buttonElement.innerHTML = 'failed to scrobble';
        return;
      }
      response.json().then(data => {
        let amount = data.scrobbles['@attr'].accepted;
        if(amount != 0){
          buttonElement.innerHTML = `${amount} track${(amount) > 1 ? 's' : ''} scrobbled`;
          buttonElement.style.backgroundColor = '#00b93e';
        } else {
          buttonElement.innerHTML = 'no songs found (blame last.fm)';
        }
      });
    });
  });
}
