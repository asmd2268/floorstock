(function(){
'use strict';
var PRINT_JOB_PREFIX='asdhealth:print-orders:';
var rows=[];
var startupError=null;

function readPrintRows(){
  var params=new URLSearchParams(window.location.search||'');
  var token=String(params.get('job')||'').trim();
  var payload=null;
  try{
    var raw=token?localStorage.getItem(PRINT_JOB_PREFIX+token):null;
    if(raw){
      if(token)localStorage.removeItem(PRINT_JOB_PREFIX+token);
      payload=JSON.parse(raw);
    }
  }catch(storageError){
    console.warn('Print job storage could not be read.',storageError);
  }
  if(!payload){
    try{
      if(token&&window.opener&&window.opener.__ASDH_PRINT_ORDER_JOBS__){
        payload=window.opener.__ASDH_PRINT_ORDER_JOBS__[token]||null;
        delete window.opener.__ASDH_PRINT_ORDER_JOBS__[token];
      }
    }catch(openerError){
      console.warn('Print job opener fallback could not be read.',openerError);
    }
  }
  if(!payload){
    var embedded=document.getElementById('print-data');
    if(embedded&&embedded.textContent){
      try{payload=JSON.parse(embedded.textContent);}catch(embeddedError){console.warn('Embedded print data could not be read.',embeddedError);}
    }
  }
  var data=Array.isArray(payload)?payload:(payload&&Array.isArray(payload.rows)?payload.rows:null);
  if(!data||!data.length){
    if(!token)throw new Error('Missing print job identifier.');
    throw new Error('The selected orders could not be loaded for printing. Please close this page and try Print Orders again.');
  }
  return data;
}

try{rows=readPrintRows();}catch(error){startupError=error;}
window.__PRINT_TEST_MODE__=new URLSearchParams(window.location.search||'').get('test')==='1';
var SCALE=3;
var PAGE={
  landscape:{name:'landscape',w:1122.52,h:793.70,mmW:297,mmH:210,minCols:1,maxCols:99},
  portrait:{name:'portrait',w:793.70,h:1122.52,mmW:210,mmH:297,minCols:3,maxCols:7}
};
var FONT_FAMILY='Arial, Tahoma, sans-serif';
var MARGIN=10;
var HEADER_H=21;
var HEADER_GAP=3;
var COLUMN_GAP=3.2;
var MIN_FONT=3.2;
var MAX_FONT=13.5;
var MIN_PAD=.65;
var MAX_PAD=5.2;

function esc(value){
  return String(value==null?'':value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function round1(value){return Math.round(value*10)/10;}
function sourceSequence(){
  var expected={};
  for(var i=0;i<rows.length;i++){
    var row=rows[i];
    expected[row.orderId]=(expected[row.orderId]||0)+1;
    if(Number(row.itemIndex)!==expected[row.orderId]){
      return {ok:false,orderId:row.orderId,actual:row.itemIndex,expected:expected[row.orderId]};
    }
  }
  return {ok:true,orders:expected};
}
function makeMeasureContext(){
  var canvas=document.createElement('canvas');
  canvas.width=32;canvas.height=32;
  return canvas.getContext('2d');
}
var measureCtx=makeMeasureContext();
function setFont(ctx,size,weight){
  ctx.font=String(weight||700)+' '+size+'px '+FONT_FAMILY;
}
function splitToken(ctx,token,maxWidth){
  var parts=[],part='';
  for(var i=0;i<token.length;i++){
    var next=part+token[i];
    if(part&&ctx.measureText(next).width>maxWidth){parts.push(part);part=token[i];}
    else part=next;
  }
  if(part)parts.push(part);
  return parts.length?parts:[''];
}
function wrapLines(ctx,text,maxWidth){
  var words=String(text||'').trim().split(/\s+/).filter(Boolean),lines=[],line='';
  if(!words.length)return [''];
  words.forEach(function(word){
    var pieces=ctx.measureText(word).width>maxWidth?splitToken(ctx,word,maxWidth):[word];
    pieces.forEach(function(piece){
      var candidate=line?line+' '+piece:piece;
      if(line&&ctx.measureText(candidate).width>maxWidth){lines.push(line);line=piece;}
      else line=candidate;
    });
  });
  if(line)lines.push(line);
  return lines.length?lines:[''];
}
function roundedRect(ctx,x,y,w,h,r){
  var radius=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+radius,y);
  ctx.arcTo(x+w,y,x+w,y+h,radius);
  ctx.arcTo(x+w,y+h,x,y+h,radius);
  ctx.arcTo(x,y+h,x,y,radius);
  ctx.arcTo(x,y,x+w,y,radius);
  ctx.closePath();
}
function buildMetrics(page,columns,font,rowPad){
  var contentTop=MARGIN+HEADER_H+HEADER_GAP;
  var contentHeight=page.h-contentTop-MARGIN;
  var columnWidth=(page.w-MARGIN*2-COLUMN_GAP*(columns-1))/columns;
  var quantityWidth=clamp(font*2.35,14,33);
  var innerGap=2.2;
  var nameWidth=columnWidth-quantityWidth-innerGap-4;
  nameWidth=Math.max(5,nameWidth);

  setFont(measureCtx,font,700);
  var lineHeight=font*1.07;
  var minimumRow=Math.max(font*1.58,quantityWidth*.60);
  var deptH=Math.max(8,font*1.45+1.5);
  var catH=Math.max(6,font*1.15+1.2);
  var rowHeights=[],lineSets=[];

  for(var i=0;i<rows.length;i++){
    var lines=wrapLines(measureCtx,rows[i].name,nameWidth-2.4);
    lineSets.push(lines);
    rowHeights.push(Math.max(minimumRow,lines.length*lineHeight+rowPad*2));
  }

  var rowPrefix=[0],transitionPrefix=[0];
  for(var r=0;r<rows.length;r++){
    rowPrefix.push(rowPrefix[r]+rowHeights[r]);
    var extra=0;
    if(r>0){
      if(rows[r].orderId!==rows[r-1].orderId)extra=deptH+catH;
      else if(rows[r].category!==rows[r-1].category)extra=catH;
    }
    transitionPrefix.push(transitionPrefix[r]+extra);
  }

  function sliceHeight(start,endExclusive){
    if(endExclusive<=start)return 0;
    var body=rowPrefix[endExclusive]-rowPrefix[start];
    var transitions=transitionPrefix[endExclusive]-transitionPrefix[start+1];
    return deptH+catH+body+transitions;
  }

  var segments=[];
  var start=0;
  while(start<rows.length){
    var orderId=rows[start].orderId,end=start+1;
    while(end<rows.length&&rows[end].orderId===orderId)end++;
    segments.push({start:start,end:end,height:sliceHeight(start,end)});
    start=end;
  }
  if(columns!==segments.length)return null;

  var maxHeight=Math.max.apply(null,segments.map(function(segment){return segment.height;}));
  var minHeight=Math.min.apply(null,segments.map(function(segment){return segment.height;}));
  return {
    page:page,columns:columns,font:font,rowPad:rowPad,
    lineHeight:lineHeight,deptH:deptH,catH:catH,
    contentTop:contentTop,contentHeight:contentHeight,
    columnWidth:columnWidth,quantityWidth:quantityWidth,
    nameWidth:nameWidth,rowHeights:rowHeights,lineSets:lineSets,
    segments:segments,maxHeight:maxHeight,minHeight:minHeight,
    fill:maxHeight/contentHeight,balance:minHeight/maxHeight,
    fits:maxHeight<=contentHeight-.8
  };
}
function bestFor(page,columns){
  var low=MIN_FONT,high=MAX_FONT,best=null;
  var base=buildMetrics(page,columns,low,MIN_PAD);
  if(!base||!base.fits)return null;
  for(var i=0;i<11;i++){
    var mid=(low+high)/2;
    var trial=buildMetrics(page,columns,mid,MIN_PAD);
    if(trial&&trial.fits){best=trial;low=mid;}else high=mid;
  }
  if(!best)best=base;
  var padLow=MIN_PAD,padHigh=MAX_PAD,padded=best;
  for(var p=0;p<10;p++){
    var padMid=(padLow+padHigh)/2;
    var padTrial=buildMetrics(page,columns,best.font,padMid);
    if(padTrial&&padTrial.fits){padded=padTrial;padLow=padMid;}else padHigh=padMid;
  }
  return padded;
}
function forceOnePage(page,columns){
  var metric=buildMetrics(page,columns,MIN_FONT,0);
  if(!metric)return null;
  if(metric.fits){metric.forced=false;return metric;}
  var scale=Math.max(.001,Math.min(1,(metric.contentHeight-.8)/metric.maxHeight));
  metric.forced=true;
  metric.verticalScale=scale;
  metric.font*=scale;
  metric.lineHeight*=scale;
  metric.deptH*=scale;
  metric.catH*=scale;
  metric.rowPad*=scale;
  metric.rowHeights=metric.rowHeights.map(function(height){return height*scale;});
  metric.segments=metric.segments.map(function(segment){
    return {start:segment.start,end:segment.end,height:segment.height*scale};
  });
  metric.maxHeight*=scale;
  metric.minHeight*=scale;
  metric.fill=metric.maxHeight/metric.contentHeight;
  metric.balance=metric.maxHeight?metric.minHeight/metric.maxHeight:1;
  metric.fits=true;
  return metric;
}
function chooseLayout(){
  var orderIds=[];
  rows.forEach(function(row){if(orderIds.indexOf(row.orderId)<0)orderIds.push(row.orderId);});
  var columns=Math.max(1,orderIds.length),candidates=[];
  [PAGE.landscape,PAGE.portrait].forEach(function(page){
    var natural=bestFor(page,columns);if(natural)candidates.push(natural);
    var forced=forceOnePage(page,columns);if(forced)candidates.push(forced);
  });
  if(!candidates.length)return forceOnePage(PAGE.landscape,columns);
  candidates.sort(function(a,b){
    var af=(a.font||0),bf=(b.font||0);
    if(Math.abs(bf-af)>.01)return bf-af;
    if(!!a.forced!==!!b.forced)return a.forced?1:-1;
    return (b.fill||0)-(a.fill||0);
  });
  return candidates[0];
}

function fillTone(ctx,row,x,y,w,h){
  ctx.fillStyle=row.tone==='gray'?'#b8b8b8':'#ffffff';
  ctx.fillRect(x,y,w,h);
}
function drawDept(ctx,row,x,y,w,h,font){
  fillTone(ctx,row,x,y,w,h);
  ctx.strokeStyle='#000';ctx.lineWidth=1.2;ctx.strokeRect(x+.5,y+.5,w-1,h-1);
  ctx.fillStyle='#000';setFont(ctx,font*.84,800);ctx.textAlign='center';ctx.textBaseline='middle';
  var text=String(row.department||'').toUpperCase();
  while(text.length>3&&ctx.measureText(text).width>w-6)text=text.slice(0,-2)+'…';
  ctx.fillText(text,x+w/2,y+h/2+.2);
}
function drawCategory(ctx,row,x,y,w,h,font){
  fillTone(ctx,row,x,y,w,h);
  ctx.strokeStyle='#000';ctx.lineWidth=.8;
  ctx.beginPath();ctx.moveTo(x,y+.5);ctx.lineTo(x+w,y+.5);ctx.moveTo(x,y+h-.5);ctx.lineTo(x+w,y+h-.5);ctx.stroke();
  ctx.fillStyle='#000';setFont(ctx,font*.80,800);ctx.textAlign='left';ctx.textBaseline='middle';
  var text=String(row.category||'').toUpperCase();
  while(text.length>3&&ctx.measureText(text).width>w-4)text=text.slice(0,-2)+'…';
  ctx.fillText(text,x+2,y+h/2+.2);
}
function drawSnowflake(ctx,cx,cy,size,color){
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=Math.max(.65,size*.08);ctx.globalAlpha=.20;ctx.lineCap='round';
  for(var i=0;i<3;i++){
    var angle=i*Math.PI/3,dx=Math.cos(angle)*size/2,dy=Math.sin(angle)*size/2;
    ctx.beginPath();ctx.moveTo(cx-dx,cy-dy);ctx.lineTo(cx+dx,cy+dy);ctx.stroke();
  }
  ctx.restore();
}
function drawMedicine(ctx,row,metric,index,x,y,w,h,records){
  fillTone(ctx,row,x,y,w,h);
  var qtyW=metric.quantityWidth;
  var gap=2.2;
  var nameX=x+1.4,nameY=y+metric.rowPad*.35;
  var nameW=w-qtyW-gap-2.8,nameH=Math.max(.6,h-metric.rowPad*.7);
  var qtyH=Math.max(.6,Math.min(qtyW*.76,h-.1));
  var qtyX=x+w-qtyW,qtyY=y+(h-qtyH)/2;
  var dark=row.high&&row.tone!=='gray';
  var light=row.high&&row.tone==='gray';

  if(dark||light){
    roundedRect(ctx,nameX,nameY,nameW,nameH,2.3);
    ctx.fillStyle=dark?'#000':'#fff';ctx.fill();
    ctx.strokeStyle='#000';ctx.lineWidth=light?1.2:.8;ctx.stroke();
  }

  ctx.save();
  ctx.globalAlpha=dark?.18:.105;
  ctx.fillStyle=dark?'#fff':'#000';
  setFont(ctx,metric.font*.82,400);ctx.textAlign='right';ctx.textBaseline='middle';
  ctx.fillText(String(row.itemIndex),nameX+nameW-1.5,nameY+nameH/2);
  ctx.restore();

  ctx.fillStyle=dark?'#fff':'#000';setFont(ctx,metric.font,700);ctx.textAlign='left';ctx.textBaseline='top';
  var lines=metric.lineSets[index],lineH=metric.lineHeight;
  var textHeight=lines.length*lineH;
  var textY=nameY+Math.max(1,(nameH-textHeight)/2);
  for(var line=0;line<lines.length;line++)ctx.fillText(lines[line],nameX+1.2,textY+line*lineH);

  if(row.hazard){
    ctx.strokeStyle=dark?'#fff':'#000';ctx.lineWidth=.8;
    ctx.beginPath();ctx.moveTo(nameX+nameW,nameY);ctx.lineTo(nameX,nameY+nameH);ctx.stroke();
  }

  var qtyText=String(row.qty==null?'':row.qty);
  var qtyFont=metric.font*(qtyText.length>=4?.78:.92);
  if(row.cold){
    roundedRect(ctx,qtyX,qtyY,qtyW,qtyH,2.2);
    ctx.fillStyle='#111';ctx.fill();ctx.strokeStyle='#000';ctx.lineWidth=.8;ctx.stroke();
    drawSnowflake(ctx,qtyX+qtyW/2,qtyY+qtyH/2,qtyFont*.72,'#fff');
  }

  ctx.fillStyle=row.cold?'#fff':'#000';setFont(ctx,qtyFont,800);ctx.textAlign='center';ctx.textBaseline='middle';
  if(row.lasa){
    var radius=Math.min(qtyW,qtyH)*.37;
    ctx.strokeStyle=row.cold?'#fff':'#000';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(qtyX+qtyW/2,qtyY+qtyH/2,radius,0,Math.PI*2);ctx.stroke();
  }
  ctx.fillText(qtyText,qtyX+qtyW/2,qtyY+qtyH/2+.15);

  ctx.strokeStyle='#777';ctx.lineWidth=.35;
  ctx.beginPath();ctx.moveTo(x,y+h-.25);ctx.lineTo(x+w,y+h-.25);ctx.stroke();

  records.push({
    orderId:row.orderId,itemIndex:row.itemIndex,name:row.name,qty:qtyText,
    high:row.high,hazard:row.hazard,cold:row.cold,lasa:row.lasa,tone:row.tone,
    rect:{x:x,y:y,w:w,h:h},nameRect:{x:nameX,y:nameY,w:nameW,h:nameH},
    qtyRect:{x:qtyX,y:qtyY,w:qtyW,h:qtyH},snowSize:row.cold?qtyFont*.72:0
  });
}
function render(layout){
  var canvas=document.getElementById('page-canvas');
  canvas.width=Math.round(layout.page.w*SCALE);
  canvas.height=Math.round(layout.page.h*SCALE);
  var ctx=canvas.getContext('2d',{alpha:false});
  ctx.scale(SCALE,SCALE);
  ctx.fillStyle='#fff';ctx.fillRect(0,0,layout.page.w,layout.page.h);

  ctx.fillStyle='#000';setFont(ctx,10.2,800);ctx.textAlign='left';ctx.textBaseline='middle';
  ctx.fillText('Floor Stock Dispensing Orders',MARGIN,MARGIN+HEADER_H/2);
  setFont(ctx,7.8,700);ctx.textAlign='right';
  ctx.fillText('Fit to one page · one department per column · '+layout.page.name,layout.page.w-MARGIN,MARGIN+HEADER_H/2);
  ctx.strokeStyle='#000';ctx.lineWidth=.9;ctx.beginPath();
  ctx.moveTo(MARGIN,MARGIN+HEADER_H);ctx.lineTo(layout.page.w-MARGIN,MARGIN+HEADER_H);ctx.stroke();

  var records=[];
  layout.segments.forEach(function(segment,columnIndex){
    var x=MARGIN+columnIndex*(layout.columnWidth+COLUMN_GAP);
    var y=layout.contentTop;
    var previous=null;
    for(var index=segment.start;index<segment.end;index++){
      var row=rows[index];
      if(!previous||row.orderId!==previous.orderId){
        drawDept(ctx,row,x,y,layout.columnWidth,layout.deptH,layout.font);y+=layout.deptH;
        drawCategory(ctx,row,x,y,layout.columnWidth,layout.catH,layout.font);y+=layout.catH;
      }else if(row.category!==previous.category){
        drawCategory(ctx,row,x,y,layout.columnWidth,layout.catH,layout.font);y+=layout.catH;
      }
      drawMedicine(ctx,row,layout,index,x,y,layout.columnWidth,layout.rowHeights[index],records);
      y+=layout.rowHeights[index];
      previous=row;
    }
  });

  return {canvas:canvas,records:records};
}
function validate(layout,records){
  if(records.length!==rows.length)return {ok:false,reason:'count',actual:records.length,expected:rows.length};
  var expected={};
  for(var i=0;i<records.length;i++){
    var record=records[i];
    expected[record.orderId]=(expected[record.orderId]||0)+1;
    if(Number(record.itemIndex)!==expected[record.orderId])return {ok:false,reason:'sequence',record:record,expected:expected[record.orderId]};
    if(record.rect.x<MARGIN-.1||record.rect.y<layout.contentTop-.1||record.rect.x+record.rect.w>layout.page.w-MARGIN+.1||record.rect.y+record.rect.h>layout.page.h-MARGIN+.1)return {ok:false,reason:'bounds',record:record};
    if(!record.name||record.qty==='')return {ok:false,reason:'content',record:record};
    if(record.cold&&record.snowSize>Math.min(record.qtyRect.w,record.qtyRect.h)*.8)return {ok:false,reason:'snow-size',record:record};
  }
  return {ok:true,count:records.length,orders:expected};
}


function showError(message){
  document.body.dataset.failed='1';
  var status=document.getElementById('status');
  if(status){
    status.style.display='block';
    status.textContent=message;
  }
}

function asciiBytes(text){
  return new TextEncoder().encode(text);
}

function concatBytes(parts){
  var total=parts.reduce(function(sum,part){return sum+part.length;},0);
  var output=new Uint8Array(total);
  var offset=0;
  parts.forEach(function(part){output.set(part,offset);offset+=part.length;});
  return output;
}

function canvasJpegBytes(canvas){
  return new Promise(function(resolve,reject){
    canvas.toBlob(function(blob){
      if(!blob){reject(new Error('The final print image could not be created.'));return;}
      blob.arrayBuffer().then(function(buffer){
        resolve(new Uint8Array(buffer));
      },reject);
    },'image/jpeg',.96);
  });
}

function buildPdf(jpegBytes,pixelWidth,pixelHeight,orientation){
  var portrait=orientation==='portrait';
  var pageWidth=portrait?595.28:841.89;
  var pageHeight=portrait?841.89:595.28;
  var parts=[];
  var offsets=[0];
  var length=0;

  function push(value){
    var bytes=typeof value==='string'?asciiBytes(value):value;
    parts.push(bytes);
    length+=bytes.length;
  }

  function object(id,body){
    offsets[id]=length;
    push(id+' 0 obj\n'+body+'\nendobj\n');
  }

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  object(1,'<< /Type /Catalog /Pages 2 0 R >>');
  object(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pageWidth+' '+pageHeight+'] '+
    '/Resources << /ProcSet [/PDF /ImageC] /XObject << /Im0 5 0 R >> >> '+
    '/Contents 4 0 R >>'
  );

  var content='q\n'+pageWidth+' 0 0 '+pageHeight+' 0 0 cm\n/Im0 Do\nQ\n';
  object(4,'<< /Length '+asciiBytes(content).length+' >>\nstream\n'+content+'endstream');

  offsets[5]=length;
  push('5 0 obj\n<< /Type /XObject /Subtype /Image /Width '+pixelWidth+
    ' /Height '+pixelHeight+
    ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode '+
    '/Interpolate true /Length '+jpegBytes.length+' >>\nstream\n');
  push(jpegBytes);
  push('\nendstream\nendobj\n');

  var xrefOffset=length;
  var xref='xref\n0 6\n0000000000 65535 f \n';
  for(var id=1;id<=5;id++){
    xref+=String(offsets[id]).padStart(10,'0')+' 00000 n \n';
  }
  xref+='trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xrefOffset+'\n%%EOF\n';
  push(xref);

  return concatBytes(parts);
}

function bytesToBase64(bytes){
  var chunk=0x8000;
  var binary='';
  for(var i=0;i<bytes.length;i+=chunk){
    binary+=String.fromCharCode.apply(null,bytes.subarray(i,Math.min(i+chunk,bytes.length)));
  }
  return btoa(binary);
}

async function start(){
  var sequence=sourceSequence();
  if(!sequence.ok){
    showError('Source numbering integrity failed: '+JSON.stringify(sequence));
    return;
  }

  var layout=chooseLayout();
  if(!layout){
    showError('A printable one-page layout could not be created. Reduce the number of selected departments and try again.');
    return;
  }

  var rendered=render(layout);
  var integrity=validate(layout,rendered.records);
  if(!integrity.ok){
    showError('Print integrity failed: '+JSON.stringify(integrity));
    return;
  }

  var jpegBytes=await canvasJpegBytes(rendered.canvas);
  var pdfBytes=buildPdf(
    jpegBytes,
    rendered.canvas.width,
    rendered.canvas.height,
    layout.page.name
  );
  var pdfBlob=new Blob([pdfBytes],{type:'application/pdf'});
  var pdfUrl=URL.createObjectURL(pdfBlob);

  window.__PRINT_DIAGNOSTICS__={
    orientation:layout.page.name,
    columns:layout.columns,
    font:layout.font,
    rowPad:layout.rowPad,
    fill:layout.fill,
    balance:layout.balance,
    forced:!!layout.forced,
    verticalScale:layout.verticalScale||1,
    count:rendered.records.length,
    page:{w:layout.page.w,h:layout.page.h},
    records:rendered.records,
    segments:layout.segments,
    integrity:integrity,
    pdfBytes:pdfBytes.length
  };
  window.__PRINT_PDF_URL__=pdfUrl;
  window.__PRINT_PDF_BLOB__=pdfBlob;
  document.body.dataset.ready='1';
  document.body.dataset.orientation=layout.page.name;
  document.body.dataset.columns=String(layout.columns);
  document.body.dataset.font=String(round1(layout.font));
  document.body.dataset.fill=String(layout.fill);

  if(window.__PRINT_TEST_MODE__){
    window.__PRINT_PDF_BASE64__=bytesToBase64(pdfBytes);
    var status=document.getElementById('status');
    if(status)status.textContent='A4 '+layout.page.name+' PDF ready.';
    return;
  }

  var status=document.getElementById('status');
  if(status)status.textContent='Opening the final A4 '+layout.page.name+' PDF…';
  setTimeout(function(){
    location.replace(pdfUrl+'#view=FitH');
  },40);
}
async function runStart(){
  var watchdog=setTimeout(function(){
    if(document.body.dataset.ready!=='1'&&document.body.dataset.failed!=='1'){
      showError('Print preparation timed out. Close this page and try Print Orders again.');
    }
  },20000);
  try{
    if(startupError)throw startupError;
    await start();
  }catch(error){
    console.error('Print Orders failed.',error);
    showError('Print preparation failed: '+String(error&&error.message||error||'Unknown error'));
  }finally{
    clearTimeout(watchdog);
  }
}
window.addEventListener('load',function(){
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(runStart,runStart);else runStart();
},{once:true});
})();