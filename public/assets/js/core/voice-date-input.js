/* Voice input for the expiry-date field — Web Speech API (SpeechRecognition),
   built into Safari (iPadOS/iOS) and Chrome, no external service. Design
   choice made deliberately for a field this sensitive (a medicine's expiry
   date): the recognized date is only FILLED into the existing date input
   and shown back to the user as a toast — it is never auto-saved. The
   normal Save Expiry button still has to be pressed, which doubles as the
   confirmation step, and the native date input itself is the final visual
   check (shows the actual parsed date, not raw speech text).

   Arabic digit-word recognition varies a lot by device/accent, so instead
   of trying to fully understand a spoken sentence, the parser is generous:
   it pulls out digit groups and month names (Arabic or English) from
   whatever the speech engine transcribed and assembles the most likely
   day/month/year combination, favoring an explicit month name when heard. */

var AR_MONTHS={
  'يناير':1,'كانون الثاني':1,
  'فبراير':2,'شباط':2,
  'مارس':3,'آذار':3,'اذار':3,
  'ابريل':4,'أبريل':4,'نيسان':4,
  'مايو':5,'أيار':5,'ايار':5,
  'يونيو':6,'حزيران':6,
  'يوليو':7,'تموز':7,
  'اغسطس':8,'أغسطس':8,'آب':8,
  'سبتمبر':9,'أيلول':9,'ايلول':9,
  'اكتوبر':10,'أكتوبر':10,'تشرين الأول':10,
  'نوفمبر':11,'تشرين الثاني':11,
  'ديسمبر':12,'كانون الأول':12
};
var EN_MONTHS={
  january:1,february:2,march:3,april:4,may:5,june:6,
  july:7,august:8,september:9,october:10,november:11,december:12
};

function normalizeArabicDigits(text){
  var map={'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
  return String(text||'').replace(/[٠-٩]/g,function(d){return map[d]});
}

function findMonth(text){
  var lower=text.toLowerCase();
  var enKeys=Object.keys(EN_MONTHS).sort(function(a,b){return b.length-a.length});
  for(var i=0;i<enKeys.length;i++){if(lower.indexOf(enKeys[i])>=0)return EN_MONTHS[enKeys[i]];}
  var arKeys=Object.keys(AR_MONTHS).sort(function(a,b){return b.length-a.length});
  for(var j=0;j<arKeys.length;j++){if(text.indexOf(arKeys[j])>=0)return AR_MONTHS[arKeys[j]];}
  return null;
}

/* Returns {year,month,day} or null. Exported for testability. */
function parseSpokenDate(rawText){
  if(!rawText)return null;
  var text=normalizeArabicDigits(rawText).trim();

  // Already a clean numeric date (dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, etc.)
  var iso=text.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if(iso)return clampDate(Number(iso[1]),Number(iso[2]),Number(iso[3]));
  var dmy=text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if(dmy){var y=Number(dmy[3]);if(y<100)y+=2000;return clampDate(y,Number(dmy[2]),Number(dmy[1]));}

  var month=findMonth(text);
  var numbers=(text.match(/\d+/g)||[]).map(Number);

  if(month){
    var year=numbers.find(function(n){return n>=2000&&n<2100});
    var day=numbers.find(function(n){return n>=1&&n<=31&&n!==year});
    if(year)return clampDate(year,month,day||1);
  }

  if(numbers.length>=3){
    var yr=numbers.find(function(n){return n>=2000&&n<2100});
    var rest=numbers.filter(function(n){return n!==yr;});
    if(yr&&rest.length>=2){
      var a=rest[0],b=rest[1];
      // Whichever of the two remaining numbers can't be a month (>12) is the day.
      if(a>12)return clampDate(yr,b,a);
      if(b>12)return clampDate(yr,a,b);
      return clampDate(yr,a,b); // ambiguous — default day-then-month
    }
  }
  if(numbers.length===2){
    var yr2=numbers.find(function(n){return n>=2000&&n<2100});
    if(yr2&&month){var other=numbers.find(function(n){return n!==yr2;});return clampDate(yr2,month,other||1);}
  }
  return null;
}
function clampDate(year,month,day){
  if(!(year>=2000&&year<2100))return null;
  if(!(month>=1&&month<=12))return null;
  if(!(day>=1&&day<=31))return null;
  return {year:year,month:month,day:day};
}
function toISODateString(d){
  return d.year+'-'+String(d.month).padStart(2,'0')+'-'+String(d.day).padStart(2,'0');
}

function speechCtor(){return window.SpeechRecognition||window.webkitSpeechRecognition||null}

function attachMicButton(input){
  if(!input||input.dataset.voiceAttached)return;
  var Ctor=speechCtor();
  if(!Ctor)return; // Feature-detected: no visible button on unsupported browsers.
  input.dataset.voiceAttached='1';

  var btn=document.createElement('button');
  btn.type='button';
  btn.className='voice-date-btn';
  btn.title='Speak the date / انطق التاريخ';
  btn.textContent='🎤';
  btn.style.cssText='margin-inline-start:6px;min-width:36px;min-height:36px;border-radius:8px;border:1px solid var(--bd);background:var(--s2);cursor:pointer;font-size:16px';
  if(input.parentNode){
    if(getComputedStyle(input.parentNode).display==='block'){
      var wrap=document.createElement('span');wrap.style.cssText='display:inline-flex;align-items:center;gap:6px;width:100%';
      input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);wrap.appendChild(btn);
    }else{
      input.parentNode.insertBefore(btn,input.nextSibling);
    }
  }

  var recognition=null,listening=false;
  function stop(){listening=false;btn.textContent='🎤';btn.style.background='var(--s2)';try{if(recognition)recognition.stop()}catch(ignore){}}
  btn.addEventListener('click',function(){
    if(listening){stop();return;}
    recognition=new Ctor();
    recognition.lang='ar-SA';
    recognition.interimResults=false;
    recognition.maxAlternatives=3;
    listening=true;btn.textContent='🔴';btn.style.background='var(--rd)';
    recognition.onresult=function(event){
      var alternatives=[];
      for(var i=0;i<event.results[0].length;i++)alternatives.push(event.results[0][i].transcript);
      var parsed=null,heard='';
      for(var a=0;a<alternatives.length&&!parsed;a++){parsed=parseSpokenDate(alternatives[a]);heard=alternatives[a];}
      if(parsed){
        input.value=toISODateString(parsed);
        input.dispatchEvent(new Event('change',{bubbles:true}));
        if(window.toast)window.toast('Heard: "'+heard+'" → '+toISODateString(parsed)+'. Check the date field, then press Save. / سمعت: "'+heard+'" ← تحقق من الحقل ثم اضغط حفظ.','info');
      }else if(window.toast){
        window.toast('Could not understand a date in: "'+heard+'". Try saying it as day, month name, year. / لم أفهم تاريخًا من: "'+heard+'". جرّب: اليوم، اسم الشهر، السنة.','err');
      }
    };
    recognition.onerror=function(error){
      stop();
      if(window.toast&&error&&error.error!=='aborted')window.toast('Voice input failed: '+error.error+' / تعذر الإدخال الصوتي','err');
    };
    recognition.onend=stop;
    try{recognition.start()}catch(startError){stop();if(window.toast)window.toast('Could not start voice input.','err')}
  });
}

function scan(){
  var input=document.getElementById('exp-date-inp');
  if(input)attachMicButton(input);
}
setInterval(scan,1000);
scan();

window.__voiceDateParse=parseSpokenDate; // exposed for manual/testing use only
export {parseSpokenDate};
