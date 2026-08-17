import {useEffect,useState} from 'react';
import {useLocation} from 'react-router-dom';
import {getAllowedTenants,getSession,switchTenant} from './services/auth';

const RELEASE={
  id:'2026-08-17-outreach-mobile',
  title:'Outreach TMM + mobile',
  changes:[
    'Prospectos TMM visibles en el espacio Ventas.',
    'Cockpit de outreach con 3 DMs, IG/WA + copiar y seguimiento automático.',
    'Pipeline con Respondió y Demo.',
    'Navegación móvil fija y usable con una mano.',
    'Captura de prospectos desde Compartir y cambio Ventas ↔ Jobs.',
  ],
};
const releaseKey=`crm-release-seen:${RELEASE.id}`;

function WorkspaceBar(){
  useLocation();
  const session=getSession();
  if(!session)return null;
  const tenants=getAllowedTenants(session.username);
  if(tenants.length<2)return null;
  const labels:Record<string,string>={gatrivi:'Ventas',jobs:'Jobs'};
  const change=(tenant:string)=>{
    if(tenant===session.tenant)return;
    const next=switchTenant(tenant);
    if(next)window.location.assign(`/t/${next.tenant}/dashboard`);
  };
  return <div className="workspace-bar" aria-label="Cambiar espacio de trabajo">
    <b>GATRIVI CRM</b>
    <div>{tenants.map(tenant=><button key={tenant} type="button" className={tenant===session.tenant?'selected':''} onClick={()=>change(tenant)}>{labels[tenant]??tenant}</button>)}</div>
  </div>;
}

function ReleaseNotice(){
  const location=useLocation();
  const [open,setOpen]=useState(false);
  useEffect(()=>{
    if(!getSession()){setOpen(false);return;}
    try{setOpen(localStorage.getItem(releaseKey)!=='1')}catch{setOpen(true)}
  },[location.pathname]);
  if(!open||!getSession())return null;
  const dismiss=()=>{
    try{localStorage.setItem(releaseKey,'1')}catch{/* non-critical */}
    setOpen(false);
  };
  return <div className="release-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)dismiss()}}>
    <section className="release-card" role="dialog" aria-modal="true" aria-labelledby="release-title">
      <span className="eyebrow">NOVEDADES</span>
      <h2 id="release-title">{RELEASE.title}</h2>
      <ul>{RELEASE.changes.map(change=><li key={change}>{change}</li>)}</ul>
      <button className="primary" type="button" onClick={dismiss}>Entendido</button>
    </section>
  </div>;
}

export default function AppStatus(){return <><WorkspaceBar/><ReleaseNotice/></>}
