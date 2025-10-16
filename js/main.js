// Template JSON files
const templateFiles = [
  { key: "breast", filename: "templates/breast.json",
  { key: "DCIS_resection", filename: "templates/DCIS_resection.json" } }
];

let templates={}, currentTemplateKey, fieldInputs={};
const maxFieldLen=36, wrapWidth=72, separator=":";

const templateSelect=document.getElementById('templateSelect');
const fieldsBox=document.getElementById('fieldsBox');
const preview=document.getElementById('preview');
const btnCopy=document.getElementById('btnCopy');
const btnDownload=document.getElementById('btnDownload');
const btnReset=document.getElementById('btnReset');
const diagnosisInput=document.getElementById('diagnosis');
const themeToggle=document.getElementById('themeToggle');

// Load templates
async function loadTemplates(){
  for(const t of templateFiles){
    try{
      const resp=await fetch(t.filename);
      if(!resp.ok) throw new Error("Failed to fetch "+t.filename);
      templates[t.key]=await resp.json();
    } catch(e){ console.error("Error loading template", t.key, e); }
  }
  currentTemplateKey=Object.keys(templates)[0];
  if(localStorage.getItem('theme')==='light') document.body.classList.add('light-theme');
  populateTemplateSelect(); buildFieldsUI(currentTemplateKey);
}

function populateTemplateSelect(){
  templateSelect.innerHTML='';
  for(const k in templates){
    const opt=document.createElement('option'); opt.value=k; opt.textContent=templates[k].templateName;
    templateSelect.appendChild(opt);
  }
  templateSelect.value=currentTemplateKey;
}

function buildFieldsUI(templateKey){
  fieldsBox.innerHTML=''; fieldInputs={};
  const tpl=templates[templateKey];
  tpl.categories.forEach(cat=>{
    const title=document.createElement('div'); title.className='category-title'; title.textContent=cat.name;
    fieldsBox.appendChild(title);
    cat.fields.forEach(f=>{
      const row=document.createElement('div'); row.className='field-row';
      const lbl=document.createElement('label'); lbl.textContent=f.label;

      let input;
      if(f.options && Array.isArray(f.options)){
        input=document.createElement('select');
        const blankOpt=document.createElement('option'); blankOpt.value=''; blankOpt.textContent='-- Select --'; input.appendChild(blankOpt);
        f.options.forEach(opt=>{ const o=document.createElement('option'); o.value=opt; o.textContent=opt; input.appendChild(o); });
        input.addEventListener('change', updatePreview);
      } else {
        input=document.createElement('input'); input.type='text';
        input.addEventListener('input', updatePreview);
        input.addEventListener('keydown', ev=>{ if(ev.key==='Enter'){ ev.preventDefault(); focusNextInput(input); } });
      }

      input.dataset.label=f.label; row.appendChild(lbl); row.appendChild(input); fieldsBox.appendChild(row);
      fieldInputs[f.label]=input;
    });
  });

  diagnosisInput.addEventListener('input', updatePreview);
  updatePreview();
}

function focusNextInput(el){
  const keys=Object.keys(fieldInputs);
  const idx=keys.indexOf(el.dataset.label);
  if(idx>=0 && idx<keys.length-1) fieldInputs[keys[idx+1]].focus();
  else diagnosisInput.focus();
}

function updatePreview(){ preview.value=buildReport(currentTemplateKey, templates, fieldInputs, diagnosisInput); }

// Event listeners
templateSelect.addEventListener('change',()=>{ currentTemplateKey=templateSelect.value; buildFieldsUI(currentTemplateKey); });
btnCopy.addEventListener('click', async()=>{
  const text=buildReport(currentTemplateKey, templates, fieldInputs, diagnosisInput);
  try{ await navigator.clipboard.writeText(text); alert('Report copied to clipboard'); }
  catch(e){ alert('Copy failed'); }
});
btnDownload.addEventListener('click',()=>{
  const text=buildReport(currentTemplateKey, templates, fieldInputs, diagnosisInput);
  const filename=templates[currentTemplateKey].templateName.replace(/\s+/g,'_')+"_Report.txt";
  const blob=new Blob([text],{type:'text/plain'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});
btnReset.addEventListener('click',()=>{ Object.values(fieldInputs).forEach(inp=>inp.value=''); diagnosisInput.value=''; updatePreview(); });
themeToggle.addEventListener('click',()=>{
  document.body.classList.toggle('light-theme');
  localStorage.setItem('theme', document.body.classList.contains('light-theme')?'light':'dark');
});

// Initialize
loadTemplates();
