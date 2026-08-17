import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App';
import {importJobApplication} from './services/storage';
import './styles.css';
import './dark-default.css';

const root=document.getElementById('root')!;

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
}
