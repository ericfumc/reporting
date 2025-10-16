function wrapText(value,maxLen,indent){
  if(!value) return '';
  const words=value.split(/\s+/); const prefix=' '.repeat(indent); let line='',out='';
  for(let w of words){
    if(line.length===0) line=w;
    else if(line.length+1+w.length>maxLen){ out+=(out?'\n'+prefix:'')+line; line=w; }
    else line+=' '+w;
  }
  if(line) out+=(out?'\n'+prefix:'')+line;
  return out;
}

function buildReport(templateKey, templates, fieldInputs, diagnosisInput, maxFieldLen=36, wrapWidth=72, separator=":"){
  const tpl=templates[templateKey]; const diag=(diagnosisInput.value||'').trim();
  let report=''; const indent=maxFieldLen+separator.length;
  if(diag) report += 'FINAL DIAGNOSIS\n'+ '-'.repeat(15)+'\n'+diag+'\n\n';
  tpl.categories.forEach(cat=>{
    const catLines=[];
    cat.fields.forEach(f=>{
      const v=(fieldInputs[f.label].value||'').trim();
      if(!v) return; const low=v.toLowerCase(); if(['n/a','not applicable','none','nil'].includes(low)) return;
      const padded=(f.label+' '.repeat(maxFieldLen)).slice(0,maxFieldLen);
      const wrappedValue=wrapText(v,wrapWidth,indent);
      const firstLineIndex=wrappedValue.indexOf('\n');
      if(firstLineIndex===-1) catLines.push(padded+separator+wrappedValue);
      else { const first=wrappedValue.slice(0,firstLineIndex); const rest=wrappedValue.slice(firstLineIndex+1);
        catLines.push(padded+separator+first); catLines.push(rest);
      }
    });
    if(catLines.length) report+=cat.name.toUpperCase()+'\n'+ '-'.repeat(80)+'\n'+catLines.join('\n')+'\n\n';
  });
  return report.replace(/\s+$/,'');
}
