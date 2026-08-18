import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App';
import {importJobApplication} from './services/storage';
import {installWorkspaceUi} from './services/workspaceUi';
import './styles.css';

const root=document.getElementById('root')!;
const THEME_KEY='gatrivi-crm-theme';

type Theme='light'|'dark';

function installThemeToggle(){
  let theme:Theme=localStorage.getItem(THEME_KEY)==='dark'?'dark':'light';
  const button=document.createElement('button');
  button.type='button';
  button.id='crm-theme-toggle';
  button.setAttribute('aria-label','Cambiar tema');
  Object.assign(button.style,{
    position:'fixed',right:'12px',bottom:'12px',zIndex:'9999',width:'44px',height:'44px',
    border:'1px solid #dfe3ec',borderRadius:'50%',fontSize:'20px',cursor:'pointer',
    display:'grid',placeItems:'center',boxShadow:'0 4px 16px #11182b22'
  });

  const apply=(next:Theme)=>{
    theme=next;
    localStorage.setItem(THEME_KEY,theme);
    const existing=document.getElementById('crm-dark-theme');
    if(theme==='dark'){
      if(!existing){
        const link=document.createElement('link');
        link.id='crm-dark-theme';
        link.rel='stylesheet';
        link.href='/dark-default.css?v=1';
        document.head.appendChild(link);
      }
    }else existing?.remove();
    document.documentElement.style.colorScheme=theme;
    button.textContent=theme==='dark'?'☀️':'🌙';
    button.title=theme==='dark'?'Usar modo día':'Usar modo noche';
    button.style.background=theme==='dark'?'#171b25':'#fff';
    button.style.color=theme==='dark'?'#eef0f6':'#172033';
    button.style.borderColor=theme==='dark'?'#303747':'#dfe3ec';
  };

  button.addEventListener('click',()=>apply(theme==='dark'?'light':'dark'));
  document.body.appendChild(button);
  apply(theme);
}

function handleCatresumakerBridge(){
  if(window.location.pathname!=='/bridge/catresumaker')return false;
  const params=new URLSearchParams(window.location.search);
  try{
    const sourceId=params.get('id')?.trim();
    if(!sourceId)throw new Error('Falta el identificador de la aplicación.');
    const company=params.get('company')?.trim()||'Empresa sin nombre';
    const title=params.get('title')?.trim()||'Aplicación sin título';
    importJobApplication({
      sourceId,
      company,
      title,
      url:params.get('url')||undefined,
      status:params.get('status')||'applied',
    });
    root.innerHTML='<div style="font:14px system-ui;padding:24px;color:#f4f4f5;background:#0b0d12;min-height:100vh"><b>✓ Sincronizado con GATRIVI CRM</b><p id="bridge-detail" style="color:#a1a1aa"></p></div>';
    const detail=document.getElementById('bridge-detail');
    if(detail)detail.textContent=`${company} — ${title}`;
    if(params.get('close')==='1')setTimeout(()=>window.close(),350);
    else setTimeout(()=>window.location.replace('/t/jobs/pipeline'),450);
  }catch(error){
    root.textContent=error instanceof Error?error.message:'No se pudo importar la aplicación.';
  }
  return true;
}

if(!handleCatresumakerBridge()){
  createRoot(root).render(<StrictMode><BrowserRouter><App/></BrowserRouter></StrictMode>);
  installWorkspaceUi();
  installThemeToggle();
}
