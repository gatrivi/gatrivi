import {useMemo,useState,type FormEvent} from 'react';
import {ArrowRight,CheckCircle2,Copy,ExternalLink,MessageCircle,Share2,Target} from 'lucide-react';
import {NavLink,useSearchParams} from 'react-router-dom';
import {useCrm} from './context/CrmContext';
import {
  buildDemoLinks,
  buildOutreachMessage,
  prospectCategories,
  scoreProspect,
  type ProspectCategory,
  type ProspectColor,
  type ProspectPlatform,
  type ProspectSignals,
} from './services/prospecting';
import {inferProspectPrefill,sharedPayloadFromSearch} from './services/shareCapture';
import {outboundStageNames,stageIdByName,type OutboundStageName} from './services/outboundFunnel';

const defaultSignals:ProspectSignals={
  runningAds:true,
  weakOrNoStore:false,
  dmCheckout:false,
  strongVisuals:false,
  catalogLike:false,
  localReachable:true,
};

const signalLabels:Record<keyof ProspectSignals,string>={
  runningAds:'Está pautando anuncios',
  weakOrNoStore:'Sin tienda propia fuerte',
  dmCheckout:'Compra por DM / WhatsApp',
  strongVisuals:'Buenas fotos / producto visual',
  catalogLike:'Oferta tipo catálogo',
  localReachable:'Local / fácil de contactar',
};

const inputStyle={width:'100%',minHeight:42,border:'1px solid #3a3d46',borderRadius:10,padding:'0 12px',background:'#17191f',color:'inherit'} as const;
const labelStyle={display:'grid',gap:6,fontSize:12,fontWeight:700} as const;
const gridStyle={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12} as const;

const nextStage:Partial<Record<OutboundStageName,OutboundStageName>>={
  'Encontrado':'Calificado',
  'Calificado':'Demo lista',
  'Demo lista':'DM enviado',
  'DM enviado':'Respondió',
  'Respondió':'Llamada',
  'Llamada':'Ganado',
};

const actionLabel:Partial<Record<OutboundStageName,string>>={
  'Encontrado':'Marcar calificado',
  'Calificado':'Demo lista',
  'Demo lista':'Marcar DM enviado',
  'DM enviado':'Respondió',
  'Respondió':'Pasar a llamada',
  'Llamada':'Cerrar ganado',
};

export default function Prospects(){
  const {contacts,deals,stages,addProspect,moveDeal,tenant}=useCrm();
  const [params]=useSearchParams();
  const initial=inferProspectPrefill(sharedPayloadFromSearch(params));
  const shared=params.get('shared')==='1'||Boolean(params.get('source')||params.get('url'));
  const [company,setCompany]=useState(initial.company);
  const [socialHandle,setSocialHandle]=useState(initial.socialHandle);
  const [contactName,setContactName]=useState('');
  const [phone,setPhone]=useState('');
  const [sourceUrl,setSourceUrl]=useState(initial.sourceUrl);
  const [platform,setPlatform]=useState<ProspectPlatform>(initial.platform==='other'?'instagram':initial.platform);
  const [area,setArea]=useState('Olivos');
  const [category,setCategory]=useState<ProspectCategory>(initial.category);
  const [color,setColor]=useState<ProspectColor>('carbon');
  const [value,setValue]=useState('325000');
  const [signals,setSignals]=useState<ProspectSignals>(defaultSignals);
  const [saved,setSaved]=useState('');
  const [copied,setCopied]=useState('');

  const qualification=useMemo(()=>scoreProspect(signals),[signals]);
  const demoLinks=useMemo(()=>buildDemoLinks({businessName:company||'Tu negocio',area,category,color}),[company,area,category,color]);
  const outreach=useMemo(()=>buildOutreachMessage(company,demoLinks.customerUrl),[company,demoLinks.customerUrl]);
  const prospects=contacts.filter(contact=>contact.prospect).sort((a,b)=>(b.prospect?.score??0)-(a.prospect?.score??0));
  const crmCaptureUrl=typeof window==='undefined'?'':`${window.location.origin}/t/${tenant}/prospects`;
  const bookmarklet=`javascript:(()=>{const u=new URL(${JSON.stringify(crmCaptureUrl)});u.searchParams.set('source',location.href);u.searchParams.set('title',document.title);location.href=u.toString()})()`;
  const today=new Date().toISOString().slice(0,10);
  const capturedToday=prospects.filter(contact=>contact.createdAt.slice(0,10)===today).length;
  const dailyGoal=5;

  const dealForContact=(contactId:string)=>deals.find(deal=>deal.contactId===contactId);
  const stageForContact=(contactId:string)=>{
    const deal=dealForContact(contactId);
    return stages.find(stage=>stage.id===deal?.stageId)?.name as OutboundStageName|undefined;
  };
  const countAt=(name:OutboundStageName)=>deals.filter(deal=>stages.find(stage=>stage.id===deal.stageId)?.name===name).length;
  const demosReady=countAt('Demo lista');
  const awaitingReply=countAt('DM enviado');
  const conversations=countAt('Respondió')+countAt('Llamada');

  const nextMove=demosReady
    ? `${demosReady} demo${demosReady===1?'':'s'} lista${demosReady===1?'':'s'} para enviar`
    : capturedToday<dailyGoal
      ? `Capturá ${dailyGoal-capturedToday} lead${dailyGoal-capturedToday===1?'':'s'} más hoy`
      : awaitingReply
        ? `${awaitingReply} DM${awaitingReply===1?'':'s'} esperando respuesta`
        : 'Capturá el próximo anuncio que veas';

  const setSignal=(key:keyof ProspectSignals)=>setSignals(current=>({...current,[key]:!current[key]}));
  const copy=async(key:string,text:string)=>{
    try{
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(()=>setCopied(current=>current===key?'':current),1500);
    }catch{setCopied('')}
  };

  const advance=(contactId:string,currentStage?:OutboundStageName)=>{
    if(!currentStage)return;
    const next=nextStage[currentStage];
    const deal=dealForContact(contactId);
    const target=next?stageIdByName(stages,next):undefined;
    if(deal&&target)moveDeal(deal.id,target);
  };

  const submit=(event:FormEvent)=>{
    event.preventDefault();
    if(company.trim().length<2)return;
    addProspect({
      name:contactName||company,
      company,
      phone,
      email:'',
      value:Number(value)||0,
      prospect:{
        sourceUrl:sourceUrl.trim(),
        platform,
        socialHandle:socialHandle.trim(),
        area:area.trim()||'Zona Norte',
        category,
        color,
        score:qualification.score,
        scoreReasons:qualification.reasons,
        signals,
        builderUrl:demoLinks.builderUrl,
        demoUrl:demoLinks.customerUrl,
        ownerUrl:demoLinks.ownerUrl,
        outreachMessage:outreach,
      },
    });
    setSaved(company.trim());
    setCompany('');setSocialHandle('');setContactName('');setPhone('');setSourceUrl('');
  };

  const fit=qualification.score>=80?'Prioridad alta':qualification.score>=55?'Buen candidato':'Baja prioridad';

  return <div style={{display:'grid',gap:18}}>
    <section className="panel wide" style={{minHeight:0}}>
      <div className="panel-title">
        <div><span className="eyebrow">TMM OUTBOUND · HOY</span><h2>Motor de ventas</h2></div>
        <div style={{textAlign:'right'}}><strong style={{fontSize:28}}>{capturedToday}/{dailyGoal}</strong><small style={{display:'block'}}>leads capturados</small></div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'minmax(220px,1.4fr) repeat(3,minmax(120px,.6fr))',gap:12,marginBottom:18}}>
        <div className="note"><span className="eyebrow">SIGUIENTE MOVIMIENTO</span><h3 style={{fontSize:18,margin:'7px 0'}}>{nextMove}</h3><p>Encontrar → calificar → demo → DM → conversación → llamada → venta.</p></div>
        <div className="stat"><span>Demos listas</span><strong>{demosReady}</strong><small>para enviar</small></div>
        <div className="stat"><span>Esperando reply</span><strong>{awaitingReply}</strong><small>DM enviados</small></div>
        <div className="stat"><span>Conversaciones</span><strong>{conversations}</strong><small>respondió / llamada</small></div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(8,minmax(105px,1fr))',gap:8,overflowX:'auto',paddingBottom:6}}>
        {outboundStageNames.map(name=>{
          const stage=stages.find(item=>item.name===name);
          return <div key={name} style={{border:'1px solid #343741',borderRadius:10,padding:12,minWidth:105}}>
            <span className="dot" style={{background:stage?.color}}/> <small>{name}</small>
            <strong style={{display:'block',fontSize:22,marginTop:8}}>{countAt(name)}</strong>
          </div>;
        })}
      </div>

      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:16}}>
        <button className="primary" type="button" onClick={()=>document.getElementById('capture-lead')?.scrollIntoView({behavior:'smooth'})}><Target size={16}/> Capturar lead</button>
        <NavLink className="secondary" to={`/t/${tenant}/pipeline`}>Ver pipeline <ArrowRight size={15}/></NavLink>
      </div>
    </section>

    {shared&&<section className="panel" style={{border:'1px solid #b7d733'}}>
      <div style={{display:'flex',gap:12,alignItems:'center'}}><Share2 size={20}/><div><b>Lead recibido por compartir</b><small style={{display:'block'}}>Inferí lo evidente; revisá nombre, rubro y señales antes de guardarlo.</small></div></div>
    </section>}

    <section className="panel wide" style={{minHeight:0}}>
      <div className="panel-title"><div><span className="eyebrow">COLA DE ACCIÓN</span><h2>Qué hacer ahora</h2></div><b>{prospects.length}</b></div>
      {!prospects.length?<div style={gridStyle}>
        <div className="note"><b>1. Encontrá un anuncio</b><p>IG/FB + compra por DM/WhatsApp + sin tienda propia fuerte.</p></div>
        <div className="note"><b>2. Compartilo al CRM</b><p>El formulario infiere negocio, handle, plataforma y rubro.</p></div>
        <div className="note"><b>3. Guardá y mandá la demo</b><p>Un prospecto bueno entra directo en <b>Demo lista</b>, con pitch copiable.</p></div>
      </div>:prospects.map(contact=>{
        const prospect=contact.prospect!;
        const currentStage=stageForContact(contact.id)??'Encontrado';
        const canAdvance=Boolean(nextStage[currentStage]);
        return <div className="stage-row" key={contact.id} style={{display:'grid',gridTemplateColumns:'minmax(170px,1.2fr) 90px minmax(140px,.8fr) auto',gap:12}}>
          <span><b>{contact.company||contact.name}</b><small style={{display:'block'}}>{prospect.socialHandle?`${prospect.socialHandle} · `:''}{prospect.platform} · {prospect.area}</small></span>
          <span><b>{prospect.score}/100</b><small style={{display:'block'}}>{currentStage}</small></span>
          <span style={{fontSize:12}}>{prospect.scoreReasons.slice(0,2).join(' · ')}</span>
          <span style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>
            {prospect.sourceUrl&&<a className="link" href={prospect.sourceUrl} target="_blank" rel="noreferrer">Fuente ↗</a>}
            <a className="link" href={prospect.demoUrl} target="_blank" rel="noreferrer">Demo ↗</a>
            <button className="link" type="button" onClick={()=>copy(contact.id,prospect.outreachMessage)}><MessageCircle size={13}/> {copied===contact.id?'Pitch copiado':'Copiar DM'}</button>
            {canAdvance&&<button className="secondary" type="button" onClick={()=>advance(contact.id,currentStage)}><CheckCircle2 size={14}/>{actionLabel[currentStage]}</button>}
          </span>
        </div>;
      })}
    </section>

    <section id="capture-lead" className="panel wide" style={{minHeight:0,scrollMarginTop:16}}>
      <div className="panel-title">
        <div><span className="eyebrow">CAPTURA + CALIFICACIÓN</span><h2>Convertir anuncio en oportunidad</h2></div>
        <div style={{textAlign:'right'}}><strong style={{fontSize:28}}>{qualification.score}/100</strong><small style={{display:'block'}}>{fit}</small></div>
      </div>

      <form onSubmit={submit} style={{display:'grid',gap:16}}>
        <div style={gridStyle}>
          <label style={labelStyle}>Negocio<input style={inputStyle} value={company} onChange={event=>setCompany(event.target.value)} placeholder="Ej. Panadería Roma" required/></label>
          <label style={labelStyle}>Usuario / handle<input style={inputStyle} value={socialHandle} onChange={event=>setSocialHandle(event.target.value)} placeholder="@panaderiaroma"/></label>
          <label style={labelStyle}>Contacto<input style={inputStyle} value={contactName} onChange={event=>setContactName(event.target.value)} placeholder="Opcional"/></label>
          <label style={labelStyle}>Teléfono / WhatsApp<input style={inputStyle} value={phone} onChange={event=>setPhone(event.target.value)} placeholder="Opcional"/></label>
          <label style={labelStyle}>Plataforma<select style={inputStyle} value={platform} onChange={event=>setPlatform(event.target.value as ProspectPlatform)}><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="other">Otra</option></select></label>
          <label style={labelStyle}>URL del anuncio / perfil<input style={inputStyle} type="url" value={sourceUrl} onChange={event=>setSourceUrl(event.target.value)} placeholder="https://..."/></label>
          <label style={labelStyle}>Zona<input style={inputStyle} value={area} onChange={event=>setArea(event.target.value)} placeholder="Olivos"/></label>
          <label style={labelStyle}>Rubro<select style={inputStyle} value={category} onChange={event=>setCategory(event.target.value as ProspectCategory)}>{Object.entries(prospectCategories).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          <label style={labelStyle}>Color demo<select style={inputStyle} value={color} onChange={event=>setColor(event.target.value as ProspectColor)}><option value="carbon">Carbón</option><option value="coral">Coral</option><option value="verde">Verde</option><option value="azul">Azul</option><option value="violeta">Violeta</option></select></label>
          <label style={labelStyle}>Valor oportunidad<input style={inputStyle} type="number" min="0" step="1000" value={value} onChange={event=>setValue(event.target.value)}/></label>
        </div>

        <div>
          <span className="eyebrow">SEÑALES DE COMPRA</span>
          <div style={{...gridStyle,marginTop:10}}>{(Object.keys(signalLabels) as Array<keyof ProspectSignals>).map(key=><label className="task" key={key} style={{cursor:'pointer'}}><input type="checkbox" checked={signals[key]} onChange={()=>setSignal(key)}/><span>{signalLabels[key]}</span></label>)}</div>
        </div>

        <div className="note" style={{display:'grid',gap:8}}>
          <b>{qualification.score>=55?'✓ Este lead entra en Demo lista':'Este lead necesita revisión'}</b>
          <span style={{fontSize:13,overflowWrap:'anywhere'}}>{demoLinks.customerUrl}</span>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <a className="secondary" href={demoLinks.customerUrl} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Ver demo</a>
            <button className="secondary" type="button" onClick={()=>copy('draft',outreach)}><Copy size={15}/> {copied==='draft'?'Copiado':'Copiar pitch'}</button>
          </div>
        </div>

        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <small>{saved?`${saved} ya está en el funnel con tarea para hoy.`:'Guardar crea contacto + oportunidad + demo + próxima acción.'}</small>
          <button className="primary" type="submit"><Target size={16}/> Guardar en funnel</button>
        </div>
      </form>
    </section>

    <section className="panel" style={{minHeight:0}}>
      <div className="panel-title"><div><span className="eyebrow">CAPTURA RÁPIDA</span><h2>Desde navegador o teléfono</h2></div></div>
      <div style={gridStyle}>
        <div className="note"><b>📱 Teléfono</b><p>Instalá Gatrivi CRM. Desde una publicación/perfil: Compartir → Gatrivi CRM.</p></div>
        <div className="note"><b>🔖 Desktop</b><p>Guardá un favorito “TMM lead” con el bookmarklet.</p><button className="secondary" type="button" onClick={()=>copy('bookmarklet',bookmarklet)}><Copy size={15}/> {copied==='bookmarklet'?'Copiado':'Copiar bookmarklet'}</button></div>
      </div>
    </section>
  </div>;
}
