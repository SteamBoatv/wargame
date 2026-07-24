'use strict';
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const rand=(a,b)=>a+Math.random()*(b-a);
const TAU=Math.PI*2;
const EMOJI_FONT='"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
const em=s=>s+'px '+EMOJI_FONT;
const ASSETS={img:{}};
