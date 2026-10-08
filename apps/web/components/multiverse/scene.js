
// Scroll-driven scenes for the home page. Logic is Meena's original page script, unchanged except:
// it runs inside startScene(), every loop stops and every listener is removed on cleanup.
export function startScene(){
"use strict";
var alive=true,ac=new AbortController(),sig={signal:ac.signal},timers=[];

var FA=Array.from({length:185},function(_,i){return "/multiverse/frames/planets-gold-dust-timeline/"+String(i+1).padStart(3,"0")+".webp";});
var FB=Array.from({length:89},function(_,i){return "/multiverse/frames/asteroid-nebula-hero/"+String(i+1).padStart(3,"0")+".webp";});
var CUBE="/multiverse/nebula-cube.jpg";
var LOGO="/multiverse/avantra-logo-transparent.png";

var reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
var fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
var dpr=Math.min(1.25,window.devicePixelRatio||1);
var vw=innerWidth,vh=innerHeight;
function clamp(v,a,b){a=a===undefined?0:a;b=b===undefined?1:b;return Math.min(b,Math.max(a,v));}
function lerp(a,b,t){return a+(b-a)*t;}
function easeIO(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
function easeO(t){return 1-Math.pow(1-t,3);}
function win(p,a,b,f){f=f||.05;return clamp((p-a)/f)*clamp((b-p)/f);}
function $(id){return document.getElementById(id);}

if('scrollRestoration' in history)history.scrollRestoration='manual';
scrollTo(0,0);
document.documentElement.style.overflow='hidden';

/* ---------- preload with real progress ---------- */
var total=FA.length+FB.length+1,done=0,loaded=false,imA=[],imB=[];
function loadImg(src){return new Promise(function(res){var i=new Image();i.onload=i.onerror=function(){done++;res(i);};i.src=src;});}
Promise.all([Promise.all(FA.map(loadImg)),Promise.all(FB.map(loadImg)),loadImg(CUBE)]).then(function(r){imA=r[0];imB=r[1];loaded=true;});
timers.push(setTimeout(function(){loaded=true;},15000));

var pre=$('pre'),pn=$('pn'),plogo=$('plogo'),shown=0,introStart=0,started=false;
(function preTick(){
  if(!alive)return;
  var target=loaded?100:Math.min(96,done/total*100);
  shown+=(target-shown)*.12;if(loaded&&shown>99.4)shown=100;
  pn.textContent=Math.round(shown);
  plogo.style.clipPath='inset(0 '+(100-shown)+'% 0 0)';
  if(shown>=100){
    timers.push(setTimeout(function(){
      if(!alive)return;
      pre.classList.add('done');
      document.documentElement.style.overflow='';
      introStart=performance.now()+(reduce?0:500);
      start();
    },320));
  }else if(alive)requestAnimationFrame(preTick);
})();

/* ---------- landscape cover renderer with pan ---------- */
function drawCover(ctx,img,cw,ch,px,py){
  var iw=img.naturalWidth,ih=img.naturalHeight;if(!iw)return;
  var s=Math.max(cw/iw,ch/ih),sw=cw/s,sh=ch/s;
  ctx.drawImage(img,(iw-sw)*px,(ih-sh)*py,sw,sh,0,0,cw,ch);
}
function Stage(cv,frames){this.cv=cv;this.cx=cv.getContext('2d');this.frames=frames;this.lf=-9;this.lp=-9;this.cw=2;this.ch=2;}
Stage.prototype.resize=function(){
  this.cw=this.cv.width=Math.max(2,Math.round(this.cv.clientWidth*dpr));
  this.ch=this.cv.height=Math.max(2,Math.round(this.cv.clientHeight*dpr));
  this.cx.imageSmoothingEnabled=true;this.cx.imageSmoothingQuality='high';this.lf=-9;
};
Stage.prototype.draw=function(f,py,px){
  var n=this.frames.length;if(!n)return;
  f=clamp(f,0,n-1);px=px===undefined?.5:px;
  if(Math.abs(f-this.lf)<.002&&Math.abs(py-this.lp)<.0004)return;
  this.lf=f;this.lp=py;
  var i=Math.floor(f),j=Math.min(i+1,n-1),a=f-i,cx=this.cx;
  cx.globalAlpha=1;drawCover(cx,this.frames[i],this.cw,this.ch,px,py);
  if(a>.02&&j!==i){cx.globalAlpha=a;drawCover(cx,this.frames[j],this.cw,this.ch,px,py);cx.globalAlpha=1;}
};
function panAt(pts,t){
  for(var i=0;i<pts.length-1;i++){
    if(t<=pts[i+1][0]){var k=clamp((t-pts[i][0])/(pts[i+1][0]-pts[i][0]));return lerp(pts[i][1],pts[i+1][1],k);}
  }
  return pts[pts.length-1][1];
}
/* where the camera looks in the tall footage as time passes */
var PAN_A=[[0,.32],[.5,.5],[1,.68]];
var PAN_B=[[0,.12],[1,.88]];

/* ---------- elements ---------- */
var hero=$('hero'),hwrap=$('hwrap'),warp=$('warp'),wg=warp.getContext('2d');
var hl=$('hl'),hlimg=$('hlimg'),htag=$('htag'),cue=$('cue');
var b1=$('b1'),b2=$('b2'),b3=$('b3'),finalEl=$('final'),flogo=$('flogo'),scrimL=$('scrimL');
var say=$('say'),sayp=$('sayp'),cube=$('cube'),cubewrap=$('cubewrap'),cubecap=$('cubecap');
var realms=$('realms'),track=$('track'),city=$('city'),fin=$('fin'),flog=$('flog'),sbar=$('sbar');
var heroStage,cityStage,realmStage;

/* statement words */
var words=[],KEY={science:1,technology:1,projects:1,built:1,schools:1};
(function(){
  var txt=sayp.textContent.trim().split(/\s+/);sayp.textContent='';
  txt.forEach(function(w,i){
    var s=document.createElement('span');s.className='w'+(KEY[w.replace(/[^a-z]/gi,'').toLowerCase()]?' k':'');s.textContent=w;
    sayp.appendChild(s);if(i<txt.length-1)sayp.appendChild(document.createTextNode(' '));
    words.push(s);
  });
})();

/* cube shards */
var shards=[];
(function(){
  var C=9,R=4,seed=7;
  function rnd(){seed=(seed*16807)%2147483647;return (seed-1)/2147483646;}
  cubewrap.style.setProperty('--img','url("'+CUBE+'")');
  for(var r=0;r<R;r++)for(var c=0;c<C;c++){
    var d=document.createElement('div');d.className='shard';
    d.style.left=(c/C*100)+'%';d.style.top=(r/R*100)+'%';
    d.style.width=(100/C+.15)+'%';d.style.height=(100/R+.25)+'%';
    d.style.backgroundSize=(C*100)+'% '+(R*100)+'%';
    d.style.backgroundPosition=(c/(C-1)*100)+'% '+(r/(R-1)*100)+'%';
    cubewrap.appendChild(d);
    shards.push({el:d,x:(rnd()-.5)*1500,y:(rnd()-.5)*900,z:(rnd()-.2)*900,rz:(rnd()-.5)*160,rx:(rnd()-.5)*120,delay:rnd()*.35});
  }
})();

/* section metrics + veils (soft fade between sections) */
var secs=[];
['hero','say','cube','realms','city'].forEach(function(id){
  var el=$(id),v=document.createElement('div');v.className='veil';v.setAttribute('aria-hidden','true');
  el.querySelector('.stick').appendChild(v);
  secs.push({id:id,el:el,veil:v,top:0,h:0,vo:-1});
});
function S(id){for(var i=0;i<secs.length;i++)if(secs[i].id===id)return secs[i];}
var realmDist=0,cards=[],finTop=0;
function layout(){
  vw=innerWidth;vh=innerHeight;
  heroStage.resize();cityStage.resize();realmStage.resize();
  warp.width=Math.round(vw*dpr);warp.height=Math.round(vh*dpr);
  realmDist=Math.max(0,track.scrollWidth-vw);
  realms.style.height=(vh+realmDist*1.1)+'px';
  secs.forEach(function(s){var r=s.el.getBoundingClientRect();s.top=r.top+scrollY;s.h=r.height;});
  finTop=fin.getBoundingClientRect().top+scrollY;
  cards=[].map.call(track.querySelectorAll('.realm'),function(c){return {el:c,cx:c.offsetLeft+c.offsetWidth/2,art:c.querySelector('.art'),last:null};});
}
function prog(s){return clamp((sy-s.top)/Math.max(1,s.h-vh));}

/* ---------- warp streaks ---------- */
var streaks=[];for(var q=0;q<150;q++)streaks.push({a:Math.random()*6.2832,r:Math.random(),v:.5+Math.random()*.9,h:Math.random()});
function drawWarp(I){
  var W=warp.width,H=warp.height;wg.clearRect(0,0,W,H);
  if(I<.02)return;
  var cx=W/2,cy=H*.48,M=Math.hypot(cx,cy);
  wg.lineCap='round';
  for(var i=0;i<streaks.length;i++){
    var s=streaks[i];s.r+=.0035*s.v*(1+I*5);
    if(s.r>1){s.r=Math.random()*.05;s.a=Math.random()*6.2832;}
    var r0=s.r*M,r1=r0+M*.02+M*.3*I*s.r*s.v,ca=Math.cos(s.a),sa=Math.sin(s.a);
    wg.globalAlpha=clamp(s.r*1.6)*I*.9;
    wg.strokeStyle=s.h>.7?'#9fd4ff':(s.h>.4?'#ffffff':'#ffd9a0');
    wg.lineWidth=(1+s.r*2)*dpr;
    wg.beginPath();wg.moveTo(cx+ca*r0,cy+sa*r0);wg.lineTo(cx+ca*r1,cy+sa*r1);wg.stroke();
  }
  wg.globalAlpha=1;
}

/* ---------- main loop: scroll is eased, then everything reads the eased value ---------- */
var raw=0,sy=0,lastNow=0,panA=.5,panB=.05,totalH=1;
function setO(el,o){var v=Math.round(o*1000)/1000;if(el._o!==v){el._o=v;el.style.opacity=v;}}
function frame(now){
  if(!alive)return;
  var dt=Math.min(.05,(now-lastNow)/1000||.016);lastNow=now;
  raw=scrollY;
  if(reduce)sy=raw;else{sy+=(raw-sy)*(1-Math.exp(-dt*9));if(Math.abs(raw-sy)<.05)sy=raw;}
  var speed=Math.abs(raw-sy);

  sbar.style.transform='scaleX('+clamp(sy/Math.max(1,totalH-vh))+')';

  /* section veils */
  for(var v=0;v<secs.length;v++){
    var s=secs[v],e=clamp((sy+vh-s.top)/(vh*.9)),x=clamp((sy+vh-(s.top+s.h))/vh);
    var o=Math.max(1-easeO(e),x*x*.92);setO(s.veil,o);
  }

  /* ----- HERO ----- */
  var H=S('hero'),hp=prog(H);
  var it=reduce?(introStart?1:0):(introStart?clamp((now-introStart)/2200):0);
  var open=easeIO(clamp(it/.55)),lr=easeO(clamp((it-.4)/.6));
  hwrap.style.clipPath='inset('+(46*(1-open))+'% 0 '+(46*(1-open))+'% 0)';
  var wz=win(hp,.08,.66,.12);
  hwrap.style.transform='scale('+(lerp(1.14,1,open)+wz*.035)+')';
  var f=clamp(hp/.9)*(FA.length-1);
  var tgtA=panAt(PAN_A,clamp(hp/.9));panA=reduce?tgtA:panA+(tgtA-panA)*(1-Math.exp(-dt*7));
  heroStage.draw(f,.5,panA);

  var out=easeIO(clamp((hp-.005)/.13));
  hl.style.transform='translate(-50%,-50%) scale('+(1+out*2)+')';
  hl.style.filter=out>.01?'blur('+(out*12)+'px)':'none';
  setO(hl,(1-out)*clamp(lr*3));
  hlimg.style.clipPath='inset(0 '+((1-lr)*100)+'% 0 0)';
  htag.style.opacity=clamp((lr-.5)*2);
  setO(cue,clamp(1-hp/.03)*clamp((it-.8)*5));

  function beat(el,a,b){
    var o=win(hp,a,b,.05);setO(el,o);
    el.style.transform='translate3d(0,'+((1-o)*34)+'px,0)';el.style.filter=o<.98?'blur('+((1-o)*8)+'px)':'none';
  }
  beat(b1,.14,.31);beat(b2,.35,.51);
  var o3=win(hp,.53,.67,.05);setO(b3,o3);
  b3.style.transform='translate3d(-50%,-50%,0) scale('+lerp(.84,1.16,clamp((hp-.52)/.16))+')';
  b3.style.filter=o3<.98?'blur('+((1-o3)*10)+'px)':'none';

  var fo=easeO(clamp((hp-.88)/.09));
  setO(finalEl,fo);finalEl.style.transform='translate3d(0,'+((1-fo)*26)+'px,0)';
  finalEl.style.pointerEvents=fo>.6?'auto':'none';
  flogo.style.clipPath='inset(0 '+((1-fo)*100)+'% 0 0)';
  scrimL.style.opacity=fo;


  /* ----- STATEMENT ----- */
  var sp=prog(S('say')),lit=sp*1.15*words.length;
  for(var w=0;w<words.length;w++){
    var on=w<lit;if(on!==words[w]._on){words[w]._on=on;words[w].classList.toggle('on',on);}
  }

  /* ----- CUBE ----- */
  var cp=prog(S('cube')),asm=easeO(clamp(cp/.5));
  for(var k=0;k<shards.length;k++){
    var Sh=shards[k],a=clamp((asm-Sh.delay*.6)/(1-Sh.delay*.6)),inv=1-easeO(a);
    Sh.el.style.transform='translate3d('+(Sh.x*inv)+'px,'+(Sh.y*inv)+'px,'+(Sh.z*inv)+'px) rotateZ('+(Sh.rz*inv)+'deg) rotateX('+(Sh.rx*inv)+'deg)';
    Sh.el.style.opacity=clamp(a*2.4);
  }
  var turn=easeIO(clamp((cp-.5)/.5));
  cubewrap.style.transform='rotateY('+lerp(-9,9,turn)+'deg) rotateX('+lerp(4,-3,turn)+'deg) scale('+lerp(.9,1.05,easeIO(clamp(cp/.9)))+')';
  var co=easeO(clamp((cp-.46)/.18));
  setO(cubecap,co);cubecap.style.transform='translate3d(0,'+((1-co)*30)+'px,0)';

  /* ----- REALMS ----- */
  var rr=clamp((prog(S('realms'))-.04)/.9),tx=-realmDist*rr;
  track.style.transform='translate3d('+tx+'px,0,0)';
  for(var c=0;c<cards.length;c++){
    var off=(cards[c].cx+tx-vw/2)/vw,sh=Math.round(-off*70);
    if(cards[c].art&&cards[c].last!==sh){cards[c].last=sh;cards[c].art.style.transform='translate3d('+sh+'px,0,0)';}
  }
  var n=FB.length-1,tt=(now*.011)%(2*n),pf=tt<n?tt:2*n-tt;
  realmStage.draw(pf,.5,.5+.5*Math.sin(now*.0005-1));

  /* ----- CITY ----- */
  var yp=prog(S('city'));
  var tgtB=panAt(PAN_B,clamp(yp/.92));panB=reduce?tgtB:panB+(tgtB-panB)*(1-Math.exp(-dt*7));
  cityStage.draw(clamp(yp/.92)*n,.5,panB);
  $('c1').style.transform='translate3d(0,'+((1-easeO(clamp(yp/.16)))*108)+'%,0)';
  $('c2').style.transform='translate3d(0,'+((1-easeO(clamp((yp-.05)/.16)))*108)+'%,0)';
  var f3=easeO(clamp((yp-.2)/.14)),f4=easeO(clamp((yp-.28)/.14)),e3=$('c3'),e4=$('c4');
  setO(e3,f3);e3.style.transform='translate3d(0,'+((1-f3)*24)+'px,0)';
  setO(e4,f4);e4.style.transform='translate3d(0,'+((1-f4)*24)+'px,0)';

  /* ----- FOOTER logo ----- */
  var ft=easeO(clamp((sy+vh-finTop)/(vh*1.2)));
  flog.style.transform='translate3d(0,'+((1-ft)*70)+'px,0) rotate('+((1-ft)*-5)+'deg) scale('+lerp(.9,1,ft)+')';
  setO(flog,ft);

  if(alive)requestAnimationFrame(frame);
}

/* ---------- cursor lens + card tilt ---------- */
var lens=$('lens');
if(fine){
  var lx=-100,ly=-100,lxT=-100,lyT=-100;
  addEventListener('pointermove',function(e){lxT=e.clientX;lyT=e.clientY;lens.classList.add('on');},sig);
  document.documentElement.addEventListener('mouseleave',function(){lens.classList.remove('on');},sig);
  (function lt(){if(!alive)return;lx+=(lxT-lx)*.22;ly+=(lyT-ly)*.22;lens.style.transform='translate3d('+lx+'px,'+ly+'px,0)';if(alive)requestAnimationFrame(lt);})();
  document.querySelectorAll('[data-hover],.btn,.realm').forEach(function(el){
    el.addEventListener('pointerenter',function(){lens.classList.add('big');},sig);
    el.addEventListener('pointerleave',function(){lens.classList.remove('big');},sig);
  });
  if(!reduce)document.querySelectorAll('.realm').forEach(function(card){
    card.addEventListener('pointermove',function(e){
      var r=card.getBoundingClientRect(),px=(e.clientX-r.left)/r.width-.5,py=(e.clientY-r.top)/r.height-.5;
      card.style.transform='perspective(900px) rotateY('+(px*8)+'deg) rotateX('+(-py*8)+'deg)';
    },sig);
    card.addEventListener('pointerleave',function(){card.style.transform='';},sig);
  });
}

/* ---------- boot ---------- */
function start(){
  if(started)return;started=true;
  heroStage=new Stage($('hfg'),imA);
  cityStage=new Stage($('cfg'),imB);
  realmStage=new Stage($('rcity'),imB);
  layout();
  totalH=document.documentElement.scrollHeight;
  var rt;addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(function(){layout();totalH=document.documentElement.scrollHeight;},120);timers.push(rt);},sig);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){if(!alive)return;layout();totalH=document.documentElement.scrollHeight;});
  addEventListener('load',function(){layout();totalH=document.documentElement.scrollHeight;},sig);
  sy=scrollY;lastNow=performance.now();
  requestAnimationFrame(frame);
}

return function stop(){
  alive=false;ac.abort();timers.forEach(clearTimeout);
  document.documentElement.style.overflow='';
  if('scrollRestoration' in history)history.scrollRestoration='auto';
};
}
