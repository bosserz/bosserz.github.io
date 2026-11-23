(() => {
  'use strict';
  const {lanes,events}=window.HISTORY_DATA;
  const $=id=>document.getElementById(id);
  const timeline=$('timeline'),picker=$('time-window'),slider=$('year-slider');
  const windows=[[-3000,2000],[-3000,-500],[-500,500],[500,1000],[1000,1600],[1600,1900],[1900,2000]];
  const regions=[['China','East Asia'],['Japan','East Asia'],['India','South Asia'],['Thailand','Central mainland Southeast Asia'],['West Asia','Mesopotamia & Iran'],['Egypt','Northeast Africa'],['Europe','Europe & the Mediterranean'],['West Africa','The western Sahel'],['Mexico','Mexico & Central America'],['The Andes','Peru & neighboring regions']];
  const ordinal=y=>y<0?y+1:y;
  const date=y=>`${Math.abs(y)} ${y<0?'BCE':'CE'}`;
  let state={window:4,year:1350},focus=null;
  try{const saved=JSON.parse(localStorage.getItem('history-atlas-v2'));if(saved&&Number.isInteger(saved.window)&&windows[saved.window]&&Number.isInteger(saved.year)&&saved.year!==0){state.window=saved.window;const[a,b]=windows[state.window];state.year=Math.max(a,Math.min(b,saved.year));}}catch{}
  const save=()=>{try{localStorage.setItem('history-atlas-v2',JSON.stringify(state));}catch{}};
  const node=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;};
  const dates=p=>`${p[3]?'c. ':''}${date(p[0])}–${p[1]===2001?'2000 CE (display limit)':date(p[1])}`;
  const current=p=>p[0]<=state.year&&state.year<p[1];
  function showFocus(){
    const event=events.filter(e=>e[0]<=state.year).at(-1)||events[0];
    const f=focus||{label:'WORLD CONTEXT',title:event[1],date:date(event[0]),description:event[2]};
    $('focus-label').textContent=f.label;
    $('focus-title').replaceChildren(document.createTextNode(f.title+' '),node('span','',f.date));
    $('focus-description').textContent=f.description;
  }
  function chooseYear(y,chosenFocus){const key=document.activeElement?.dataset?.key;state.year=y||1;focus=chosenFocus||null;render();if(key)timeline.querySelector(`[data-key="${key}"]`)?.focus({preventScroll:true});save();$('timeline-announcement').textContent=`Comparing ${date(state.year)} across ten regions.`;}
  function render(){
    const [a,b]=windows[state.window],span=ordinal(b)-ordinal(a);
    const pos=y=>(ordinal(y)-ordinal(a))/span*100;
    picker.value=state.window;slider.min=a;slider.max=b;slider.value=state.year;slider.setAttribute('aria-valuetext',date(state.year));slider.style.setProperty('--progress',`${pos(state.year)}%`);
    $('selected-year').textContent=Math.abs(state.year);$('selected-era').textContent=state.year<0?'BCE':'CE';
    const label=a<0&&b>0?`${date(a)}–${date(b)}`:`${Math.abs(a)}–${Math.abs(b)} ${b<0?'BCE':'CE'}`;
    $('range-caption').textContent=label;$('timeline-heading').textContent=label;
    const activeCount=lanes.filter(l=>l.periods.some(current)).length;
    $('moment-summary').textContent=`${activeCount} countries and regions, seen at the same time.`;
    showFocus();timeline.replaceChildren();
    const mobile=window.innerWidth<=700;
    const trackWidth=Math.max(150,timeline.clientWidth-(mobile?36:(window.innerWidth<=1000?236:278)));
    const tickCount=trackWidth<400?2:4;
    const ticks=Array.from({length:tickCount+1},(_,i)=>i===0?a:i===tickCount?b:(Math.round(a+(b-a)*i/tickCount)||1));
    function grid(track){ticks.forEach(t=>{const l=node('span','grid-line');l.style.left=pos(t)+'%';track.append(l);});const line=node('span','year-line');line.style.left=`${pos(state.year)}%`;track.append(line);}
    const axis=node('div','timeline-row axis-row');axis.append(node('span','axis-caption','Countries & regions'));
    const axisTrack=node('div','axis-track');ticks.forEach(t=>{const n=node('span','axis-tick',date(t));n.style.left=pos(t)+'%';axisTrack.append(n);});axis.append(axisTrack);timeline.append(axis);
    const world=node('div','timeline-row world-row'),worldLabel=node('div','region-label');worldLabel.append(node('h3','','World events'),node('p','','Connections & turning points'));world.append(worldLabel);
    const worldTrack=node('div','track');grid(worldTrack);
    const used=[],visibleEvents=events.filter(e=>e[0]>=a&&e[0]<=b);
    visibleEvents.forEach(e=>{
      const width=Math.min(trackWidth,Math.max(105,Math.min(160,e[1].length*5.5+12)));
      const left=Math.max(0,Math.min(trackWidth-width,pos(e[0])/100*trackWidth-width/2));
      let row=used.findIndex(v=>v+10<=left);if(row<0){row=used.length;used.push(0);}used[row]=left+width;
      const btn=node('button','milestone'+(e[0]===state.year?' active':''));btn.type='button';btn.dataset.key=`event-${e[0]}`;btn.style.left=left/trackWidth*100+'%';btn.style.width=width/trackWidth*100+'%';btn.style.top=row*80+'px';btn.style.setProperty('--marker-offset',`${(pos(e[0])/100*trackWidth-left)/width*100}%`);btn.setAttribute('aria-label',`${e[1]}, ${date(e[0])}. ${e[2]}`);
      btn.append(node('span','milestone-date',date(e[0])),node('span','milestone-name',e[1]));
      btn.addEventListener('click',()=>chooseYear(e[0]));worldTrack.append(btn);
    });
    worldTrack.style.height=Math.max(1,used.length)*80+'px';world.append(worldTrack);timeline.append(world);
    lanes.forEach((lane,index)=>{
      const row=node('section','timeline-row'),label=node('div','region-label');
      const active=lane.periods.filter(current);
      const title=node('h3','',regions[index][0]);title.title=lane.name;
      label.append(title,node('p',active.length?'current-period':'',active.map(p=>p[2]).join(' · ')||regions[index][1]));row.append(label);
      const track=node('div','track');grid(track);
      const visible=lane.periods.filter(p=>p[1]>a&&p[0]<b),ends=[];
      visible.forEach(p=>{
        let band=ends.findIndex(end=>end<=p[0]);if(band<0){band=ends.length;ends.push(0);}ends[band]=p[1];
        const left=pos(Math.max(a,p[0])),right=pos(Math.min(b,p[1])),width=Math.max(0,right-left),pixels=width/100*trackWidth;
        const btn=node('button','period'+(current(p)?' active':'')+(pixels<32?' tiny':''));
        btn.type='button';btn.dataset.key=`period-${index}-${p[0]}`;btn.style.left=left+'%';btn.style.width=`max(2px, calc(${width}% - 3px))`;btn.style.top=band*43+'px';
        btn.title=`${p[2]} · ${dates(p)}${p[4]?' · '+p[4]:''}`;btn.setAttribute('aria-label',`${lane.name}: ${p[2]}, ${dates(p)}. ${p[4]||''}`);btn.setAttribute('aria-pressed',String(current(p)));
        if(pixels>45)btn.append(node('span','period-edge',p[2]));
        btn.addEventListener('click',()=>{
          const start=Math.max(a,p[0]),end=Math.min(b,p[1]-1),y=current(p)?state.year:Math.round((start+end)/2)||1;
          chooseYear(y,{label:regions[index][0].toUpperCase(),title:p[2],date:dates(p),description:p[4]||`${p[2]} in ${lane.name}. Compare the other rows to see which societies and historical periods coexisted.`});
        });
        track.append(btn);
      });
      track.style.height=Math.max(1,ends.length)*43+'px';if(!visible.length)track.append(node('p','empty-period','No entry shown for this window'));
      row.append(track);timeline.append(row);
    });
  }
  picker.addEventListener('change',()=>{state.window=Number(picker.value);const[a,b]=windows[state.window];if(state.year<a||state.year>b)state.year=Math.round((a+b)/2)||1;focus=null;render();save();});
  slider.addEventListener('input',()=>{state.year=Number(slider.value)||1;focus=null;render();});
  slider.addEventListener('change',()=>{save();$('timeline-announcement').textContent=`Comparing ${date(state.year)} across ten regions.`;});
  let resizeFrame,previousWidth=0;
  new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(Math.abs(width-previousWidth)<1)return;previousWidth=width;cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(render);}).observe(timeline);
  render();
})();
