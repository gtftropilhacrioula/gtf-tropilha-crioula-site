(function(){
'use strict';
var V='/vendor/mdconverter/',loaded={};
function loadScript(f){return loaded[f]||(loaded[f]=new Promise(function(ok,err){var s=document.createElement('script');s.src=V+f;s.onload=ok;s.onerror=function(){err(new Error('Não foi possível carregar '+f))};document.head.appendChild(s)}))}
function esc(s){return String(s).replace(/\|/g,'\\|').replace(/\r?\n/g,' ').trim()}

async function docxToMd(file){
  await Promise.all([loadScript('mammoth.browser.min.js'),loadScript('turndown.browser.umd.js')]);
  await loadScript('turndown-plugin-gfm.js');
  var r=await mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()},{
    styleMap:["p[style-name='Title'] => h1:fresh","p[style-name='Título'] => h1:fresh","p[style-name='Subtitle'] => h2:fresh","p[style-name='Subtítulo'] => h2:fresh"],
    convertImage:mammoth.images.imgElement(function(){return Promise.resolve({src:'#imagem'})})
  });
  var doc=new DOMParser().parseFromString('<body>'+r.value+'</body>','text/html');
  doc.querySelectorAll('td p, th p').forEach(function(p){p.replaceWith(doc.createTextNode(p.textContent+' '))});
  doc.querySelectorAll('table').forEach(function(t){
    var tr=t.querySelector('tr');if(!tr)return;
    Array.prototype.slice.call(tr.children).forEach(function(td){if(td.tagName==='TD'){var th=doc.createElement('th');th.innerHTML=td.innerHTML;td.replaceWith(th)}});
  });
  doc.querySelectorAll('td,th').forEach(function(c){c.textContent=c.textContent.replace(/\|/g,'\uE000')});
  var td=new TurndownService({headingStyle:'atx',bulletListMarker:'-',codeBlockStyle:'fenced',emDelimiter:'*'});
  td.use(turndownPluginGfm.gfm);
  td.addRule('img',{filter:'img',replacement:function(){return '*[imagem]*'}});
  var md=td.turndown(doc.body.innerHTML).replace(/\uE000/g,'\\|').replace(/^(\s*)-\s{2,}/gm,'$1- ').replace(/\n{3,}/g,'\n\n').trim()+'\n';
  var avisos=r.messages.filter(function(m){return m.type==='warning'}).length;
  return {md:md,nota:avisos?avisos+' aviso(s) do conversor (elementos do Word sem equivalente em Markdown).':''};
}

async function xlsxToMd(file){
  await loadScript('read-excel-file.min.js');
  var sheets=await readXlsxFile(file);
  if(!Array.isArray(sheets))sheets=[{sheet:'Planilha',data:sheets}];
  var out=[],vazias=0;
  sheets.forEach(function(s){
    var rows=(s.data||[]).filter(function(r){return r.some(function(c){return c!==null&&c!==''})});
    if(!rows.length){vazias++;return}
    var n=Math.max.apply(null,rows.map(function(r){return r.length}));
    function cell(c){
      if(c===null||c===undefined)return '';
      if(c instanceof Date){var i=c.toISOString();return i.slice(11,19)==='00:00:00'?i.slice(0,10):i.slice(0,19).replace('T',' ')}
      return esc(c)
    }
    function line(r){var a=[];for(var i=0;i<n;i++)a.push(cell(r[i]));return '| '+a.join(' | ')+' |'}
    var head=rows[0].slice();for(var i=0;i<n;i++)if(head[i]===null||head[i]===undefined||head[i]==='')head[i]='Coluna '+(i+1);
    out.push('## '+esc(s.sheet||s.name||'Planilha')+'\n\n'+line(head)+'\n| '+Array(n+1).join('--- | ').trim()+'\n'+rows.slice(1).map(line).join('\n'));
  });
  return {md:out.join('\n\n').trim()+'\n',nota:vazias?vazias+' aba(s) vazia(s) ignorada(s).':''};
}

async function pdfToMd(file){
  var pdfjs=await import(V+'pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc=V+'pdf.worker.min.mjs';
  var pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  var pages=[],sizes={},total=0;
  for(var p=1;p<=pdf.numPages;p++){
    var tc=await (await pdf.getPage(p)).getTextContent(),items=[];
    tc.items.forEach(function(it){
      if(!it.str||!it.str.trim())return;
      var h=Math.round(Math.hypot(it.transform[2],it.transform[3])*2)/2||it.height;
      items.push({s:it.str,x:it.transform[4],y:it.transform[5],w:it.width,h:h});
      sizes[h]=(sizes[h]||0)+it.str.length;total+=it.str.length;
    });
    var lines=[];
    items.sort(function(a,b){return b.y-a.y||a.x-b.x});
    items.forEach(function(it){
      var L=lines[lines.length-1];
      if(L&&Math.abs(L.y-it.y)<=Math.max(2,it.h*.4)){L.it.push(it);L.h=Math.max(L.h,it.h)}
      else lines.push({y:it.y,h:it.h,it:[it]});
    });
    pages.push(lines.map(function(L){
      L.it.sort(function(a,b){return a.x-b.x});
      var t='',prev=null;
      L.it.forEach(function(it){
        if(prev&&it.x-(prev.x+prev.w)>L.h*.15&&!/\s$/.test(t)&&!/^\s/.test(it.s))t+=' ';
        t+=it.s;prev=it;
      });
      return {t:t.replace(/\s+/g,' ').trim(),y:L.y,h:L.h};
    }).filter(function(L){return L.t}));
  }
  if(!total)return {md:'',nota:'Nenhum texto encontrado. O PDF parece ser digitalizado (imagem); esta ferramenta não faz OCR.'};
  var body=0,best=0;
  Object.keys(sizes).forEach(function(k){if(sizes[k]>best){best=sizes[k];body=parseFloat(k)}});
  var out=[],para=null;
  function flush(){if(para){out.push(para.join(' '));para=null}}
  pages.forEach(function(lines){
    lines.forEach(function(L,i){
      if(/^\d{1,3}$/.test(L.t)&&(i===0||i===lines.length-1))return;
      var r=L.h/body,last=out.length;
      if(r>=1.15&&L.t.length<140){
        flush();out.push((r>=1.8?'# ':r>=1.4?'## ':'### ')+L.t);para=null;L._h=true;return;
      }
      var li=L.t.match(/^([•●▪◦·]|[-–]|\d+[.)])\s+(.*)$/);
      if(li){flush();out.push((/\d/.test(li[1])?li[1].replace(')','.'):'-')+' '+li[2]);L._li=true;return}
      var pv=lines[i-1];
      var gap=pv?pv.y-L.y:0;
      if(para&&pv&&!pv._h&&gap<=L.h*1.7){
        if(/[A-Za-zÀ-ÿ]-$/.test(para[para.length-1])&&/^[a-zà-ÿ]/.test(L.t))para[para.length-1]=para[para.length-1].slice(0,-1)+L.t;
        else para.push(L.t);
      }else{flush();para=[L.t]}
    });
    flush();
  });
  flush();
  var md=out.join('\n\n').replace(/\n\n(- |\d+\. )/g,function(m,a){return '\n'+a}).replace(/(^|\n)((?:- |\d+\. )[^\n]*)\n([^-\d\n#])/g,'$1$2\n\n$3');
  return {md:md.trim()+'\n',nota:'PDF: títulos são detectados pelo tamanho da letra; tabelas e colunas não são preservadas.'};
}

var T={docx:docxToMd,xlsx:xlsxToMd,pdf:pdfToMd};
var list=document.getElementById('md-lista'),inp=document.getElementById('md-arquivo'),drop=document.getElementById('md-drop');
var feitos=[],zipbar=document.getElementById('md-zipbar'),zipbtn=document.getElementById('md-zip');
function baixar(blob,nome){var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nome;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500)}
function atualizaZip(){zipbar.hidden=feitos.length<2;zipbtn.textContent='Baixar todos em .zip ('+feitos.length+' arquivos)'}
zipbtn.addEventListener('click',async function(){
  await loadScript('fflate.min.js');
  var o={},usados={};
  feitos.slice().reverse().forEach(function(f){
    var n=nomeMd(f.nome),b=n.replace(/\.md$/,''),i=1;
    while(usados[n.toLowerCase()]){i++;n=b+' ('+i+').md'}
    usados[n.toLowerCase()]=1;o[n]=fflate.strToU8(f.md);
  });
  baixar(new Blob([fflate.zipSync(o)],{type:'application/zip'}),'conversoes-markdown.zip');
});
function nomeMd(n){return n.replace(/\.[^.]+$/,'')+'.md'}
function addCard(file){
  var ext=(file.name.split('.').pop()||'').toLowerCase();
  var c=document.createElement('article');c.className='md-card';
  c.innerHTML='<div class="md-card-h"><strong></strong><span class="md-st">Convertendo…</span></div><p class="md-nota" hidden></p><textarea readonly rows="12" hidden aria-label="Resultado em Markdown"></textarea><div class="btnrow" hidden><button type="button" class="button md-copy">Copiar</button><button type="button" class="button ghost md-down">Baixar .md</button></div>';
  c.querySelector('strong').textContent=file.name;
  list.prepend(c);
  var st=c.querySelector('.md-st'),ta=c.querySelector('textarea'),nota=c.querySelector('.md-nota'),btns=c.querySelector('.btnrow');
  if(!T[ext]){st.textContent='Formato não suportado. Use .docx, .pdf ou .xlsx.';c.classList.add('erro');return}
  T[ext](file).then(function(r){
    if(r.nota){nota.textContent=r.nota;nota.hidden=false}
    if(!r.md.trim()){st.textContent='Sem conteúdo para converter.';c.classList.add('erro');return}
    feitos.push({nome:file.name,md:r.md});atualizaZip();
    ta.value=r.md;ta.hidden=false;btns.hidden=false;st.textContent='Pronto · '+r.md.length.toLocaleString('pt-BR')+' caracteres';
    c.querySelector('.md-copy').onclick=function(){
      var b=this;(navigator.clipboard?navigator.clipboard.writeText(r.md):Promise.reject()).catch(function(){ta.select();document.execCommand('copy')}).then(function(){b.textContent='Copiado';setTimeout(function(){b.textContent='Copiar'},1800)});
    };
    c.querySelector('.md-down').onclick=function(){
      baixar(new Blob([r.md],{type:'text/markdown;charset=utf-8'}),nomeMd(file.name));
    };
  }).catch(function(e){st.textContent='Não foi possível converter este arquivo.';nota.textContent=String(e&&e.message||e);nota.hidden=false;c.classList.add('erro')});
}
function receber(files){Array.prototype.forEach.call(files,addCard)}
inp.addEventListener('change',function(){receber(inp.files);inp.value=''});
['dragenter','dragover'].forEach(function(e){drop.addEventListener(e,function(ev){ev.preventDefault();drop.classList.add('sobre')})});
['dragleave','drop'].forEach(function(e){drop.addEventListener(e,function(ev){ev.preventDefault();drop.classList.remove('sobre')})});
drop.addEventListener('drop',function(ev){receber(ev.dataTransfer.files)});
})();
